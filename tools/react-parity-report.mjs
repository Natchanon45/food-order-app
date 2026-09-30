import fs from "node:fs";
import path from "node:path";

const matrix = JSON.parse(fs.readFileSync("react-app/migration/parity-verification-matrix.json", "utf8"));

function canonicalEntry(route) {
  if (route === "/") return "public/index.html";
  return path.join("public", route.replace(/^\//, ""), "index.html");
}
function entryKind(route) {
  const file = canonicalEntry(route);
  if (!fs.existsSync(file)) return "missing";
  const source = fs.readFileSync(file, "utf8");
  return /\/react\/assets\/index-|\/react\/src\/main\.jsx/.test(source) ? "react" : "legacy";
}
function actionCounts(actions = []) {
  const count = key => actions.filter(action => action.browserCoverage === key).length;
  const data = key => actions.filter(action => action.dataVerification === key).length;
  return {
    total: actions.length,
    browserPass: count("pass"),
    browserPartial: count("partial"),
    browserPending: actions.filter(action => !["pass", "partial", "not_applicable"].includes(action.browserCoverage)).length,
    dataPass: data("pass"),
    dataPartial: data("partial"),
    dataPending: actions.filter(action => !["pass", "partial", "not_applicable"].includes(action.dataVerification)).length,
  };
}

const priority = process.argv[2] || "P0";
const rows = matrix.routes.filter(route => route.priority === priority);
console.log(`React parity report — ${priority}`);
console.log("route | canonical | access | actions | browser(pass/partial/pending) | data(pass/partial/pending) | status");
for (const row of rows) {
  const c = actionCounts(row.actionInventory);
  console.log([
    row.route,
    entryKind(row.route),
    row.requiredDimensions.routeAccess,
    c.total,
    `${c.browserPass}/${c.browserPartial}/${c.browserPending}`,
    `${c.dataPass}/${c.dataPartial}/${c.dataPending}`,
    row.verificationStatus,
  ].join(" | "));
}
const canonical = rows.reduce((acc, row) => {
  const kind = entryKind(row.route);
  acc[kind] = (acc[kind] || 0) + 1;
  return acc;
}, {});
console.log("\nCanonical:", canonical);
console.log("Verified:", rows.filter(row => row.verificationStatus === "verified").length, "/", rows.length);
