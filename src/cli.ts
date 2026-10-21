#!/usr/bin/env node
import { convert, parseInput, resolveZone, table, ZoneError, ALIASES } from "./index.js";

const args = process.argv.slice(2);
const positional: string[] = [];
const to: string[] = [];
let from: string | undefined;
let json = false, hour12 = false;

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--from" || a === "-f") from = args[++i];
  else if (a === "--to" || a === "-t") { while (args[i + 1] && !args[i + 1].startsWith("-")) to.push(args[++i]); }
  else if (a === "--json") json = true;
  else if (a === "--12h") hour12 = true;
  else if (a === "--aliases") { console.log(Object.entries(ALIASES).map(([k, v]) => `${k.padEnd(14)} ${v}`).join("\n")); process.exit(0); }
  else if (a === "--help" || a === "-h") { help(); process.exit(0); }
  else positional.push(a);
}

function help() {
  console.log(`Usage: tzwhen <time> [--from <zone>] --to <zone> [<zone>...] [--12h] [--json]

<time>   "2026-11-10 15:00", "15:00", "3pm", "9:30am" or "now"
<zone>   IANA name (Europe/Paris) or alias (nyc, la, london, tlv, tokyo...) — see --aliases
--from   Source zone (default: this machine's zone)

Examples:
  tzwhen 3pm --from nyc --to london tlv tokyo
  tzwhen "2026-11-10 09:00" --from Europe/Berlin --to America/Los_Angeles --12h
  tzwhen now --to utc --json`);
}

const timeText = positional.join(" ") || "now";
if (to.length === 0) { help(); process.exit(1); }
try {
  const fromZone = resolveZone(from ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const instant = parseInput(timeText, fromZone);
  const rows = convert(instant, fromZone, to);
  if (json) console.log(JSON.stringify({ instant: instant.toISOString(), rows }, null, 2));
  else console.log(table(rows, { hour12 }));
} catch (err) {
  if (err instanceof ZoneError) { console.error(`tzwhen: ${err.message}`); process.exit(2); }
  throw err;
}
