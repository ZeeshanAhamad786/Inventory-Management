import { getDb } from "@/db/db";
import { pricingRuleSchema, type PricingRuleFormValues } from "@/schemas";
import { createId, nowIso } from "@/lib/utils";
import { applyPricingRule } from "@/lib/pricing";
import type { PricingRule } from "@/types";
import { activityService } from "./activityService";

export const pricingService = {
  async list() {
    return (await getDb().pricingRules.toArray()).sort((a, b) => a.priority - b.priority);
  },

  async quote(cost: number) {
    const rules = await this.list();
    return applyPricingRule(cost, rules);
  },

  async create(values: PricingRuleFormValues) {
    const parsed = pricingRuleSchema.parse(values);
    const timestamp = nowIso();
    const rule: PricingRule = {
      id: createId(),
      label: parsed.label.trim(),
      minCost: parsed.minCost,
      maxCost: parsed.maxCost,
      multiplier: parsed.isPoa ? null : parsed.multiplier,
      isPoa: parsed.isPoa,
      active: parsed.active,
      priority: parsed.priority,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await getDb().pricingRules.add(rule);
    await activityService.log({
      action: "pricing_rule_changed",
      entityType: "pricing_rule",
      entityId: rule.id,
      reference: rule.label,
      description: `Created pricing rule ${rule.label}`,
    });
    return rule;
  },

  async update(id: string, values: PricingRuleFormValues) {
    const parsed = pricingRuleSchema.parse(values);
    const current = await getDb().pricingRules.get(id);
    if (!current) throw new Error("Pricing rule not found");
    const next: PricingRule = {
      ...current,
      ...parsed,
      label: parsed.label.trim(),
      multiplier: parsed.isPoa ? null : parsed.multiplier,
      updatedAt: nowIso(),
    };
    await getDb().pricingRules.put(next);
    await activityService.log({
      action: "pricing_rule_changed",
      entityType: "pricing_rule",
      entityId: id,
      reference: next.label,
      description: `Updated pricing rule ${next.label}`,
    });
    return next;
  },

  async remove(id: string) {
    const current = await getDb().pricingRules.get(id);
    if (!current) throw new Error("Pricing rule not found");
    await getDb().pricingRules.delete(id);
    await activityService.log({
      action: "pricing_rule_changed",
      entityType: "pricing_rule",
      entityId: id,
      reference: current.label,
      description: `Removed pricing rule ${current.label}`,
    });
  },
};
