import fs from "node:fs";

const file = "react-app/migration/parity-verification-matrix.json";
const matrix = JSON.parse(fs.readFileSync(file, "utf8"));

function route(path) {
  const row = matrix.routes.find(item => item.route === path);
  if (!row) throw new Error(`MATRIX_ROUTE_NOT_FOUND:${path}`);
  return row;
}
function action(routePath, id) {
  const row = route(routePath);
  const item = row.actionInventory.find(entry => entry.id === id);
  if (!item) throw new Error(`MATRIX_ACTION_NOT_FOUND:${routePath}:${id}`);
  return item;
}
function addNote(row, note) {
  row.notes ||= [];
  if (!row.notes.includes(note)) row.notes.push(note);
}

for (const row of matrix.routes.filter(item => item.priority === "P0")) {
  row.requiredDimensions.routeAccess = "pass";
  addNote(row, "BROWSER_SMOKE: React route rendered or enforced the expected anonymous auth redirect in Playwright.");
}

const passwordToggle = action("/login", "togglePasswordBtn");
Object.assign(passwordToggle, {
  actorRole: "anonymous",
  precondition: "Login page is open.",
  masterBehavior: "Toggle password field between masked and visible states.",
  reactBehavior: "Toggles #password type between password and text and back.",
  expectedUiResult: "Password visibility changes without navigation or authentication.",
  expectedDataMutation: "none",
  failureBehavior: "No Firebase call or navigation is allowed.",
  browserCoverage: "pass",
  dataVerification: "not_applicable",
});

const loginButton = action("/login", "loginButton");
Object.assign(loginButton, {
  actorRole: "anonymous",
  precondition: "Login form is open.",
  masterBehavior: "Validate required credentials, then authenticate staff and route by role/scope.",
  reactBehavior: "Shared Laravel-style validation blocks invalid form; valid credentials call authenticateStaff.",
  expectedUiResult: "Invalid fields show inline feedback; valid login routes to the allowed target.",
  expectedDataMutation: "Authentication session only; no business document mutation.",
  failureBehavior: "Invalid/failed authentication stays on login and shows localized error feedback.",
  browserCoverage: "partial",
  dataVerification: "not_applicable",
});
addNote(route("/login"), "BROWSER_ACTION: login validation, password visibility, and locale switch pass; successful Firebase authentication remains pending isolated emulator coverage.");

const sound = action("/waiting-queue/display", "waitingDisplaySound");
Object.assign(sound, {
  actorRole: "public",
  precondition: "Public queue display is open.",
  masterBehavior: "Enable/disable queue announcement audio after a user gesture.",
  reactBehavior: "Arms audio and persists waiting_queue_display_sound preference.",
  expectedUiResult: "Sound control remains usable and audio preference is persisted.",
  expectedDataMutation: "localStorage only",
  failureBehavior: "Unsupported/blocked audio must not crash the display.",
  browserCoverage: "pass",
  dataVerification: "not_applicable",
});

const fullscreen = action("/waiting-queue/display", "waitingDisplayFullscreen");
Object.assign(fullscreen, {
  actorRole: "public",
  precondition: "Public queue display is open.",
  masterBehavior: "Enter or leave fullscreen display mode.",
  reactBehavior: "Calls requestFullscreen/exitFullscreen and safely ignores browser denial.",
  expectedUiResult: "Control remains usable with no uncaught error if fullscreen is denied.",
  expectedDataMutation: "none",
  failureBehavior: "Fullscreen API denial must not crash the page.",
  browserCoverage: "pass",
  dataVerification: "not_applicable",
});
addNote(route("/waiting-queue/display"), "BROWSER_ACTION: sound opt-in and fullscreen safety pass; live queue/audio data scenarios remain pending isolated data fixtures.");

addNote(route("/waiting-queue/customer"), "BROWSER_SMOKE: invalid-token failure state and desktop/tablet/mobile viewport containment pass; valid-token response actions remain pending isolated Firestore coverage.");

matrix.updatedAt = "2026-09-29";
fs.writeFileSync(file, JSON.stringify(matrix, null, 2) + "\n");
console.log("P0 browser coverage metadata updated.");
