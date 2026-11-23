import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../../'+p, import.meta.url),'utf8');
const page = read('react-app/src/pages/PlatformContactPage.jsx');
const telegram = read('react-app/src/components/TelegramSettingsPanel.jsx');
const css = read('react-app/src/ui/platform-contact-card-collapse.css');
test('source contact cards collapse independently and keep their controlled forms mounted', () => {
  assert.match(page,/useState\(\{ public: false, telegram: false, google: false, lkShop: false \}\)/);
  for (const [key,name] of [['public','Public'],['google','Google'],['telegram','Telegram']]) {
    assert.ok(page.includes(`controls="platformContact${name}Panel"`));
    assert.ok(page.includes(`hidden={!expandedCards.${key}}`));
  }
  assert.match(page,/aria-expanded=\{expanded\} aria-controls=\{controls\}/);
  assert.match(page,/id="platformContactForm"[^>]*onSubmit=\{submitContact\}/);
  assert.match(page,/id="googleCustomerLoginForm"[^>]*onSubmit=\{submitGoogle\}/);
  assert.match(css,/platform-contact-collapsed-body\[hidden\]/);
  assert.match(css,/platform-contact-preview-body\[hidden\]/);
  assert.match(page,/className="platform-lk-shop-layout"/);
  assert.match(page,/className="card platform-lk-shop-settings-card platform-contact-toggle-host"/);
  assert.match(page,/className="card platform-lk-shop-preview-card"/);
  assert.match(page,/controls="platformContactLKShopPanel"/);
  assert.match(page,/id="platformContactLKShopPanel" className="platform-contact-collapsed-body"/);
  assert.match(page,/hidden=\{!expandedCards.lkShop\}/);
  assert.match(page,/LKShopPairingPanel scope="platform" embedded notify=\{showToast\}/);
  assert.match(page,/ข้อความเป็นตัวอย่างเท่านั้น ไม่ใช่การแจ้งเตือนจริง/);
  assert.match(css,/\.platform-lk-shop-layout/);
  assert.match(css,/@media \(max-width: 1040px\)/);
  assert.match(css,/\.platform-lk-shop-preview-card/);

});
test('Telegram reload is portaled but Firebase callables and default merchant header are retained', () => {
  assert.match(telegram,/from "firebase\/functions"/);
  assert.match(telegram,/hideHeading = false, reloadPortalId = ""/);
  assert.match(telegram,/createPortal\(/);
  assert.match(page,/TelegramSettingsPanel scope="platform" hideHeading reloadPortalId="platformTelegramReloadSlot"/);
  assert.match(page,/ข้อมูลและยอดเงินเป็นเพียงตัวอย่าง ไม่ใช่การแจ้งเตือนจริง/);
  assert.doesNotMatch(page,/LUKKAJA/);
});
