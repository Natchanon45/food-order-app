import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs.readFileSync("react-app/src/pages/AdminPage.jsx", "utf8");
test("category drag release persists the DOM order", () => {
  assert.match(source, /if \(event\.oldIndex === event\.newIndex\) return;/);
  assert.match(source, /setCategoryOrder\(nextOrder\);\s*void persistCategoryOrder\(nextOrder\);/);
  assert.match(source, /await saveAdminCategoryOrder\(tenant\.id, order\)/);
});
test("menu drag release persists IDs in the current category", () => {
  assert.match(source, /setMenus\(current => current\.map/);
  assert.match(source, /void persistItemOrder\(selectedSortCategory, ids\)/);
  assert.match(source, /await saveAdminMenuOrder\(tenant\.id, next\.category, next\.ids\)/);
});
test("both manual action labels are Save and duplicate submissions are guarded", () => {
  assert.match(source, /id="saveCategoryOrder"[^\n]+\{"บันทึก"\}/);
  assert.match(source, /id="saveItemOrder"[^\n]+\{"บันทึก"\}/);
  assert.match(source, /sortSaveInFlightRef\.current\.category/);
  assert.match(source, /sortSaveInFlightRef\.current\.item/);
});

test("a second reorder is queued while the previous save is pending", () => {
  assert.match(source, /sortPendingRef\.current\.category = \[\.\.\.nextOrder\]/);
  assert.match(source, /while \(sortPendingRef\.current\.category\)/);
  assert.match(source, /sortPendingRef\.current\.item = \{ category, ids: \[\.\.\.ids\] \}/);
  assert.match(source, /while \(sortPendingRef\.current\.item\)/);
});
