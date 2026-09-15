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

export function csvEscape(value: unknown) {
  const raw = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(raw)) {
    return `"${raw.replaceAll('"', '""')}"`;
  }
  return raw;
}
