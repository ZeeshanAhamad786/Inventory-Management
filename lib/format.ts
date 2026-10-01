import { format, parseISO, isValid } from "date-fns";

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const gbpCompact = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFmt = new Intl.NumberFormat("en-GB", {
  maximumFractionDigits: 2,
});

export function formatGbp(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return gbp.format(value);
}

export function formatGbpOrPoa(value: number | null | undefined, isPoa = false) {
  if (isPoa || value === null || value === undefined) return "POA";
  if (!Number.isFinite(value)) return "—";
  return gbp.format(value);
}

export function formatCompactGbp(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return gbpCompact.format(value);
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return numberFmt.format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "POA / Not calculated";
  }
  return `${value.toFixed(1)}%`;
}

export function formatUkDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(date)) return "—";
  return format(date, "dd/MM/yyyy");
}

export function formatUkDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? parseISO(value) : value;
  if (!isValid(date)) return "—";
  return format(date, "dd/MM/yyyy HH:mm");
}

export function toDateInputValue(value: string | null | undefined) {
  if (!value) return "";
  const date = parseISO(value);
  if (!isValid(date)) return value.slice(0, 10);
  return format(date, "yyyy-MM-dd");
}

export function fromDateInputValue(value: string) {
  if (!value) return new Date().toISOString();
  return new Date(`${value}T12:00:00`).toISOString();
}

/** Parse typed UK dates like 17/09/2026 into ISO, or null if incomplete/invalid. */
export function parseUkDateInput(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:00:00`;
  const date = parseISO(iso);
  if (!isValid(date)) return null;
  return date.toISOString();
}

export function csvEscape(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}
