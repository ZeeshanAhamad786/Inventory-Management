import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const partSchema = z.object({
  partNumber: z.string().trim().min(1, "Part number is required"),
  description: z.string().trim().min(1, "Description is required"),
  category: z.string().trim().min(1, "Category is required"),
  unitOfMeasure: z.string().trim().min(1, "Unit of measure is required"),
  defaultCost: z.number().finite().min(0, "Cost cannot be negative").nullable(),
  defaultSalePrice: z.number().finite().min(0, "Sale price cannot be invalid").nullable(),
  status: z.enum(["active", "inactive"]),
  notes: z.string(),
  alternateNumbers: z.array(z.string()),
});

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required"),
  contactPerson: z.string(),
  email: z.string().email("Enter a valid email").or(z.literal("")),
  phone: z.string(),
  address: z.string(),
  notes: z.string(),
  status: z.enum(["active", "inactive"]),
});

export const locationSchema = z.object({
  name: z.string().trim().min(1, "Store name is required"),
  code: z.string().trim().min(1, "Location code is required"),
  description: z.string(),
  status: z.enum(["active", "inactive"]),
});

export const workpackSchema = z.object({
  workpackNumber: z.string().trim().min(1, "Workpack number is required"),
  title: z.string().trim().min(1, "Title is required"),
  registration: z.string(),
  status: z.enum(["open", "in_progress", "completed", "cancelled", "archived"]),
  startDate: z.string().nullable(),
  completionDate: z.string().nullable(),
  notes: z.string(),
});

export const grnItemSchema = z.object({
  partId: z.string().min(1, "Part number is required"),
  alternatePartNumber: z.string(),
  serialNumber: z.string(),
  description: z.string().trim().min(1, "Description is required"),
  quantity: z.number().finite("Quantity must be a number").min(0, "Quantity cannot be negative"),
  supplierBatchNumber: z.string(),
  purchaseCostEa: z.number().finite("Cost cannot be invalid").min(0, "Cost cannot be negative"),
  locationId: z.string().nullable(),
  workpackId: z.string().nullable(),
  notes: z.string(),
});

export const grnSchema = z.object({
  grnNumber: z.string().trim().min(1, "GRN number is required"),
  date: z.string().min(1, "Date is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  invoice: z.string(),
  supplierTrackingReference: z.string(),
  supplierBatchNumber: z.string(),
  workpackId: z.string().nullable(),
  registration: z.string(),
  sheetNumber: z.number().int().min(1),
  totalSheets: z.number().int().min(1),
  notes: z.string(),
  items: z.array(grnItemSchema).min(1, "Add at least one GRN item"),
});

export const costingLineSchema = z.object({
  grnItemId: z.string().min(1),
  pricingMethod: z.enum(["AUTOMATIC", "MANUAL_OVERRIDE", "POA"]),
  salePriceEa: z.number().finite().min(0, "Sale price cannot be invalid").nullable(),
  notes: z.string(),
});

export const pricingRuleSchema = z.object({
  label: z.string().trim().min(1, "Label is required"),
  minCost: z.number().finite().min(0),
  maxCost: z.number().finite().min(0).nullable(),
  multiplier: z.number().finite().positive().nullable(),
  isPoa: z.boolean(),
  active: z.boolean(),
  priority: z.number().int().min(1),
});

export const stockIssueSchema = z.object({
  partId: z.string().min(1),
  quantity: z.number().finite().positive("Quantity must be greater than zero"),
  type: z.enum(["ISSUE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT", "RETURN", "TRANSFER"]),
  workpackId: z.string().nullable(),
  locationId: z.string().nullable(),
  notes: z.string(),
});

export const settingsSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  companyAddress: z.string(),
  companyPhone: z.string(),
  companyEmail: z.string(),
  grnPrefix: z.string().trim().min(1),
  autoGrnNumber: z.boolean(),
  nextGrnSequence: z.number().int().min(1),
});

export type PartFormValues = z.infer<typeof partSchema>;
export type SupplierFormValues = z.infer<typeof supplierSchema>;
export type LocationFormValues = z.infer<typeof locationSchema>;
export type WorkpackFormValues = z.infer<typeof workpackSchema>;
export type GrnFormValues = z.infer<typeof grnSchema>;
export type GrnItemFormValues = z.infer<typeof grnItemSchema>;
export type CostingLineFormValues = z.infer<typeof costingLineSchema>;
export type PricingRuleFormValues = z.infer<typeof pricingRuleSchema>;
export type StockIssueFormValues = z.infer<typeof stockIssueSchema>;
export type SettingsFormValues = z.infer<typeof settingsSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
