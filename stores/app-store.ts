"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionUser } from "@/types";
import { setServiceUser } from "@/services/sessionContext";

interface AuthState {
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => {
        setServiceUser(user);
        set({ user });
      },
      logout: () => {
        setServiceUser(null);
        set({ user: null });
      },
    }),
    {
      name: "ash-aviation-auth",
      onRehydrateStorage: () => (state) => {
        if (state?.user) setServiceUser(state.user);
      },
    },
  ),
);

interface UiState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (value: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    { name: "ash-aviation-ui" },
  ),
);
