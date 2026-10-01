import { getDb } from "@/db/aero-db";
import { AERO_DEMO_LOGIN } from "@/db/aero-seed";
import type { SessionUser } from "@/types";

export const aeroAuthService = {
  async login(email: string, password: string): Promise<SessionUser> {
    const user = await getDb().users.where("email").equals(email.trim().toLowerCase()).first();
    if (!user || user.password !== password || !user.active) {
      // fallback for demo credentials if seed email casing differs
      if (email.trim().toLowerCase() === AERO_DEMO_LOGIN.email && password === AERO_DEMO_LOGIN.password) {
        const admin = await getDb().users.get("user-admin");
        if (admin) {
          return { id: admin.id, email: admin.email, name: admin.name, role: "admin" };
        }
      }
      throw new Error("Invalid email or password");
    }
    return { id: user.id, email: user.email, name: user.name, role: "admin" };
  },
};
