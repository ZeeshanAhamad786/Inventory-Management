import { getDb } from "@/db/db";
import { loginSchema } from "@/schemas";
import type { SessionUser } from "@/types";
import { activityService } from "./activityService";
import { setServiceUser } from "./sessionContext";

export const authService = {
  async login(email: string, password: string): Promise<SessionUser> {
    const parsed = loginSchema.parse({ email, password });
    const user = await getDb().users.where("email").equalsIgnoreCase(parsed.email.trim()).first();
    if (!user || !user.active || user.password !== parsed.password) {
      throw new Error("Invalid email or password");
    }
    const session: SessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    setServiceUser(session);
    await activityService.log({
      action: "login",
      entityType: "user",
      entityId: user.id,
      reference: user.email,
      description: `${user.name} signed in`,
    });
    return session;
  },

  logout() {
    setServiceUser(null);
  },
};
