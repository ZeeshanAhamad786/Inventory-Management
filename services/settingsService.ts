import { getDb } from "@/db/db";
import { settingsSchema, type SettingsFormValues } from "@/schemas";
import { nowIso } from "@/lib/utils";
import { resetDatabase } from "@/db/db";
import { seedDatabase } from "@/db/seed";
import { activityService } from "./activityService";
import { COMPANY_DEFAULT_NAME } from "@/lib/constants";
import type { AppSettings } from "@/types";

export const settingsService = {
  async get(): Promise<AppSettings> {
    const existing = await getDb().settings.get("app");
    if (existing) return existing;
    const fallback: AppSettings = {
      id: "app",
      companyName: COMPANY_DEFAULT_NAME,
      companyAddress: "",
      companyPhone: "",
      companyEmail: "",
      grnPrefix: "GR",
      autoGrnNumber: true,
      nextGrnSequence: 1,
      updatedAt: nowIso(),
    };
    await getDb().settings.put(fallback);
    return fallback;
  },

  async update(values: SettingsFormValues) {
    const parsed = settingsSchema.parse(values);
    const current = await this.get();
    const next: AppSettings = {
      ...current,
      ...parsed,
      updatedAt: nowIso(),
    };
    await getDb().settings.put(next);
    await activityService.log({
      action: "updated",
      entityType: "settings",
      entityId: "app",
      reference: next.companyName,
      description: "Updated company settings",
    });
    return next;
  },

  async resetDemoData() {
    await resetDatabase();
    await seedDatabase();
    await activityService.log({
      action: "imported",
      entityType: "settings",
      entityId: "app",
      reference: "RESET",
      description: "Demo data was reset",
    });
  },
};
