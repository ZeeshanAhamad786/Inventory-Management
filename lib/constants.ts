export const COMPANY_DEFAULT_NAME = "Ash Aviation Stores";

export const DEMO_LOGIN = {
  email: "admin@demo.local",
  password: "admin123",
};

export const PART_CATEGORIES = [
  "Fasteners",
  "Washers",
  "Bolts",
  "Filters",
  "Fluids",
  "Ignition",
  "Seals",
  "Hardware",
  "Consumables",
  "Other",
] as const;

export const UNITS_OF_MEASURE = ["EA", "BOX", "LTR", "KIT", "SET", "M", "KG"] as const;

export const GRN_STATUSES = ["draft", "received", "cancelled", "archived"] as const;

export const WORKPACK_STATUSES = [
  "open",
  "in_progress",
  "completed",
  "cancelled",
  "archived",
] as const;

export const MOVEMENT_TYPES = [
  "RECEIPT",
  "ISSUE",
  "ADJUSTMENT_IN",
  "ADJUSTMENT_OUT",
  "RETURN",
  "TRANSFER",
] as const;

export const DOCUMENT_TYPES = [
  "invoice",
  "delivery_note",
  "certificate",
  "photo",
  "other",
] as const;

export const SIDEBAR_WIDTH = 272;
export const SIDEBAR_COLLAPSED_WIDTH = 72;
