import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { getAuthState } from "../lib/auth";

export interface MyListItem {
  id: string;
  title: string;
  mediaType: "movie" | "tv";
  posterPath: string | null;
  addedAt: number;
}

export interface UseMyListResult {
  list: MyListItem[];
  loading: boolean;
  error: Error | null;
  addToList: (item: Omit<MyListItem, "addedAt">) => void;
  removeFromList: (id: string) => void;
  isInList: (id: string) => boolean;
  clearList: () => void;
  toggleItem: (item: Omit<MyListItem, "addedAt">) => void;
  synced: boolean;
  lastSyncAt: Date | null;
  isSyncing: boolean;
}

export interface UseMyListOptions {
  userId?: string;
  token?: string;
}

const STORAGE_KEY = "media-gateway-my-list";
const MAX_LIST_SIZE = 500; // Prevent storage overflow

function loadListFromStorage(): MyListItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);

    // Validate the data structure
    if (!Array.isArray(parsed)) {
      console.warn("Invalid My List data in localStorage, resetting");
      return [];
    }

    return parsed.filter((item: unknown): item is MyListItem => {
      return (
        typeof item === "object" &&
        item !== null &&
        "id" in item &&
        "title" in item &&
        "mediaType" in item &&
        "addedAt" in item &&
        typeof (item as MyListItem).id === "string" &&
        typeof (item as MyListItem).title === "string" &&
        ((item as MyListItem).mediaType === "movie" ||
          (item as MyListItem).mediaType === "tv") &&
        typeof (item as MyListItem).addedAt === "number"
      );
    });
  } catch (e) {
    console.error("Failed to load My List from localStorage:", e);
    return [];
  }
}

function saveListToStorage(list: MyListItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to save My List to localStorage:", e);
    throw new Error("Failed to save list. Storage may be full.");
  }
}

