import type { CostingTotals, PricingMethod, PricingResult, PricingRule } from "@/types";
import { roundMoney, safeDivide } from "@/lib/utils";

export function selectPricingRule(cost: number, rules: PricingRule[]): PricingRule | null {
  if (!Number.isFinite(cost) || cost < 0) return null;
  const active = [...rules]
    .filter((rule) => rule.active)
    .sort((a, b) => a.priority - b.priority || a.minCost - b.minCost);

  return (
    active.find((rule) => {
      const aboveMin = cost >= rule.minCost;
      const belowMax = rule.maxCost === null || cost < rule.maxCost;
      return aboveMin && belowMax;
    }) ?? null
  );
}

export function applyPricingRule(cost: number, rules: PricingRule[]): PricingResult {
  if (!Number.isFinite(cost) || cost < 0) {
    return {
      method: "POA",
      salePriceEa: null,
      ruleId: null,
      label: "POA",
      multiplier: null,
    };
  }

  const rule = selectPricingRule(cost, rules);
  if (!rule || rule.isPoa || rule.multiplier === null) {
    return {
      method: "POA",
      salePriceEa: null,
      ruleId: rule?.id ?? null,
      label: rule?.label ?? "POA",
      multiplier: null,
    };
  }

  return {
    method: "AUTOMATIC",
    salePriceEa: roundMoney(cost * rule.multiplier),
    ruleId: rule.id,
    label: rule.label,
    multiplier: rule.multiplier,
  };
}

export function calculateCostingFigures(input: {
  quantity: number;
  purchaseCostEa: number;
  pricingMethod: PricingMethod;
  salePriceEa: number | null;
}): {
  totalCost: number;
  totalSale: number | null;
  profit: number | null;
  profitPercent: number | null;
} {
  const quantity = Number.isFinite(input.quantity) ? input.quantity : 0;
  const purchaseCostEa = Number.isFinite(input.purchaseCostEa) ? input.purchaseCostEa : 0;
  const totalCost = roundMoney(quantity * purchaseCostEa);

  if (input.pricingMethod === "POA" || input.salePriceEa === null || !Number.isFinite(input.salePriceEa)) {
    return {
      totalCost,
      totalSale: null,
      profit: null,
      profitPercent: null,
    };
  }

  const totalSale = roundMoney(quantity * input.salePriceEa);
  const profit = roundMoney(totalSale - totalCost);
  const profitPercent = safeDivide(profit, totalCost);
  return {
    totalCost,
    totalSale,
    profit,
    profitPercent: profitPercent === null ? (profit === 0 ? 0 : null) : roundMoney(profitPercent * 100),
  };
}

export function sumCostings(
  rows: Array<{
    totalCost: number;
    totalSale: number | null;
    profit: number | null;
    pricingMethod: PricingMethod;
  }>,
): CostingTotals {
  let totalCost = 0;
  let totalSale = 0;
  let profit = 0;
  let poaCount = 0;
  let hasNumericSale = false;

  for (const row of rows) {
    totalCost += row.totalCost;
    if (row.pricingMethod === "POA" || row.totalSale === null || row.profit === null) {
      poaCount += 1;
    } else {
      totalSale += row.totalSale;
      profit += row.profit;
      hasNumericSale = true;
    }
  }

  const percent = safeDivide(profit, totalCost);
  return {
    totalCost: roundMoney(totalCost),
    totalSale: hasNumericSale ? roundMoney(totalSale) : null,
    profit: hasNumericSale ? roundMoney(profit) : null,
    profitPercent:
      hasNumericSale && percent !== null
        ? roundMoney(percent * 100)
        : hasNumericSale && profit === 0
          ? 0
          : null,
    poaCount,
  };
}
