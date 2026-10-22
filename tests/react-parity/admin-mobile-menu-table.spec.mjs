import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import * as JsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { chromium } from "playwright";
import { transformWithOxc } from "vite";

// Render the actual production component, not a hand-authored screenshot/fixture.
const componentFile = "react-app/src/components/AdminMobileEntityList.jsx";
const componentSource = readFileSync(componentFile, "utf8");
const adminSource = readFileSync("react-app/src/pages/AdminPage.jsx", "utf8");
const mobileCss = readFileSync("react-app/public/parity/css/admin-mobile-table.css", "utf8");

async function loadComponent() {
  const result = await transformWithOxc(componentSource, componentFile, { jsx: { runtime: "automatic" } });
  const js = result.code.replace(/^import.*$/gm, "")
    .replace(/^export const AdminMobileEntityList/m, "const AdminMobileEntityList");
  return new Function("React", "jsxRuntime",
    "const {memo}=React;const {jsx:_jsx,jsxs:_jsxs,Fragment:_Fragment}=jsxRuntime;" + js + ";return AdminMobileEntityList;",
  )(React, JsxRuntime);
}

const labels = {
  "admin.menu.active": "เปิดใช้งาน",
  "admin.menu.closed": "ปิดใช้งาน",
  "admin.table.active": "เปิดใช้งาน",
  "admin.table.closed": "ปิดใช้งาน",
  "admin.table.header_code": "รหัส",
  "admin.table.header_capacity": "จำนวนที่นั่ง",
  "admin.common.edit": "แก้ไข",
  "admin.common.delete": "ลบ",
  "admin.pagination.no_results": "ไม่พบรายการ",
};
const t = key => labels[key] || key;
const menuItems = [
  { id: "m1", name: "ปีกไก่ย่าง", image: "/assets/images/default-food.svg", category: "อาหาร", price: 85, active: true },
  { id: "m2", name: "เมนูชื่อยาวมากสำหรับตรวจการตัดคำบนหน้าจอมือถือ", category: "เมนูพิเศษ", price: 120, active: false },
];
const tableItems = [
  { id: "t1", code: "01", name: "โต๊ะ 01", capacity: 4, active: true },
  { id: "t2", code: "02", name: "โต๊ะ 02", seats: 6, active: false },
];

function render(Component, kind, items) {
  return renderToStaticMarkup(React.createElement(Component, {
    kind, items, t, intlLocale: "th-TH", onEdit: () => {}, onDelete: () => {},
  }));
}

