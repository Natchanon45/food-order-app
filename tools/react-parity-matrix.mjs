import fs from "node:fs";
import path from "node:path";

const readJson = file => JSON.parse(fs.readFileSync(file, "utf8"));
const registry = readJson("react-app/migration/master-registry.json");
const matrix = readJson("react-app/migration/parity-verification-matrix.json");

const requiredDimensions = [
  "routeAccess",
  "visual",
  "actions",
  "dataSideEffects",
  "failurePaths",
  "languages",
  "responsive",
];

const fail = message => {
  console.error(`React parity matrix: FAIL — ${message}`);
  process.exit(1);
};
const canonicalEntry = route => route === "/" ? "public/index.html" : path.join("public", route.replace(/^\//, ""), "index.html");
const canonicalIsReact = route => {
  const file = canonicalEntry(route);
  if (!fs.existsSync(file)) return false;
  return /\/react\/assets\/index-|\/react\/src\/main\.jsx/.test(fs.readFileSync(file, "utf8"));
};

if (!Array.isArray(registry.routes) || !Array.isArray(matrix.routes)) {
  fail("registry/matrix routes must be arrays");
}

const registryRoutes = new Map(registry.routes.map(item => [item.route, item]));
const matrixRoutes = new Map(matrix.routes.map(item => [item.route, item]));

for (const route of registryRoutes.keys()) {
  if (!matrixRoutes.has(route)) fail(`missing verification record for ${route}`);
}
for (const route of matrixRoutes.keys()) {
  if (!registryRoutes.has(route)) fail(`matrix contains unknown route ${route}`);
}

for (const [route, record] of matrixRoutes) {
  if (!["P0", "P1", "P2"].includes(record.priority)) {
    fail(`${route} has invalid priority`);
  }
  if (!record.requiredDimensions || typeof record.requiredDimensions !== "object") {
    fail(`${route} is missing requiredDimensions`);
  }
  for (const dimension of requiredDimensions) {
    if (!["pending", "pass", "not_applicable"].includes(record.requiredDimensions[dimension])) {
      fail(`${route} has invalid/missing dimension ${dimension}`);
    }
  }
  if (!Array.isArray(record.actionInventory)) {
    fail(`${route} actionInventory must be an array`);
  }

  if (record.verificationStatus === "verified") {
    if (!canonicalIsReact(route)) fail(`${route} is verified but canonical entry is not React`);
    const incomplete = requiredDimensions.filter(
      dimension => !["pass", "not_applicable"].includes(record.requiredDimensions[dimension]),
    );
    if (incomplete.length) {
      fail(`${route} is verified but dimensions remain incomplete: ${incomplete.join(", ")}`);
    }
    if (matrix.policy?.verifiedRequiresActionInventory && record.actionInventory.length === 0) {
      fail(`${route} is verified without an action inventory`);
    }
    for (const action of record.actionInventory) {
      if (!action?.id || !action?.label) {
        fail(`${route} has a verified action without id/label`);
      }
      if (!["pass", "not_applicable"].includes(action.browserCoverage)) {
        fail(`${route} action ${action.id} lacks browser coverage`);
      }
      if (!["pass", "not_applicable"].includes(action.dataVerification)) {
        fail(`${route} action ${action.id} lacks data verification`);
      }
    }
  }
}

const counts = {};
for (const record of matrix.routes) {
  const key = `${record.priority}:${record.verificationStatus}`;
  counts[key] = (counts[key] || 0) + 1;
}
const verified = matrix.routes.filter(record => record.verificationStatus === "verified").length;
const inventoried = matrix.routes.filter(record => record.actionInventory.length > 0).length;

console.log("React parity matrix: PASS");
console.log(`Routes: ${matrix.routes.length} | Action inventories started: ${inventoried} | Verified: ${verified}`);
Object.entries(counts).sort().forEach(([key, value]) => console.log(`${key} = ${value}`));
