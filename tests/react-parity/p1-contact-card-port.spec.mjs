import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../../'+p, import.meta.url),'utf8');
const page = read('react-app/src/pages/PlatformContactPage.jsx');
const telegram = read('react-app/src/components/TelegramSettingsPanel.jsx');
const css = read('react-app/src/ui/platform-contact-card-collapse.css');
test('source contact cards collapse independently and keep their controlled forms mounted', () => {
  assert.match(page,/useState\(\{ public: false, telegram: false, google: false \}\)/);
  for (const [key,name] of [['public','Public'],['google','Google'],['telegram','Telegram']]) {
    assert.ok(page.includes(`controls="platformContact${name}Panel"`));
    assert.ok(page.includes(`hidden={!expandedCards.${key}}`));
  }
  assert.match(page,/aria-expanded=\{expanded\} aria-controls=\{controls\}/);
  assert.match(page,/id="platformContactForm"[^>]*onSubmit=\{submitContact\}/);
  assert.match(page,/id="googleCustomerLoginForm"[^>]*onSubmit=\{submitGoogle\}/);
  assert.match(css,/platform-contact-collapsed-body\[hidden\]/);
  assert.match(css,/platform-contact-preview-body\[hidden\]/);
});
test('Telegram reload is portaled but Firebase callables and default merchant header are retained', () => {
  assert.match(telegram,/from "firebase\/functions"/);
  assert.match(telegram,/hideHeading = false, reloadPortalId = ""/);
  assert.match(telegram,/createPortal\(/);
  assert.match(page,/TelegramSettingsPanel scope="platform" hideHeading reloadPortalId="platformTelegramReloadSlot"/);
  assert.match(page,/ข้อมูลและยอดเงินเป็นเพียงตัวอย่าง ไม่ใช่การแจ้งเตือนจริง/);
  assert.doesNotMatch(page,/LUKKAJA/);
});
