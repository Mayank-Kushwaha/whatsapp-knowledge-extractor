/**
 * Zustand store for global app state.
 * Manages current chat, sidebar state, theme, and upload progress.
 */

import { create } from "zustand";
import type { Chat, ChatDetail, ProgressEvent } from "@/lib/api";

// ---------------------------------------------------------------------------
// Store types
// ---------------------------------------------------------------------------

interface AppState {
  // Theme
  theme: "dark" | "light";
  setTheme: (theme: "dark" | "light") => void;
  toggleTheme: () => void;

  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;

  // Chat list
  chats: Chat[];
  setChats: (chats: Chat[]) => void;
  addChat: (chat: Chat) => void;

  // Current chat
  currentChat: ChatDetail | null;
  setCurrentChat: (chat: ChatDetail | null) => void;

  // Upload state
  isUploading: boolean;
  uploadProgress: ProgressEvent | null;
  uploadChatId: number | null;
  setUploadState: (state: { isUploading: boolean; progress?: ProgressEvent | null; chatId?: number | null }) => void;
  resetUploadState: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAppStore = create<AppState>((set) => ({
  // Theme — default dark
  theme: "dark",
  setTheme: (theme) => {
    set({ theme });
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  },
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "dark" ? "light" : "dark";
      if (typeof document !== "undefined") {
        document.documentElement.classList.toggle("dark", next === "dark");
      }
      return { theme: next };
    }),

  // Sidebar
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

  // Chat list
  chats: [],
  setChats: (chats) => set({ chats }),
  addChat: (chat) => set((state) => ({ chats: [chat, ...state.chats] })),

  // Current chat
  currentChat: null,
  setCurrentChat: (chat) => set({ currentChat: chat }),

  // Upload state
  isUploading: false,
  uploadProgress: null,
  uploadChatId: null,
  setUploadState: ({ isUploading, progress, chatId }) =>
    set((state) => ({
      isUploading,
      uploadProgress: progress !== undefined ? progress : state.uploadProgress,
      uploadChatId: chatId !== undefined ? chatId : state.uploadChatId,
    })),
  resetUploadState: () =>
    set({
      isUploading: false,
      uploadProgress: null,
      uploadChatId: null,
    }),
}));
