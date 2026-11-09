import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const page = readFileSync("react-app/src/pages/AdminTenantsPage.jsx", "utf8");
const panel = readFileSync("react-app/src/components/TenantControlPanel.jsx", "utf8");
const service = readFileSync("react-app/src/data/platformTenantService.js", "utf8");
const callable = readFileSync("functions/tenant-provision.js", "utf8");
const styles = readFileSync("react-app/public/parity/css/tenant-control-panel-port.css", "utf8");

test("source Tenant Control layout retains actual PENGUIN approved actions and notifications", () => {
  for (const part of ["summary", "access", "registration", "actions", "m7-source"]) {
    assert.ok(panel.includes(`data-tenant-control-section="${part}"`) ||
      panel.includes(`id="${part}"`), part);
  }
  assert.match(page, /<TenantControlPanel key=\{tenant\.id\}/);
  assert.match(page, /<TenantCard/);
  assert.match(page, /onSubscriptionAction=\{updateSubscription\}/);
  assert.match(panel, /data-tenant-revenue-notification=\{tenant.id\}/);
  assert.match(panel, /data-tenant-wallet-notification=\{tenant.id\}/);
  assert.match(styles, /\.tenant-control-panel/);
});

test("source M7 screen must never present unverified Firestore Revenue Share as certified issued debt", () => {
  assert.doesNotMatch(panel, /laravel|react-pilot|\.\.\/\.\.\/\.\.\/css\//);
  assert.match(panel, /status: enabled && tenantId \? "unverified"/);
  assert.match(panel, /Firebase ยังไม่มีทะเบียน SQL M7/);
  assert.match(panel, /ไม่แสดง Invoice, Service Credit หรือ COD Reconciliation/);
  assert.match(panel, /function mask\(value\)/);
  assert.match(panel, /bankAccountMasked: mask\(saved.bankAccountNumber\)/);
  assert.match(panel, /promptPayMasked: mask\(saved.promptPayId\)/);
  assert.doesNotMatch(panel, /api\.post\(|updateDoc\(|setDoc\(|deleteDoc\(/);
});

test("first activation and wallet are attributed to real authenticated tenant data", () => {
  assert.match(service, /firstActivatedAt: dateValue\(tenant.firstActivatedAt\)/);
  assert.match(service, /firstActivatedOn: bangkokDate\(tenant.firstActivatedAt\)/);
  assert.match(service, /timeZone: "Asia\/Bangkok"/);
  assert.match(service, /storageReady: walletSnapshot.exists\(\)/);
});

test("source new-store form is wired to a single idempotent backend, not two separate writes", () => {
  assert.match(page, /id="tenantOwnerName"/);
  assert.match(page, /id="tenantOwnerEmail"/);
  assert.match(page, /id="tenantOwnerPassword"/);
  assert.match(page, /id="tenantOwnerPasswordConfirm"/);
  assert.match(page, /id="tenantNewPlanCode"/);
  assert.match(page, /createOperationIdRef.current = crypto.randomUUID\(\)/);
  assert.match(page, /await createActiveTenantWithOwner\(payload\)/);
  assert.match(page, /const canonical = await listTenants\(\)/);
  assert.match(page, /TENANT_WRITE_UNCONFIRMED/);
  assert.match(callable, /platformTenantProvisions/);
  assert.match(callable, /tx.create\(slugRef/);
  assert.match(callable, /return receipt\(record, true\)/);
  assert.match(callable, /await auth.deleteUser\(createdAuth.uid\)/);
});
