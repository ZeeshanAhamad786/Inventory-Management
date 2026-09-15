export type UserRole = "admin" | "stores" | "viewer";

export type EntityStatus = "active" | "inactive" | "cancelled" | "archived";

export type GrnStatus = "draft" | "received" | "cancelled" | "archived";

export type WorkpackStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "archived";

export type StockMovementType =
  | "RECEIPT"
  | "ISSUE"
  | "ADJUSTMENT_IN"
  | "ADJUSTMENT_OUT"
  | "RETURN"
  | "TRANSFER";

export type PricingMethod = "AUTOMATIC" | "MANUAL_OVERRIDE" | "POA";

export type DocumentType =
  | "invoice"
  | "delivery_note"
  | "certificate"
  | "photo"
  | "other";

export type ActivityAction =
  | "created"
  | "updated"
  | "cancelled"
  | "archived"
  | "restored"
  | "stock_received"
  | "stock_issued"
  | "stock_adjusted"
  | "price_changed"
  | "pricing_rule_changed"
  | "report_generated"
  | "imported"
  | "login";

export type EntityType =
  | "user"
  | "part"
  | "supplier"
  | "location"
  | "grn"
  | "grn_item"
  | "workpack"
  | "stock_movement"
  | "costing"
  | "pricing_rule"
  | "document"
  | "settings"
  | "report";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  password: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Part {
  id: string;
  partNumber: string;
  description: string;
  category: string;
  unitOfMeasure: string;
  defaultCost: number | null;
  defaultSalePrice: number | null;
  status: "active" | "inactive";
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlternatePartNumber {
  id: string;
  partId: string;
  alternateNumber: string;
  notes: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface Location {
  id: string;
  name: string;
  code: string;
  description: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface Workpack {
  id: string;
  workpackNumber: string;
  title: string;
  registration: string;
  status: WorkpackStatus;
  startDate: string | null;
  completionDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Grn {
  id: string;
  grnNumber: string;
  date: string;
  supplierId: string;
  invoice: string;
  supplierTrackingReference: string;
  supplierBatchNumber: string;
  workpackId: string | null;
  registration: string;
  sheetNumber: number;
  totalSheets: number;
  notes: string;
  status: GrnStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GrnItem {
  id: string;
  grnId: string;
  lineNumber: number;
  partId: string;
  alternatePartNumber: string;
  serialNumber: string;
  description: string;
  quantity: number;
  supplierBatchNumber: string;
  purchaseCostEa: number;
  locationId: string | null;
  workpackId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  partId: string;
  quantityChange: number;
  type: StockMovementType;
  referenceType: EntityType;
  referenceId: string;
  grnId: string | null;
  grnItemId: string | null;
  workpackId: string | null;
  locationId: string | null;
  date: string;
  userId: string;
  notes: string;
  createdAt: string;
}

export interface Costing {
  id: string;
  grnId: string;
  grnItemId: string;
  partId: string;
  quantity: number;
  purchaseCostEa: number;
  totalCost: number;
  pricingMethod: PricingMethod;
  pricingRuleId: string | null;
  salePriceEa: number | null;
  totalSale: number | null;
  profit: number | null;
  profitPercent: number | null;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PricingRule {
  id: string;
  label: string;
  minCost: number;
  maxCost: number | null;
  multiplier: number | null;
  isPoa: boolean;
  active: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentRecord {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  type: DocumentType;
  entityType: EntityType;
  entityId: string;
  reference: string;
  notes: string;
  data: Blob | ArrayBuffer | null;
  createdBy: string;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: ActivityAction;
  entityType: EntityType;
  entityId: string;
  reference: string;
  description: string;
  date: string;
}

export interface AppSettings {
  id: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  grnPrefix: string;
  autoGrnNumber: boolean;
  nextGrnSequence: number;
  updatedAt: string;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface PricingResult {
  method: PricingMethod;
  salePriceEa: number | null;
  ruleId: string | null;
  label: string;
  multiplier: number | null;
}

export interface CostingTotals {
  totalCost: number;
  totalSale: number | null;
  profit: number | null;
  profitPercent: number | null;
  poaCount: number;
}

export interface PartLookup {
  part: Part;
  alternates: string[];
  currentStock: number;
  lastSupplierName: string | null;
  lastCost: number | null;
}

export interface InventoryRow {
  partId: string;
  partNumber: string;
  alternateNumbers: string;
  description: string;
  category: string;
  currentQty: number;
  costPrice: number | null;
  stockCostValue: number | null;
  salePrice: number | null;
  potentialSaleValue: number | null;
  potentialProfit: number | null;
  locationNames: string;
  status: Part["status"];
  isPoa: boolean;
}

export interface DashboardStats {
  totalGrns: number;
  totalParts: number;
  totalStockQty: number;
  totalStockCostValue: number;
  potentialSalesValue: number;
  potentialProfit: number;
  supplierCount: number;
  activeWorkpacks: number;
  poaItems: number;
}
