import { expect, test } from "@playwright/test";

const STORE_SLUG = "saas-test-shop";
const STORE_ROUTE = `/s/${STORE_SLUG}/delivery`;
const DEFAULT_ADDRESS = {
  id: "home-default",
  label: "บ้าน",
  recipientName: "ลูกค้าทดสอบ",
  recipientPhone: "0812345678",
  address: "ที่อยู่หลักใกล้ร้าน",
  latitude: 13.82984,
  longitude: 100.64208,
  isDefault: true,
};
const SECONDARY_ADDRESS = {
  id: "latest-address",
  label: "ที่อยู่ล่าสุด",
  recipientName: "ลูกค้าทดสอบ",
  recipientPhone: "0812345678",
  address: "ที่อยู่สำรองใกล้ร้าน",
  latitude: 13.82986,
  longitude: 100.64210,
  isDefault: false,
};
const PROFILE = {
  displayName: "ลูกค้าทดสอบ",
  phone: "0812345678",
  addresses: [DEFAULT_ADDRESS, SECONDARY_ADDRESS],
};

async function seedGuestProfile(page) {
  await page.addInitScript(profile => {
    localStorage.setItem("food_order_guest_delivery_profile", JSON.stringify(profile));
  }, PROFILE);
}

async function openDelivery(page) {
  await seedGuestProfile(page);
  await page.goto(STORE_ROUTE, { waitUntil: "domcontentloaded" });
  await expect(page.locator("#addressList .address-card")).toHaveCount(2);
}

test.describe("Delivery Laravel behavior parity", () => {
  test("profile load automatically selects the default saved address", async ({ page }) => {
    await openDelivery(page);

    const defaultRadio = page.locator(
      'input[name="savedDeliveryAddressReact"][value="home-default"]',
    );
    await expect(defaultRadio).toBeChecked();
    await expect(page.locator('.address-card:has(input[value="home-default"])')).toHaveClass(/selected/);
    await expect(page.locator("#deliveryAddress")).toHaveValue(DEFAULT_ADDRESS.address);
    await expect(page.locator("#recipientName")).toHaveValue(DEFAULT_ADDRESS.recipientName);
    await expect(page.locator("#recipientPhone")).toHaveValue(DEFAULT_ADDRESS.recipientPhone);
  });

  test("saved-address actions always render their approved icons", async ({ page }) => {
    await openDelivery(page);

    const secondaryCard = page.locator('.address-card:has(input[value="latest-address"])');
    const actions = secondaryCard.locator(".address-card-actions");
    const edit = actions.getByRole("button", { name: "แก้ไข" });
    const makeDefault = actions.getByRole("button", { name: "ตั้งเป็นหลัก" });
    const remove = actions.getByRole("button", { name: "ลบ" });

    await expect(edit.locator("i.bi-pencil")).toHaveCount(1);
    await expect(makeDefault.locator("i.bi-star")).toHaveCount(1);
    await expect(remove.locator("i.bi-trash3")).toHaveCount(1);

    for (const button of [edit, makeDefault, remove]) {
      const icon = button.locator("i.app-icon");
      await expect(icon).toBeVisible();
      const bounds = await button.evaluate(element => {
        const buttonRect = element.getBoundingClientRect();
        const iconRect = element.querySelector("i.app-icon")?.getBoundingClientRect();
        return iconRect ? {
          inside:
            iconRect.left >= buttonRect.left - 1
            && iconRect.right <= buttonRect.right + 1
            && iconRect.top >= buttonRect.top - 1
            && iconRect.bottom <= buttonRect.bottom + 1,
        } : { inside: false };
      });
      expect(bounds.inside).toBe(true);
    }
  });

  test("locked PromptPay keeps Laravel order: QR, amount/name, lock summary/actions, slip", async ({ page }) => {
    await openDelivery(page);

    await page.locator('input[name="savedDeliveryAddressReact"][value="home-default"]').check();
    await page.locator("#menuGrid .menu-add-button").first().click();

    await expect(page.locator("#deliveryDistanceStatus")).toHaveClass(/is-ready/, { timeout: 15_000 });
    await page.locator("#submitOrder").click();

    await expect(page.locator("#promptPayQr")).toBeVisible();
    await expect(page.locator("#paymentLockSummary")).toBeVisible();
    await expect(page.locator("#paymentSlipWrap")).toBeVisible();

    const order = await page.evaluate(() => {
      const ids = [
        "promptPayQr",
        "promptPayAmount",
        "promptPayName",
        "paymentLockPanel",
        "paymentSlipWrap",
      ];
      const elements = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
      const before = (a, b) => Boolean(
        elements[a]
        && elements[b]
        && (elements[a].compareDocumentPosition(elements[b]) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
      return {
        qrBeforeAmount: before("promptPayQr", "promptPayAmount"),
        amountBeforeName: before("promptPayAmount", "promptPayName"),
        nameBeforeLockPanel: before("promptPayName", "paymentLockPanel"),
        lockPanelBeforeSlip: before("paymentLockPanel", "paymentSlipWrap"),
      };
    });

    expect(order).toEqual({
      qrBeforeAmount: true,
      amountBeforeName: true,
      nameBeforeLockPanel: true,
      lockPanelBeforeSlip: true,
    });

    const verticalOrder = await page.evaluate(() => {
      const top = id => document.getElementById(id)?.getBoundingClientRect().top ?? -1;
      return {
        qr: top("promptPayQr"),
        amount: top("promptPayAmount"),
        name: top("promptPayName"),
        panel: top("paymentLockPanel"),
        slip: top("paymentSlipWrap"),
      };
    });
    expect(verticalOrder.qr).toBeLessThan(verticalOrder.amount);
    expect(verticalOrder.amount).toBeLessThanOrEqual(verticalOrder.name);
    expect(verticalOrder.name).toBeLessThan(verticalOrder.panel);
    expect(verticalOrder.panel).toBeLessThan(verticalOrder.slip);
  });
});
