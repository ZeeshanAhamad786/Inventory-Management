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
      name: "aeroswift-auth",
      onRehydrateStorage: () => (state) => {
        if (state?.user) setServiceUser(state.user);
      },
    },
  ),
);

interface UiState {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      darkMode: false,
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setDarkMode: (darkMode) => set({ darkMode }),
    }),
    { name: "aeroswift-ui" },
  ),
);
