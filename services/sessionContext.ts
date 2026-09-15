import type { SessionUser } from "@/types";

let currentUser: SessionUser | null = null;

export function setServiceUser(user: SessionUser | null) {
  currentUser = user;
}

export function getServiceUser(): SessionUser {
  if (currentUser) return currentUser;
  return {
    id: "user-admin",
    email: "admin@demo.local",
    name: "Stores Admin",
    role: "admin",
  };
}
