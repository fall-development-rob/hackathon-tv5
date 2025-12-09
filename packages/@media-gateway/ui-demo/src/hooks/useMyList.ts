import { useState, useEffect, useCallback } from "react";

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

export function useMyList(): UseMyListResult {
  const [list, setList] = useState<MyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load initial list from localStorage
  useEffect(() => {
    try {
      const loadedList = loadListFromStorage();
      setList(loadedList);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  const addToList = useCallback((item: Omit<MyListItem, "addedAt">) => {
    setList((currentList) => {
      // Check for duplicates
      const exists = currentList.some((existing) => existing.id === item.id);
      if (exists) {
        console.warn(`Item ${item.id} is already in My List`);
        return currentList;
      }

      // Check list size limit
      if (currentList.length >= MAX_LIST_SIZE) {
        const error = new Error("My List is full. Please remove some items.");
        setError(error);
        throw error;
      }

      const newItem: MyListItem = {
        ...item,
        addedAt: Date.now(),
      };

      const updatedList = [newItem, ...currentList]; // Add to beginning

      try {
        saveListToStorage(updatedList);
        setError(null);
      } catch (e) {
        setError(e as Error);
        throw e;
      }

      return updatedList;
    });
  }, []);

  const removeFromList = useCallback((id: string) => {
    setList((currentList) => {
      const updatedList = currentList.filter((item) => item.id !== id);

      try {
        saveListToStorage(updatedList);
        setError(null);
      } catch (e) {
        setError(e as Error);
        throw e;
      }

      return updatedList;
    });
  }, []);

  const isInList = useCallback(
    (id: string): boolean => {
      return list.some((item) => item.id === id);
    },
    [list],
  );

  const clearList = useCallback(() => {
    setList([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
      setError(null);
    } catch (e) {
      setError(e as Error);
      throw e;
    }
  }, []);

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

  return {
    list,
    loading,
    error,
    addToList,
    removeFromList,
    isInList,
    clearList,
    toggleItem,
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
