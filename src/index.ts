/**
 * tzwhen — convert a time across time zones using only the Intl API.
 * Zero dependencies; works in Node 18+ and modern browsers.
 */

export const ALIASES: Record<string, string> = {
  utc: "UTC", gmt: "UTC", z: "UTC",
  nyc: "America/New_York", ny: "America/New_York", newyork: "America/New_York", est: "America/New_York", et: "America/New_York", miami: "America/New_York", boston: "America/New_York", toronto: "America/Toronto",
  chicago: "America/Chicago", ct: "America/Chicago", cst: "America/Chicago", dallas: "America/Chicago", austin: "America/Chicago",
  denver: "America/Denver", mt: "America/Denver", phoenix: "America/Phoenix",
  la: "America/Los_Angeles", losangeles: "America/Los_Angeles", sf: "America/Los_Angeles", seattle: "America/Los_Angeles", pt: "America/Los_Angeles", pst: "America/Los_Angeles",
  honolulu: "Pacific/Honolulu", anchorage: "America/Anchorage",
  mexico: "America/Mexico_City", bogota: "America/Bogota", lima: "America/Lima", saopaulo: "America/Sao_Paulo", buenosaires: "America/Argentina/Buenos_Aires",
  london: "Europe/London", uk: "Europe/London", dublin: "Europe/Dublin", lisbon: "Europe/Lisbon",
  paris: "Europe/Paris", berlin: "Europe/Berlin", madrid: "Europe/Madrid", rome: "Europe/Rome", amsterdam: "Europe/Amsterdam", zurich: "Europe/Zurich", vienna: "Europe/Vienna", stockholm: "Europe/Stockholm", warsaw: "Europe/Warsaw", cet: "Europe/Berlin",
  athens: "Europe/Athens", kyiv: "Europe/Kyiv", istanbul: "Europe/Istanbul", moscow: "Europe/Moscow",
  tlv: "Asia/Jerusalem", telaviv: "Asia/Jerusalem", jerusalem: "Asia/Jerusalem", israel: "Asia/Jerusalem",
  dubai: "Asia/Dubai", riyadh: "Asia/Riyadh", tehran: "Asia/Tehran", karachi: "Asia/Karachi",
  india: "Asia/Kolkata", ist: "Asia/Kolkata", mumbai: "Asia/Kolkata", delhi: "Asia/Kolkata", bangalore: "Asia/Kolkata",
  bangkok: "Asia/Bangkok", jakarta: "Asia/Jakarta", singapore: "Asia/Singapore", sg: "Asia/Singapore", kl: "Asia/Kuala_Lumpur", manila: "Asia/Manila",
  hk: "Asia/Hong_Kong", hongkong: "Asia/Hong_Kong", shanghai: "Asia/Shanghai", beijing: "Asia/Shanghai", china: "Asia/Shanghai", taipei: "Asia/Taipei",
  tokyo: "Asia/Tokyo", japan: "Asia/Tokyo", jst: "Asia/Tokyo", seoul: "Asia/Seoul",
  sydney: "Australia/Sydney", melbourne: "Australia/Melbourne", brisbane: "Australia/Brisbane", perth: "Australia/Perth", auckland: "Pacific/Auckland", nz: "Pacific/Auckland",
  johannesburg: "Africa/Johannesburg", cairo: "Africa/Cairo", lagos: "Africa/Lagos", nairobi: "Africa/Nairobi",
};

export class ZoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZoneError";
  }
}

/** Resolve an alias ("tlv", "NYC") or IANA name to a canonical IANA zone. Throws ZoneError if unknown. */
export function resolveZone(input: string): string {
  const key = input.trim().toLowerCase().replace(/[\s_-]/g, "");
  const candidate = ALIASES[key] ?? input.trim();
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: candidate }).resolvedOptions().timeZone;
  } catch {
    throw new ZoneError(`Unknown time zone "${input}". Use an IANA name like Europe/Paris or an alias like "tlv".`);
  }
}

interface Parts { year: number; month: number; day: number; hour: number; minute: number; second: number }