test("Menu/table use the same mobile list design, complete statuses and Flaticon Uicons", async () => {
  const Component = await loadComponent();
  for (const [kind, items] of [["menu", menuItems], ["table", tableItems]]) {
    const html = render(Component, kind, items);
    assert.match(html, /เปิดใช้งาน/);
    assert.match(html, /ปิดใช้งาน/);
    assert.match(html, /fi fi-rr-edit/);
    assert.match(html, /fi fi-rr-trash/);
    assert.match(html, /admin-mobile-entity-row/);
    assert.match(html, /data-active="false"/);
    assert.equal((html.match(/data-edit-mobile-entity/g) || []).length, items.length);
    assert.equal((html.match(/data-delete-mobile-entity/g) || []).length, items.length);
  }
  const tables = render(Component, "table", tableItems);
  assert.match(tables, /จำนวนที่นั่ง/);
  assert.match(tables, /จำนวนที่นั่ง: 6/);
  const menus = render(Component, "menu", menuItems);
  assert.match(menus, /85\.00/);
  assert.match(menus, /image/);
  assert.match(adminSource, /items=\{visibleMenus\}/);
  assert.match(adminSource, /items=\{visibleTables\}/);
  assert.match(adminSource, /onEdit=\{openMenu\}/);
  assert.match(adminSource, /onDelete=\{removeMenu\}/);
  assert.match(adminSource, /onEdit=\{openTable\}/);
  assert.match(adminSource, /onDelete=\{removeTable\}/);
  assert.match(adminSource, /fi fi-rr-edit app-icon admin-button-icon/);
  assert.match(mobileCss, /body\.admin-vr-page \.admin-desktop-entity-list\s*\{\s*display: none !important;/);
});

test("Mobile cards stay readable and without sideways scrolling at 320–720px; desktop tables remain", async () => {
  const Component = await loadComponent();
  const browser = await chromium.launch({
    headless: true,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  try {
    for (const width of [320, 360, 375, 390, 430, 440, 560, 720, 768, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 950 }, deviceScaleFactor: 1 });
      try {
        const html = "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head><body class=\"admin-vr-page\" data-roles=\"admin\">"
          + [["menu", menuItems], ["table", tableItems]].map(([kind, items]) =>
            '<section class="admin-vr-card" data-kind="' + kind + '">'
            + '<div class="admin-entity-list-actions"><button class="btn">เพิ่ม</button></div>'
            + '<div class="admin-entity-list-filters grid grid-2"><input class="input" placeholder="ค้นหา"><select class="input"><option>ทุกสถานะ</option></select></div>'
            + '<div class="admin-desktop-entity-list" data-desktop="' + kind + '">DESKTOP TABLE</div>'
            + render(Component, kind, items)
            + '</section>',
          ).join("") + "</body></html>";
        await page.setContent(html);
        await page.addStyleTag({
          content: '*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif;background:#eef6f0}.admin-vr-card{margin:12px;padding:12px;max-width:800px;border-radius:14px;background:#fff}.input{padding:10px}.btn{padding:8px}.admin-desktop-entity-list{height:40px}',
        });
        await page.addStyleTag({ content: mobileCss });
        const actual = await page.evaluate(() => {
          const cards = [...document.querySelectorAll(".admin-mobile-entity-row")];
          const ranges = cards.map(c => {
            const r = c.getBoundingClientRect();
            const actions = c.querySelector(".admin-mobile-entity-actions").getBoundingClientRect();
            const edit = c.querySelector(".is-edit").getBoundingClientRect();
            const badge = c.querySelector(".admin-mobile-entity-status");
            return {
              right: r.right, width: r.width, actionsRight: actions.right,
              editHeight: edit.height, badgeDisplay: getComputedStyle(badge).display,
              badgeRight: badge.getBoundingClientRect().right,
            };
          });
          return {
            scroll: document.documentElement.scrollWidth,
            mobileVisible: getComputedStyle(document.querySelector('[data-mobile-entity-list="menu"]')).display !== "none",
            desktopVisible: getComputedStyle(document.querySelector('[data-desktop="menu"]')).display !== "none",
            menuCount: document.querySelectorAll('[data-mobile-entity-list="menu"] [role="listitem"]').length,
            tableCount: document.querySelectorAll('[data-mobile-entity-list="table"] [role="listitem"]').length,
            menuStatus: [...document.querySelectorAll('[data-mobile-entity-list="menu"] .admin-mobile-entity-status')].map(x => x.textContent.trim()),
            tableStatus: [...document.querySelectorAll('[data-mobile-entity-list="table"] .admin-mobile-entity-status')].map(x => x.textContent.trim()),
            rows: ranges,
          };
        });
        assert.ok(actual.scroll <= width + 1, `${width}px: horizontal overflow to ${actual.scroll}px`);
        assert.equal(actual.mobileVisible, width <= 720, `${width}px mobile visibility`);
        assert.equal(actual.desktopVisible, width > 720, `${width}px desktop table visibility`);
        assert.equal(actual.menuCount, 2);
        assert.equal(actual.tableCount, 2);
        assert.deepEqual(actual.menuStatus, ["เปิดใช้งาน", "ปิดใช้งาน"]);
        assert.deepEqual(actual.tableStatus, ["เปิดใช้งาน", "ปิดใช้งาน"]);
        if (width <= 720) {
          for (const row of actual.rows) {
            assert.ok(row.right <= width + 1 && row.actionsRight <= width + 1, `${width}px action overflows`);
            assert.ok(row.width > 120, `${width}px row too narrow`);
            assert.ok(row.editHeight >= 35, `${width}px edit button too short`);
            assert.notEqual(row.badgeDisplay, "none", `${width}px status hidden`);
            assert.ok(row.badgeRight <= width + 1, `${width}px status overflow`);
          }
        }
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});
