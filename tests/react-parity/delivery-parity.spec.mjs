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
  test("header keeps Laravel sibling order: brand, badge, language", async ({ page }) => {
    await openDelivery(page);

    const header = page.locator(".app-header").first();
    const directChildren = await header.evaluate(element => [...element.children].map(child => ({
      className: child.className,
      left: child.getBoundingClientRect().left,
      right: child.getBoundingClientRect().right,
    })));

    expect(directChildren).toHaveLength(3);
    expect(directChildren[0].className).toContain("brand");
    expect(directChildren[1].className).toContain("badge");
    expect(directChildren[2].className).toContain("app-locale-switcher");
    const brandToBadge = directChildren[1].left - directChildren[0].right;
    const badgeToLocale = directChildren[2].left - directChildren[1].right;
    expect(brandToBadge).toBeGreaterThanOrEqual(8);
    expect(badgeToLocale).toBeGreaterThanOrEqual(8);
  });

  test("mobile header keeps the delivery badge beside the brand content", async ({ page }) => {
    await page.setViewportSize({ width: 440, height: 956 });
    await openDelivery(page);

    const metrics = await page.locator(".app-header").first().evaluate(header => {
      const brand = header.querySelector(":scope > .brand");
      const badge = header.querySelector(":scope > .badge");
      const locale = header.querySelector(":scope > .app-locale-switcher");
      const brandRect = brand?.getBoundingClientRect();
      const badgeRect = badge?.getBoundingClientRect();
      const localeRect = locale?.getBoundingClientRect();
      const contentRight = brand
        ? Math.max(...[...brand.children].map(child => child.getBoundingClientRect().right))
        : 0;

      return {
        brandBoxTail: brandRect ? brandRect.right - contentRight : Number.POSITIVE_INFINITY,
        contentToBadge: badgeRect ? badgeRect.left - contentRight : 0,
        badgeToLocale: badgeRect && localeRect ? localeRect.left - badgeRect.right : 0,
        localeRightInset: localeRect ? window.innerWidth - localeRect.right : Number.POSITIVE_INFINITY,
      };
    });

    expect(metrics.brandBoxTail).toBeLessThanOrEqual(2);
    expect(metrics.contentToBadge).toBeGreaterThanOrEqual(8);
    expect(metrics.contentToBadge).toBeLessThanOrEqual(16);
    expect(metrics.badgeToLocale).toBeGreaterThanOrEqual(8);
    expect(metrics.localeRightInset).toBeGreaterThanOrEqual(8);
  });

  test("favorites category appears only after a guest has a persisted favorite", async ({ page }) => {
    await openDelivery(page);

    const favoritesTab = page.locator('#categoryTabs [data-category="__favorites__"]');
    await expect(favoritesTab).toHaveCount(0);

    const firstFavorite = page.locator("#menuGrid .menu-favorite-button").first();
    await firstFavorite.click();
    await expect(firstFavorite).toHaveAttribute("aria-pressed", "true");
    await expect(favoritesTab).toHaveCount(1);
    await expect(favoritesTab).toHaveText(/^❤️\s*เมนูโปรด$/);

    const persisted = await page.evaluate(() => {
      const key = Object.keys(localStorage).find(value => value.startsWith("food_order_guest_menu_favorites:"));
      return key ? JSON.parse(localStorage.getItem(key) || "[]") : [];
    });
    expect(persisted.length).toBeGreaterThan(0);

    await page.reload({ waitUntil: "domcontentloaded" });
    const reloadedFavoritesTab = page.locator('#categoryTabs [data-category="__favorites__"]');
    await expect(reloadedFavoritesTab).toHaveCount(1);
    const persistedFavoriteButton = page.locator("#menuGrid .menu-favorite-button.is-favorite").first();
    await expect(persistedFavoriteButton).toBeVisible();

    await persistedFavoriteButton.click();
    await expect(page.locator('#categoryTabs [data-category="__favorites__"]')).toHaveCount(0);
  });

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
          centerDeltaY: Math.abs(
            (buttonRect.top + buttonRect.height / 2)
            - (iconRect.top + iconRect.height / 2)
          ),
        } : { inside: false, centerDeltaY: Number.POSITIVE_INFINITY };
      });
      expect(bounds.inside).toBe(true);
      expect(bounds.centerDeltaY).toBeLessThanOrEqual(1);
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
    const slipIcon = page.locator("#paymentSlipContent .payment-slip-icon");
    await expect(slipIcon).toHaveText("+");
    await expect(slipIcon.locator("i")).toHaveCount(0);

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
