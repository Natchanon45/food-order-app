import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("react-app/src/pages/VerifyPage.jsx", "utf8");
const translations = JSON.parse(fs.readFileSync("react-app/src/i18n/parity-translations.json", "utf8"));
const locales = ["th", "en", "my", "lo", "km"];
const lookup = (data, key) => key.split(".").reduce((value, part) => value?.[part], data);

test("Every Verify page static translation key exists in all five locales", () => {
  const keys = [...source.matchAll(/\bt\("((?:verify|shared)\.[^"]+)"/g)]
    .map(match => match[1]).filter(key => !key.endsWith("."));
  assert.ok(keys.includes("verify.gift_suffix"));
  for (const locale of locales) {
    for (const key of keys) {
      const text = lookup(translations[locale], key);
      assert.equal(typeof text, "string", locale + " missing " + key);
      assert.ok(text.trim().length, locale + " empty " + key);
      assert.notEqual(text, key, locale + " leaked raw translation key " + key);
    }
  }
});

test("Gift rows show a localized customer-friendly suffix instead of an internal translation key", () => {
  assert.match(source, /item\.isGift === true\s*\?\s*" "\s*\+\s*t\("verify\.gift_suffix"\)/);
  for (const locale of locales) {
    const suffix = translations[locale].verify.gift_suffix;
    assert.equal(suffix, translations[locale].cashier.items.gift_suffix);
    const line = "1 × ลูกชิ้นหมู " + suffix;
    assert.ok(!line.includes("verify.gift_suffix"));
  }
  assert.equal(translations.th.verify.gift_suffix, "(ของแถม)");
  assert.equal(translations.en.verify.gift_suffix, "(Free gift)");
});

test("Verification order reference, statuses, delivery totals and amounts remain unchanged", () => {
  assert.match(source, /String\(first\.id \|\| orderId\)\.slice\(0,12\)\.toUpperCase\(\)/);
  assert.match(source, /Number\(item\.qty \|\| 0\) \* Number\(item\.price \|\| 0\)/);
  assert.match(source, /t\("shared\.status\." \+ String\(first\.status \|\| "pending"\)\)/);
  assert.match(source, /money\(total\(first\)\)/);
  assert.match(source, /money\(deliveryFee\(first\)\)/);
});
