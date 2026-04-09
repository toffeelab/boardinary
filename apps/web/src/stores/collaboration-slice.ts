import { create } from "zustand";
import type { UserPresence } from "@repo/types";

interface CollaborationState {
  // 연결 상태
  isConnected: boolean;
  collabToken: string | null;

  // 프레즌스 (userId → UserPresence)
  presence: Record<string, UserPresence>;

  // 액션
  setConnected: (connected: boolean) => void;
  setCollabToken: (token: string) => void;
  setPresence: (userId: string, presence: UserPresence) => void;
  removePresence: (userId: string) => void;
  clearPresence: () => void;
}

export const useCollaborationStore = create<CollaborationState>()((set) => ({
  isConnected: false,
  collabToken: null,
  presence: {},

  setConnected: (connected) => set({ isConnected: connected }),
  setCollabToken: (token) => set({ collabToken: token }),
  setPresence: (userId, presence) =>
    set((s) => ({ presence: { ...s.presence, [userId]: presence } })),
  removePresence: (userId) =>
    set((s) => {
      const next = { ...s.presence };
      delete next[userId];
      return { presence: next };
    }),
  clearPresence: () => set({ presence: {} }),
}));
