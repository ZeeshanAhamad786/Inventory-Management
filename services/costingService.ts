import { getDb } from "@/db/db";
import { costingLineSchema } from "@/schemas";
import { createId, nowIso } from "@/lib/utils";
import { calculateCostingFigures, sumCostings } from "@/lib/pricing";
import type { Costing, PricingMethod } from "@/types";
import { activityService } from "./activityService";
import { pricingService } from "./pricingService";
import { getServiceUser } from "./sessionContext";

export const costingService = {
  async list() {
    return getDb().costings.orderBy("updatedAt").reverse().toArray();
  },

  async forGrn(grnId: string) {
    return getDb().costings.where("grnId").equals(grnId).toArray();
  },

  async getByItem(grnItemId: string) {
    return getDb().costings.where("grnItemId").equals(grnItemId).first();
  },

  async previewLine(input: {
    quantity: number;
    purchaseCostEa: number;
    pricingMethod: PricingMethod;
    salePriceEa: number | null;
  }) {
    let method = input.pricingMethod;
    let salePriceEa = input.salePriceEa;
    if (method === "AUTOMATIC") {
      const quote = await pricingService.quote(input.purchaseCostEa);
      method = quote.method;
      salePriceEa = quote.salePriceEa;
      return {
        method,
        salePriceEa,
        ruleId: quote.ruleId,
        label: quote.label,
        ...calculateCostingFigures({
          quantity: input.quantity,
          purchaseCostEa: input.purchaseCostEa,
          pricingMethod: method,
          salePriceEa,
        }),
      };
    }
    if (method === "POA") {
      salePriceEa = null;
    }
    return {
      method,
      salePriceEa,
      ruleId: null,
      label: method === "POA" ? "POA" : "Manual override",
      ...calculateCostingFigures({
        quantity: input.quantity,
        purchaseCostEa: input.purchaseCostEa,
        pricingMethod: method,
        salePriceEa,
      }),
    };
  },

  async saveGrnCosting(
    grnId: string,
    lines: Array<{
      grnItemId: string;
      pricingMethod: PricingMethod;
      salePriceEa: number | null;
      notes: string;
    }>,
  ) {
    const grn = await getDb().grns.get(grnId);
    if (!grn) throw new Error("GRN not found");
    const items = await getDb().grnItems.where("grnId").equals(grnId).toArray();
    const user = getServiceUser();
    const timestamp = nowIso();
    const saved: Costing[] = [];

    for (const line of lines) {
      const parsed = costingLineSchema.parse(line);
      const item = items.find((row) => row.id === parsed.grnItemId);
      if (!item) throw new Error("GRN item not found");
      const preview = await this.previewLine({
        quantity: item.quantity,
        purchaseCostEa: item.purchaseCostEa,
        pricingMethod: parsed.pricingMethod,
        salePriceEa: parsed.salePriceEa,
      });
      const existing = await this.getByItem(item.id);
      const costing: Costing = {
        id: existing?.id ?? createId(),
        grnId,
        grnItemId: item.id,
        partId: item.partId,
        quantity: item.quantity,
        purchaseCostEa: item.purchaseCostEa,
        totalCost: preview.totalCost,
        pricingMethod: preview.method,
        pricingRuleId: preview.ruleId,
        salePriceEa: preview.salePriceEa,
        totalSale: preview.totalSale,
        profit: preview.profit,
        profitPercent: preview.profitPercent,
        notes: parsed.notes,
        createdBy: existing?.createdBy ?? user.id,
        createdAt: existing?.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      await getDb().costings.put(costing);
      saved.push(costing);
    }

    await activityService.log({
      action: "price_changed",
      entityType: "costing",
      entityId: grnId,
      reference: grn.grnNumber,
      description: `Saved costing for ${grn.grnNumber}`,
    });
    return { costings: saved, totals: sumCostings(saved) };
  },
};
