# tzwhen

"3pm New York is what time in Tel Aviv, London and Tokyo?" — answered in your terminal, with
day changes marked. Uses only the built-in `Intl` API: zero dependencies, no time zone database
to ship or update.

```
$ tzwhen "2026-11-10 15:00" --from nyc --to london tlv tokyo la
America/New_York     Tue 2026-11-10  15:00  EST (UTC-05:00)
Europe/London        Tue 2026-11-10  20:00  GMT (UTC+00:00)
Asia/Jerusalem       Tue 2026-11-10  22:00  GMT+2 (UTC+02:00)
Asia/Tokyo           Wed 2026-11-11  05:00  GMT+9 (UTC+09:00)  (+1 day)
America/Los_Angeles  Tue 2026-11-10  12:00  PST (UTC-08:00)
```

## Install

```sh
npm install -g tzwhen     # CLI
npm install tzwhen        # library
```

## CLI

```
tzwhen <time> [--from <zone>] --to <zone> [<zone>...] [--12h] [--json]
```

- `<time>`: `"2026-11-10 15:00"`, `15:00`, `3pm`, `9:30am` or `now`. A time without a date means today in the source zone.
- `<zone>`: an IANA name (`Europe/Paris`) or a short alias — `nyc`, `la`, `sf`, `chicago`, `london`, `paris`, `berlin`, `tlv`, `dubai`, `india`, `singapore`, `hk`, `tokyo`, `sydney`, `utc` and ~90 more (`tzwhen --aliases`).
- `--from` defaults to the machine's own zone.
- `--12h` prints 12-hour times; `--json` prints the rows as JSON.
- Exit code 2 with a readable message for an unknown zone or unparsable time.

## Library

```ts
import { convert, parseInput, resolveZone, offsetMinutes, zonedToInstant } from "tzwhen";

const instant = parseInput("2026-11-10 15:00", "America/New_York");
convert(instant, "nyc", ["tlv", "tokyo"]);
// [
//   { zone: "America/New_York", date: "2026-11-10", time: "15:00", time12: "3:00 PM", abbreviation: "EST", offset: "-05:00", dayDelta: 0, weekday: "Tue" },
//   { zone: "Asia/Jerusalem",   date: "2026-11-10", time: "22:00", ... dayDelta: 0 },
//   { zone: "Asia/Tokyo",       date: "2026-11-11", time: "05:00", ... dayDelta: 1 },
// ]

resolveZone("tlv");                                   // "Asia/Jerusalem"
offsetMinutes(new Date(), "Asia/Kolkata");            // 330
zonedToInstant({ year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0 }, "America/New_York");
// 02:30 doesn't exist that night (DST gap) -> moves forward to 03:30, like calendar apps do
```

## Notes

- Daylight saving is handled by `Intl`, so results follow the time zone data in your Node/ICU build.
- Non-existent wall-clock times (DST gaps) move forward; ambiguous ones (DST overlaps) take the earlier offset.

## Development

```sh
npm install
npm test
npm run build
```

## License

MIT © Yosef Ehrenfeld
