import "server-only";

const FALLBACK_TIME_ZONE = "UTC";

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

const configuredTimeZone = process.env.DESK_TIMEZONE?.trim();
const timeZone =
  configuredTimeZone && validTimeZone(configuredTimeZone)
    ? configuredTimeZone
    : FALLBACK_TIME_ZONE;

if (configuredTimeZone && timeZone !== configuredTimeZone) {
  console.warn(
    `[desk] DESK_TIMEZONE "${configuredTimeZone}" is not a valid IANA time zone. Falling back to UTC.`,
  );
}

export const DESK_TIME_ZONE = timeZone;

function dateParts(date: Date): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DESK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

/** The calendar date at the desk, not the server's UTC date. */
export function deskDateKey(date = new Date()): string {
  const { year, month, day } = dateParts(date);
  return `${year}-${month}-${day}`;
}

/** Monday of the week containing a desk calendar date (YYYY-MM-DD). */
export function deskWeekStartKeyFromDateKey(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  const calendarDate = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 12));
  const weekday = calendarDate.getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  calendarDate.setUTCDate(calendarDate.getUTCDate() - daysSinceMonday);
  return [
    calendarDate.getUTCFullYear(),
    String(calendarDate.getUTCMonth() + 1).padStart(2, "0"),
    String(calendarDate.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/** Monday of the desk's current week as a YYYY-MM-DD key. */
export function deskWeekStartKey(date = new Date()): string {
  return deskWeekStartKeyFromDateKey(deskDateKey(date));
}