export function useMyList(options?: UseMyListOptions): UseMyListResult {
  const [list, setList] = useState<MyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [synced, setSynced] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authStateRef = useRef(getAuthState());

  // Update auth state when options change
  useEffect(() => {
    if (options?.token && options?.userId) {
      authStateRef.current = {
        isAuthenticated: true,
        token: options.token,
        userId: options.userId,
      };
    } else {
      authStateRef.current = getAuthState();
    }
  }, [options?.token, options?.userId]);

  // Merge localStorage list with backend list
  const mergeLists = useCallback(
    (localList: MyListItem[], backendList: MyListItem[]): MyListItem[] => {
      const merged = new Map<string, MyListItem>();

      // Add all backend items (they are the source of truth)
      backendList.forEach((item) => merged.set(item.id, item));

      // Add local items that aren't in backend (offline additions)
      localList.forEach((item) => {
        if (!merged.has(item.id)) {
          merged.set(item.id, item);
        }
      });

      // Sort by addedAt descending (newest first)
      return Array.from(merged.values()).sort((a, b) => b.addedAt - a.addedAt);
    },
    [],
  );

  // Fetch list from backend
  const fetchFromBackend = useCallback(async () => {
    const { token } = authStateRef.current;
    if (!token) {
      throw new Error("No authentication token available");
    }

    try {
      const response = await api.myList.fetch(token);
      return response.items;
    } catch (e) {
      console.error("Failed to fetch My List from backend:", e);
      throw e;
    }
  }, []);

  // Sync list to backend (debounced)
  const syncToBackend = useCallback(async () => {
    const { token, isAuthenticated } = authStateRef.current;

    if (!isAuthenticated || !token) {
      return;
    }

    // Clear existing timeout
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    // Debounce sync by 2 seconds
    syncTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSyncing(true);

        const backendList = await fetchFromBackend();
        const localList = loadListFromStorage();

        // Find items in local that aren't in backend
        const backendIds = new Set(backendList.map((item) => item.id));
        const itemsToSync = localList.filter(
          (item) => !backendIds.has(item.id),
        );

        // Sync each new item to backend
        for (const item of itemsToSync) {
          try {
            await api.myList.add(token, {
              id: item.id,
              title: item.title,
              mediaType: item.mediaType,
              posterPath: item.posterPath,
            });
          } catch (e) {
            console.error(`Failed to sync item ${item.id}:`, e);
          }
        }

        setLastSyncAt(new Date());
        setSynced(true);
      } catch (e) {
        console.error("Failed to sync to backend:", e);
        setSynced(false);
      } finally {
        setIsSyncing(false);
      }
    }, 2000);
  }, [fetchFromBackend]);

  // Load initial list (localStorage + backend if authenticated)
  useEffect(() => {
    const loadInitialList = async () => {
      try {
        const localList = loadListFromStorage();
        const { isAuthenticated } = authStateRef.current;

        if (isAuthenticated) {
          try {
            // Fetch from backend
            const backendList = await fetchFromBackend();

            // Merge lists (backend + local offline additions)
            const mergedList = mergeLists(localList, backendList);
            setList(mergedList);

            // Save merged list to localStorage
            saveListToStorage(mergedList);

            setSynced(true);
            setLastSyncAt(new Date());
          } catch (e) {
            // Fallback to localStorage on API error
            console.warn(
              "Failed to fetch from backend, using localStorage:",
              e,
            );
            setList(localList);
            setSynced(false);
          }
        } else {
          // Not authenticated, use localStorage only
          setList(localList);
          setSynced(false);
        }

        setError(null);
      } catch (e) {
        setError(e as Error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialList();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addToList = useCallback(
    async (item: Omit<MyListItem, "addedAt">) => {
      const { isAuthenticated, token } = authStateRef.current;

      // Check for duplicates
      if (list.some((existing) => existing.id === item.id)) {
        console.warn(`Item ${item.id} is already in My List`);
        return;
      }

      // Check list size limit
      if (list.length >= MAX_LIST_SIZE) {
        const error = new Error("My List is full. Please remove some items.");
        setError(error);
        throw error;
      }

      const newItem: MyListItem = {
        ...item,
        addedAt: Date.now(),
      };

      // Update local state immediately (optimistic update)
      setList((currentList) => [newItem, ...currentList]);

      try {
        // Save to localStorage
        const updatedList = [newItem, ...list];
        saveListToStorage(updatedList);

        // Sync to backend if authenticated
        if (isAuthenticated && token) {
          try {
            await api.myList.add(token, {
              id: item.id,
              title: item.title,
              mediaType: item.mediaType,
              posterPath: item.posterPath,
            });
            setSynced(true);
            setLastSyncAt(new Date());
          } catch (e) {
            console.error("Failed to add to backend:", e);
            setSynced(false);
            // Don't throw - we still saved locally
            // Will retry sync on next syncToBackend call
            syncToBackend();
          }
        }

        setError(null);
      } catch (e) {
        // Rollback on storage error
        setList((currentList) =>
          currentList.filter((i) => i.id !== newItem.id),
        );
        setError(e as Error);
        throw e;
      }
    },
    [list, syncToBackend],
  );

  const removeFromList = useCallback(
    async (id: string) => {
      const { isAuthenticated, token } = authStateRef.current;

      // Store removed item for potential rollback
      const removedItem = list.find((item) => item.id === id);
      if (!removedItem) {
        console.warn(`Item ${id} not found in My List`);
        return;
      }

      // Update local state immediately (optimistic update)
      setList((currentList) => currentList.filter((item) => item.id !== id));

      try {
        // Save to localStorage
        const updatedList = list.filter((item) => item.id !== id);
        saveListToStorage(updatedList);

        // Sync to backend if authenticated
        if (isAuthenticated && token) {
          try {
            await api.myList.remove(token, id);
            setSynced(true);
            setLastSyncAt(new Date());
          } catch (e) {
            console.error("Failed to remove from backend:", e);
            setSynced(false);
            // Don't throw - we still removed locally
            syncToBackend();
          }
        }

        setError(null);
      } catch (e) {
        // Rollback on storage error
        if (removedItem) {
          setList((currentList) => [removedItem, ...currentList]);
        }
        setError(e as Error);
        throw e;
      }
    },
    [list, syncToBackend],
  );

  const isInList = useCallback(
    (id: string): boolean => {
      return list.some((item) => item.id === id);
    },
    [list],
  );

  const clearList = useCallback(async () => {
    const { isAuthenticated, token } = authStateRef.current;

    // Store current list for potential rollback
    const previousList = [...list];

    // Update local state immediately
    setList([]);

    try {
      // Clear localStorage
      localStorage.removeItem(STORAGE_KEY);

      // Clear backend if authenticated
      if (isAuthenticated && token) {
        try {
          // Remove each item from backend
          await Promise.all(
            previousList.map((item) => api.myList.remove(token, item.id)),
          );
          setSynced(true);
          setLastSyncAt(new Date());
        } catch (e) {
          console.error("Failed to clear backend list:", e);
          setSynced(false);
        }
      }

      setError(null);
    } catch (e) {
      // Rollback on error
      setList(previousList);
      setError(e as Error);
      throw e;
    }
  }, [list]);

  const toggleItem = useCallback(
    (item: Omit<MyListItem, "addedAt">) => {
      if (isInList(item.id)) {
        removeFromList(item.id);
      } else {
        addToList(item);
      }
    },
    [isInList, addToList, removeFromList],
  );

  // Listen for storage changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        try {
          const loadedList = loadListFromStorage();
          setList(loadedList);
          setError(null);
        } catch (err) {
          setError(err as Error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    list,
    loading,
    error,
    addToList,
    removeFromList,
    isInList,
    clearList,
    toggleItem,
    synced,
    lastSyncAt,
    isSyncing,
  };
}

// Export storage utilities for testing or manual control
export const storageUtils = {
  getKey: () => STORAGE_KEY,
  clear: () => localStorage.removeItem(STORAGE_KEY),
  getSize: () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Blob([stored]).size : 0;
  },
  maxSize: MAX_LIST_SIZE,
};
