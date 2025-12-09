import { useState, useRef, useEffect } from "react";
import { User, ChevronDown, Settings, HelpCircle, LogOut } from "lucide-react";
import { useAuth } from "../hooks";

export function UserMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!user) return null;

  const rotateClass = isOpen ? "rotate-180" : "";

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
      >
        {user.avatar ? (
          <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded" />
        ) : (
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
        )}
        <ChevronDown
          className={"w-4 h-4 transition-transform " + rotateClass}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-[#1A1A1A] border border-gray-800 rounded-lg shadow-2xl overflow-hidden z-50">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              {user.avatar ? (
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-12 h-12 rounded"
                />
              ) : (
                <div className="w-12 h-12 rounded bg-blue-600 flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">{user.name}</p>
                <p className="text-sm text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="py-2">
            <button
              onClick={() => {
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800 transition-colors text-left"
            >
              <Settings className="w-5 h-5 text-gray-400" />
              <span className="text-sm">Account Settings</span>
            </button>

            <button
              onClick={() => {
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800 transition-colors text-left"
            >
              <HelpCircle className="w-5 h-5 text-gray-400" />
              <span className="text-sm">Help Center</span>
            </button>
          </div>

          <div className="border-t border-gray-800">
            <button
              onClick={() => {
                signOut();
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-800 transition-colors text-left"
            >
              <LogOut className="w-5 h-5 text-gray-400" />
              <span className="text-sm">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
