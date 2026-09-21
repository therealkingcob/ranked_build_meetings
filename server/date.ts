export function todayIso(): string {
  return formatDate(new Date());
}

export function todayIsoInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function addDays(iso: string, amount: number): string {
  const date = dateFromIso(iso);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatDate(date);
}

export function startOfWeek(iso: string): string {
  const date = dateFromIso(iso);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return addDays(iso, -mondayOffset);
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return formatDate(dateFromIso(value)) === value;
}

export function formatLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(dateFromIso(iso));
}

export function formatShortLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(dateFromIso(iso));
}

function dateFromIso(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function formatDate(date: Date): string {
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
}