const partsCache = new Map<string, Intl.DateTimeFormat>();
function formatter(zone: string): Intl.DateTimeFormat {
  let f = partsCache.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    partsCache.set(zone, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a zone. */
export function wallClock(instant: Date, zone: string): Parts {
  const p: Record<string, number> = {};
  for (const { type, value } of formatter(zone).formatToParts(instant)) {
    if (type !== "literal") p[type] = Number(value);
  }
  return { year: p.year, month: p.month, day: p.day, hour: p.hour === 24 ? 0 : p.hour, minute: p.minute, second: p.second };
}

/** Offset of a zone from UTC at an instant, in minutes (e.g. -240 for EDT). */
export function offsetMinutes(instant: Date, zone: string): number {
  const w = wallClock(instant, zone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** Format an offset as "+05:30" / "-04:00". */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${h < 10 ? "0" : ""}${h}:${m < 10 ? "0" : ""}${m}`;
}

/** Short zone label like "EDT", "GMT+3", "IST". */
export function abbreviation(instant: Date, zone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "short" }).formatToParts(instant);
  return parts.find((p) => p.type === "timeZoneName")?.value ?? formatOffset(offsetMinutes(instant, zone));
}

/**
 * Interpret a wall-clock time in a zone and return the instant. Handles DST
 * gaps (moves forward) and overlaps (takes the earlier offset) the way most
 * calendar apps do.
 */
export function zonedToInstant(parts: Parts, zone: string): Date {
  const guess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const same = (w: Parts) => w.hour === parts.hour && w.minute === parts.minute && w.day === parts.day;
  const off1 = offsetMinutes(new Date(guess), zone);
  const inst1 = guess - off1 * 60_000;
  const off2 = offsetMinutes(new Date(inst1), zone);
  if (off1 === off2) return new Date(inst1);
  const inst2 = guess - off2 * 60_000;
  if (same(wallClock(new Date(inst2), zone))) return new Date(inst2);
  if (same(wallClock(new Date(inst1), zone))) return new Date(inst1);
  // DST gap: the wall-clock time never happened; move forward using the pre-transition offset.
  return new Date(guess - Math.min(off1, off2) * 60_000);
}

const INPUT_RE = /^(?:(\d{4})-(\d{2})-(\d{2})[ T]?)?(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(am|pm)?$/i;

/**
 * Parse "2026-11-10 15:00", "2026-11-10T09:30:00", "15:00", "3pm", "9:30am" or
 * "now". A date-less time means today in the source zone.
 */
export function parseInput(text: string, zone: string, now: Date = new Date()): Date {
  const t = text.trim();
  if (t.toLowerCase() === "now") return now;
  const m = INPUT_RE.exec(t);
  if (!m) throw new ZoneError(`Cannot parse time "${text}". Try "2026-11-10 15:00", "15:00" or "3pm".`);
  const today = wallClock(now, zone);
  let hour = Number(m[4]);
  const ampm = m[7]?.toLowerCase();
  if (ampm) {
    if (hour < 1 || hour > 12) throw new ZoneError(`Hour ${hour} is not valid with ${ampm}`);
    if (ampm === "pm" && hour !== 12) hour += 12;
    if (ampm === "am" && hour === 12) hour = 0;
  }
  if (hour > 23) throw new ZoneError(`Hour ${hour} is out of range`);
  const minute = Number(m[5] ?? 0);
  const second = Number(m[6] ?? 0);
  if (minute > 59 || second > 59) throw new ZoneError(`Minutes/seconds out of range in "${text}"`);
  const parts: Parts = {
    year: m[1] ? Number(m[1]) : today.year,
    month: m[2] ? Number(m[2]) : today.month,
    day: m[3] ? Number(m[3]) : today.day,
    hour, minute, second,
  };
  return zonedToInstant(parts, zone);
}

export interface Conversion {
  zone: string;
  /** "2026-11-10" */
  date: string;
  /** "15:00" (24h) */
  time: string;
  /** "3:00 PM" */
  time12: string;
  /** "EDT", "GMT+2" */
  abbreviation: string;
  /** "+05:30" */
  offset: string;
  /** Day difference relative to the source zone's date: -1, 0 or +1 */
  dayDelta: number;
  weekday: string;
}

function pad(n: number): string { return n < 10 ? `0${n}` : String(n); }

function dayNumber(p: Parts): number {
  return Math.floor(Date.UTC(p.year, p.month - 1, p.day) / 86_400_000);
}

/** Describe one instant in several zones, relative to a source zone. */
export function convert(instant: Date, fromZone: string, toZones: string[]): Conversion[] {
  const from = resolveZone(fromZone);
  const base = wallClock(instant, from);
  const zones = [from, ...toZones.map(resolveZone)];
  return zones.map((zone) => {
    const w = wallClock(instant, zone);
    const h12 = w.hour % 12 === 0 ? 12 : w.hour % 12;
    const weekday = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short" }).format(instant);
    return {
      zone,
      date: `${w.year}-${pad(w.month)}-${pad(w.day)}`,
      time: `${pad(w.hour)}:${pad(w.minute)}`,
      time12: `${h12}:${pad(w.minute)} ${w.hour < 12 ? "AM" : "PM"}`,
      abbreviation: abbreviation(instant, zone),
      offset: formatOffset(offsetMinutes(instant, zone)),
      dayDelta: dayNumber(w) - dayNumber(base),
      weekday,
    };
  });
}

/** Render conversions as an aligned text table. */
export function table(rows: Conversion[], opts: { hour12?: boolean } = {}): string {
  const width = Math.max(...rows.map((r) => r.zone.length));
  return rows
    .map((r) => {
      const delta = r.dayDelta === 0 ? "" : r.dayDelta > 0 ? `  (+${r.dayDelta} day)` : `  (${r.dayDelta} day)`;
      return `${r.zone.padEnd(width)}  ${r.weekday} ${r.date}  ${opts.hour12 ? r.time12.padStart(8) : r.time}  ${r.abbreviation} (UTC${r.offset})${delta}`;
    })
    .join("\n");
}
