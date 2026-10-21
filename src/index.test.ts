import { describe, it, expect } from "vitest";
import { resolveZone, offsetMinutes, formatOffset, zonedToInstant, parseInput, convert, table, wallClock, ZoneError } from "./index.js";

describe("resolveZone", () => {
  it("resolves aliases and IANA names", () => {
    expect(resolveZone("tlv")).toBe("Asia/Jerusalem");
    expect(resolveZone("New York")).toBe("America/New_York");
    expect(resolveZone("Europe/Paris")).toBe("Europe/Paris");
    expect(resolveZone("UTC")).toBe("UTC");
  });
  it("throws on unknown zones", () => {
    expect(() => resolveZone("Mars/Olympus")).toThrow(ZoneError);
  });
});

describe("offsets", () => {
  it("knows DST", () => {
    expect(offsetMinutes(new Date("2026-07-01T12:00:00Z"), "America/New_York")).toBe(-240);
    expect(offsetMinutes(new Date("2026-01-01T12:00:00Z"), "America/New_York")).toBe(-300);
    expect(offsetMinutes(new Date("2026-01-01T12:00:00Z"), "Asia/Kolkata")).toBe(330);
    expect(formatOffset(330)).toBe("+05:30");
    expect(formatOffset(-240)).toBe("-04:00");
  });
});

describe("zonedToInstant", () => {
  it("converts wall clock to instant", () => {
    const d = zonedToInstant({ year: 2026, month: 11, day: 10, hour: 15, minute: 0, second: 0 }, "America/New_York");
    expect(d.toISOString()).toBe("2026-11-10T20:00:00.000Z"); // EST, UTC-5
  });
  it("moves forward through a DST gap", () => {
    // 2026-03-08 02:30 does not exist in New York (clocks jump 02:00 -> 03:00)
    const d = zonedToInstant({ year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 }, "America/New_York");
    const w = wallClock(d, "America/New_York");
    expect(`${w.hour}:${w.minute}`).toBe("3:30");
  });
  it("takes the earlier offset in a DST overlap", () => {
    // 2026-11-01 01:30 happens twice in New York; the first time is EDT (UTC-4)
    const d = zonedToInstant({ year: 2026, month: 11, day: 1, hour: 1, minute: 30, second: 0 }, "America/New_York");
    expect(d.toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });
  it("handles southern-hemisphere gaps", () => {
    // Sydney springs forward 2026-10-04 02:00 -> 03:00
    const d = zonedToInstant({ year: 2026, month: 10, day: 4, hour: 2, minute: 15, second: 0 }, "Australia/Sydney");
    const w = wallClock(d, "Australia/Sydney");
    expect(`${w.hour}:${w.minute}`).toBe("3:15");
  });
});

describe("parseInput", () => {
  const now = new Date("2026-10-21T18:00:00Z"); // 14:00 in New York
  it("parses full timestamps", () => {
    expect(parseInput("2026-11-10 15:00", "America/New_York", now).toISOString()).toBe("2026-11-10T20:00:00.000Z");
    expect(parseInput("2026-11-10T09:30:15", "UTC", now).toISOString()).toBe("2026-11-10T09:30:15.000Z");
  });
  it("parses bare times as today in the source zone", () => {
    expect(parseInput("15:00", "America/New_York", now).toISOString()).toBe("2026-10-21T19:00:00.000Z");
    expect(parseInput("3pm", "America/New_York", now).toISOString()).toBe("2026-10-21T19:00:00.000Z");
    expect(parseInput("9:30am", "Europe/London", now).toISOString()).toBe("2026-10-21T08:30:00.000Z");
    expect(parseInput("12am", "UTC", now).toISOString()).toBe("2026-10-21T00:00:00.000Z");
    expect(parseInput("12pm", "UTC", now).toISOString()).toBe("2026-10-21T12:00:00.000Z");
  });
  it("returns now for now", () => {
    expect(parseInput("now", "UTC", now)).toBe(now);
  });
  it("rejects junk", () => {
    expect(() => parseInput("tomorrow-ish", "UTC", now)).toThrow(ZoneError);
    expect(() => parseInput("13pm", "UTC", now)).toThrow(ZoneError);
    expect(() => parseInput("25:00", "UTC", now)).toThrow(ZoneError);
  });
});

describe("convert", () => {
  const instant = new Date("2026-11-10T20:00:00Z"); // 15:00 New York (EST)
  it("lists the source first and marks day changes", () => {
    const rows = convert(instant, "nyc", ["london", "tlv", "tokyo", "la"]);
    expect(rows.map((r) => r.zone)).toEqual(["America/New_York", "Europe/London", "Asia/Jerusalem", "Asia/Tokyo", "America/Los_Angeles"]);
    expect(rows.map((r) => r.time)).toEqual(["15:00", "20:00", "22:00", "05:00", "12:00"]);
    expect(rows.map((r) => r.dayDelta)).toEqual([0, 0, 0, 1, 0]);
    expect(rows[0].abbreviation).toBe("EST");
    expect(rows[2].offset).toBe("+02:00");
    expect(rows[3].time12).toBe("5:00 AM");
    expect(rows[3].date).toBe("2026-11-11");
    expect(rows[0].weekday).toBe("Tue");
  });
  it("marks the previous day", () => {
    const rows = convert(new Date("2026-11-10T02:00:00Z"), "tokyo", ["la"]);
    expect(rows[1].dayDelta).toBe(-1);
  });
});

describe("table", () => {
  it("renders aligned rows", () => {
    const rows = convert(new Date("2026-11-10T20:00:00Z"), "nyc", ["tokyo"]);
    const text = table(rows);
    expect(text.split("\n")).toHaveLength(2);
    expect(text).toContain("America/New_York  Tue 2026-11-10  15:00  EST (UTC-05:00)");
    expect(text).toContain("Asia/Tokyo        Wed 2026-11-11  05:00  GMT+9 (UTC+09:00)  (+1 day)");
  });
});
