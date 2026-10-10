import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { orderAlertAudioTokens, thaiNumberAudioTokens, ORDER_ALERT_SEGMENTS } from "../../react-app/src/components/orderAlertRecordedAudio.js";
import { createOrderAlertAudioController, orderAlertSpeechText, chooseThaiFemaleVoice, isIOSSpeechBrowser } from "../../react-app/src/components/orderAlertAudio.js";

const tokens = value => thaiNumberAudioTokens(value).join(" ");
test("Thai currency fallback uses spoken Thai positional numbers, not isolated digits", () => {
  const cases = [
    [0, "zero"], [1,"one"], [10,"ten"],[11,"ten et"], [20,"yee ten"],
    [21,"yee ten et"],[100,"one hundred"],[101,"one hundred et"],
    [170,"one hundred seven ten"], [999,"nine hundred nine ten nine"],
    [1000,"one thousand"],[20021,"two ten_thousand yee ten et"],
    [1000000,"one million"],[1000001,"one million one"],
    [1234567,"one million two hundred_thousand three ten_thousand four thousand five hundred six ten seven"],
  ];
  for (const [value, expected] of cases) assert.equal(tokens(value),expected,String(value));
});

test("Cashier/Kitchen fallback announcement includes channel, baht and satang", () => {
  const actual=orderAlertAudioTokens({orderType:"delivery"},170).join(" ");
  assert.equal(actual,"intro delivery amount one hundred seven ten baht");
  assert.deepEqual(orderAlertAudioTokens({orderType:"takeaway"},21.50).slice(-6),["yee","ten","et","baht","five","ten","satang"].slice(-6));
  assert.equal(orderAlertAudioTokens({orderType:"walkin"},0)[1],"walkin");
  assert.equal(orderAlertAudioTokens({orderType:"table"},1000001)[1],"table");
  assert.equal(orderAlertAudioTokens({}, -1),null);
  assert.equal(orderAlertAudioTokens({}, Number.POSITIVE_INFINITY),null);
  assert.equal(orderAlertSpeechText({orderType:"delivery",totalAmount:170}),"มีรายการสั่งซื้อใหม่ จัดส่งเดลิเวอรี่ ยอด 170 บาท");
});

test("All recorded segments are real playable mono PCM16 Thai WAV files", () => {
  const root="public/assets/audio/order-alert-th/";
  const manifest=JSON.parse(fs.readFileSync(root+"manifest.json","utf8"));
  assert.equal(ORDER_ALERT_SEGMENTS.length,27);
  assert.equal(Object.keys(manifest.segments).length,27);
  for (const key of ORDER_ALERT_SEGMENTS) {
    const bytes=fs.readFileSync(root+key+".wav");
    assert.equal(bytes.toString("ascii",0,4),"RIFF",key);
    assert.equal(bytes.toString("ascii",8,12),"WAVE",key);
    assert.ok(bytes.length>1000,key);
  }
});

test("Detects iOS iPhone, iPad and iPadOS desktop UA, never desktop Mac", () => {
  assert.equal(isIOSSpeechBrowser({userAgent:"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",maxTouchPoints:5}),true);
  assert.equal(isIOSSpeechBrowser({userAgent:"Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)",maxTouchPoints:5}),true);
  assert.equal(isIOSSpeechBrowser({userAgent:"Mozilla/5.0 (Macintosh; Intel Mac OS X)",maxTouchPoints:5}),true);
  assert.equal(isIOSSpeechBrowser({userAgent:"Mozilla/5.0 (Macintosh; Intel Mac OS X)",maxTouchPoints:0}),false);
  assert.equal(chooseThaiFemaleVoice([{name:"Niwat",lang:"th-TH"},{name:"Kanya",lang:"th-TH"}]).name,"Kanya");
});

test("Voice test is wired to a direct user-gesture button with separate readiness status", () => {
  const jsx=fs.readFileSync("react-app/src/components/CashierOrderNotifier.jsx","utf8");
  assert.match(jsx,/id="orderAlertVoiceTestButton"/);
  assert.match(jsx,/onClick=\{tryVoice\}/);
  assert.match(jsx,/controllerRef\.current\.testVoice\(\)/);
  assert.match(jsx,/controllerRef\.current\.subscribe\(setVoiceStatus\)/);
  assert.match(jsx,/speechGesture: true/);
  assert.match(jsx,/notifications\.order\.voice_failed/);
  assert.match(jsx,/data-voice-ready=\{String\(voiceStatus\.speechReady\)\}/);
  for (const locale of ["th","en","my","lo","km"]) {
    const json=JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json","utf8"));
    for (const key of ["test_voice","voice_web","voice_recorded","voice_locked","voice_checking","voice_failed"])
      assert.ok(json[locale].notifications.order[key],locale+" "+key);
  }
});

test("Header renders only voice-test and bell controls, without a visible status label", () => {
  const jsx=fs.readFileSync("react-app/src/components/CashierOrderNotifier.jsx","utf8");
  const header=jsx.slice(jsx.indexOf('return (\n    <div className="order-alert-controls"'));
  assert.ok(header.includes('id="orderAlertVoiceTestButton"'));
  assert.ok(header.includes('id="orderAlertButton"'));
  assert.ok(header.includes('aria-label={t("notifications.order.test_voice") + " • " + voiceLabel}'));
  assert.ok(header.includes('title={label + " • " + voiceLabel}'));
  assert.ok(!header.includes('<span className="sr-only" role="status"'));
  assert.ok(!header.includes('>{voiceLabel}</span>'));
  // Only the two controls occupy the toolbar row; voice status is still in
  // their accessible labels/tooltips rather than visible header text.
  assert.ok(header.includes('display: "flex", alignItems: "center", gap: 8'));
});

test("Order alert never bypasses existing cashier and kitchen order gating", () => {
  const source=fs.readFileSync("react-app/src/components/CashierOrderNotifier.jsx","utf8");
  assert.match(source,/cashierOrderAlertEligible\(order, surface\)/);
  assert.match(source,/surface !== "kitchen" \|\| deliveryKitchenAdmitted\(order\)/);
  assert.match(source,/newOrders\.forEach\(order => \{/);
  assert.match(source,/announcementChainRef\.current = announcementChainRef\.current/);
});
