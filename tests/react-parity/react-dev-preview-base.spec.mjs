import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const config = fs.readFileSync("vite.react.config.js", "utf8");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const entry = fs.readFileSync("react-app/src/main.jsx", "utf8");
const firebase = fs.readFileSync("react-app/src/firebase/client.js", "utf8");

test("Vite development serves canonical React routes while production build stays /react/", () => {
  assert.match(config, /base: command === "serve" \? "\/" : "\/react\/"/);
  assert.match(config, /publicDir: command === "serve" \? hostingPublicDir : undefined/);
  assert.match(config, /new URL\("\.\/public", import\.meta\.url\)/);
  assert.match(config, /port: 5174, strictPort: true/);
  assert.match(entry, /const reactAlias = location\.pathname === "\/react"/);
  assert.match(entry, /location\.replace\(/);
});

test("dedicated Finance browser demo script uses both explicit emulator opt-ins", () => {
  const command = pkg.scripts["dev:react:hybrid-demo"];
  assert.ok(command && command.includes("VITE_USE_FIREBASE_EMULATORS=true"));
  assert.ok(command.includes("VITE_HYBRID_DEMO_PAYMENT_E2E=true"));
  assert.ok(command.includes("--strictPort"));
  assert.equal(pkg.scripts["dev:react"], "vite --config vite.react.config.js");
  assert.match(firebase, /import\.meta\.env\.DEV === true/);
  assert.match(firebase, /projectId: "demo-penguin-hybrid"/);
});
