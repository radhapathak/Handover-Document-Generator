// Prints the ServiceNow table definitions (Markdown) from lib/servicenow/schema.ts.
// Requires Node 22.18+ (built-in TypeScript type stripping). Used to build SERVICE_NOW_SETUP.md.
import { TABLES } from "../lib/servicenow/schema.ts";

const prefix = process.env.SERVICENOW_TABLE_PREFIX || "x_hai";
const SN_TYPE = { string: "String", number: "Integer", decimal: "Decimal", boolean: "True/False", json: "String (JSON)", reference: "Reference", datetime: "Date/Time", choice: "Choice" };
let out = "";
let n = 1;
for (const [key, t] of Object.entries(TABLES)) {
  out += `### ${n++}. ${t.label} — \`${prefix}_${key}\`\n\n`;
  if (t.autoNumber) out += `Auto-number: prefix **${t.autoNumber}**, 7 digits (Table → Controls → Auto-number).\n\n`;
  out += "| Column label | Column name | Type | Max length | Reference / Choices | Mandatory | Index |\n|---|---|---|---|---|---|---|\n";
  for (const f of Object.values(t.fields)) {
    const extra = f.reference ? `\`${prefix}_${f.reference}\`` : f.choices ? f.choices.map((c) => `\`${c}\``).join(", ") : "";
    const len = f.type === "string" || f.type === "json" ? String(f.maxLength ?? "") : "";
    out += `| ${f.label} | \`${f.column}\` | ${SN_TYPE[f.type]} | ${len} | ${extra} | ${f.mandatory ? "Yes" : ""} | ${f.indexed ? "Yes" : ""} |\n`;
  }
  out += "\n";
}
process.stdout.write(out);
