import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "react-app", "src");
const indexSource = fs.readFileSync(path.join(root, "functions", "index.js"), "utf8");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const referenced = new Map();
for (const file of walk(sourceRoot).filter(file => /\.(?:js|jsx)$/.test(file))) {
  const source = fs.readFileSync(file, "utf8");
  const patterns = [
    /httpsCallable\(functions,\s*["']([^"']+)["']/g,
    /\bcall\(\s*["']([^"']+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const name = match[1];
      if (!referenced.has(name)) referenced.set(name, new Set());
      referenced.get(name).add(path.relative(root, file));
    }
  }
}

const exported = new Set(
  [...indexSource.matchAll(/exports\.([A-Za-z0-9_]+)\s*=/g)].map(match => match[1]),
);

const missing = [...referenced.keys()].filter(name => !exported.has(name)).sort();
if (missing.length) {
  console.error("React callable contract: FAIL");
  for (const name of missing) {
    console.error(`- ${name}: ${[...referenced.get(name)].join(", ")}`);
  }
  process.exit(1);
}

console.log("React callable contract: PASS");
console.log(`React callable references: ${referenced.size} | Missing Functions exports: 0`);
