import { useEffect, useMemo, useState } from "react";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { ParityFooter } from "@/components/ParityFooter";
import { useI18n } from "@/i18n/I18nProvider";

export function showStorefrontToast(message, type = "success") {
  const existing = document.querySelector(".app-toast[data-public-storefront-toast]");
  existing?.remove();
  const el = document.createElement("div");
  el.dataset.publicStorefrontToast = "true";
  el.className = "app-toast " + (type === "error" ? "error" : "success");
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = '<span class="app-toast-icon" aria-hidden="true"><i class="bi bi-' + (type === "error" ? "x-circle" : "check-circle") + ' app-icon"></i></span><span class="app-toast-message"></span>';
  el.querySelector(".app-toast-message").textContent = String(message || "");
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  window.setTimeout(() => {
    el.classList.remove("show");
    window.setTimeout(() => el.remove(), 250);
  }, 2600);
}

export function PublicStorefrontHeader({ title, badge, brandMark = "PG" }) {
  return (
    <header className="app-header">
      <div className="brand"><span className="brand-mark">{brandMark}</span><span>{title}</span></div>
      <div className="header-actions" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <LocaleSwitcher />
        {badge ? <span className="badge">{badge}</span> : null}
      </div>
    </header>
  );
}

export function PublicStorefrontFooter() {
  return <ParityFooter />;
}

export function useMobileStorefront(maxWidth = 899) {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: " + maxWidth + "px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width: " + maxWidth + "px)");
    const change = () => setMobile(media.matches);
    change();
    media.addEventListener?.("change", change);
    return () => media.removeEventListener?.("change", change);
  }, [maxWidth]);
  return mobile;
}

function clamp(value) {
  const number = Number(value);
  return Math.max(0, Math.min(100, Number.isFinite(number) ? number : 50));
}

function pageNumbers(page, total) {
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1);
  const start = Math.max(1, Math.min(page - 2, total - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

export function PublicMenuCatalog({
  menus = [], prefix, activeCategory, setActiveCategory, search, setSearch,
  page, setPage, onAdd, disabled = false, mobilePageSize = Number.MAX_SAFE_INTEGER,
  desktopPageSize = 10, extraCategory = null, extraFilter = null, extraLabel = "",
}) {
  const { t, formatNumber } = useI18n();
  const mobile = useMobileStorefront();
  const all = "__all__";
  const other = "__other__";
  const categories = useMemo(() => {
    const values = [...new Set(menus.filter(item => item.active !== false).map(item => String(item.category || other)))];
    return [all, ...(extraCategory ? [extraCategory] : []), ...values];
  }, [menus, extraCategory]);
  const filtered = useMemo(() => {
    const keyword = String(search || "").trim().toLowerCase();
    return menus.filter(item => {
      if (item.active === false) return false;
      if (keyword && !String(item.name || "").toLowerCase().includes(keyword)) return false;
      if (activeCategory === extraCategory && extraCategory) return extraFilter ? extraFilter(item) : false;
      if (activeCategory === all) return true;
      return String(item.category || other) === activeCategory;
    });
  }, [menus, search, activeCategory, extraCategory, extraFilter]);
  const size = mobile ? mobilePageSize : desktopPageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const current = Math.min(page, totalPages);
  const visible = mobile ? filtered : filtered.slice((current - 1) * size, current * size);
  const [highlightedCategory, setHighlightedCategory] = useState(all);
  const scrollSpyEnabled = mobile && prefix === "order.menu" && activeCategory === all;
  const selectedCategory = scrollSpyEnabled ? highlightedCategory : activeCategory;

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages, setPage]);

  useEffect(() => {
    if (!scrollSpyEnabled) {
      setHighlightedCategory(activeCategory);
      return undefined;
    }

    setHighlightedCategory(all);
    let frame = 0;
    let userHasScrolled = false;
    let lastWindowY = window.scrollY;

    const updateFromScroll = () => {
      frame = 0;
      if (!userHasScrolled) return;

      const menuGrid = document.getElementById("menuGrid");
      const filterArea = document.getElementById("menuListStart");
      if (!menuGrid || !filterArea) return;

      const cards = [...menuGrid.querySelectorAll(":scope > .menu-card")]
        .filter(card => !card.hidden && card.dataset.menuCategory);
      if (!cards.length) return;

      const stickyBottom = filterArea.getBoundingClientRect().bottom + 12;
      if (menuGrid.getBoundingClientRect().top > stickyBottom) {
        setHighlightedCategory(all);
        return;
      }

      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 8;
      if (nearBottom) {
        setHighlightedCategory(cards[cards.length - 1].dataset.menuCategory || all);
        return;
      }

      let currentCard = cards[0];
      for (const card of cards) {
        if (card.getBoundingClientRect().top <= stickyBottom) currentCard = card;
        else break;
      }
      setHighlightedCategory(currentCard.dataset.menuCategory || all);
    };

    const scheduleUpdate = () => {
      const currentY = window.scrollY;
      if (Math.abs(currentY - lastWindowY) > 3) userHasScrolled = true;
      lastWindowY = currentY;
      if (frame) return;
      frame = window.requestAnimationFrame(updateFromScroll);
    };

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [scrollSpyEnabled, activeCategory, all, visible.length]);

  useEffect(() => {
    if (!mobile || prefix !== "order.menu") return;
    const tabs = document.getElementById("categoryTabs");
    if (!tabs) return;
    const target = [...tabs.querySelectorAll("[data-category]")]
      .find(button => button.dataset.category === selectedCategory);
    if (!target) return;
    const left = target.offsetLeft - (tabs.clientWidth / 2) + (target.clientWidth / 2);
    tabs.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
  }, [mobile, prefix, selectedCategory]);

  const label = category => {
    if (category === all) return t(prefix + ".all");
    if (category === other) return t(prefix + ".other");
    if (category === extraCategory) return extraLabel;
    return category;
  };

  return (
    <div className="delivery-menu-column">
      <div className="menu-filter-area" id="menuListStart">
        <div className="category-tabs" id="categoryTabs" role="tablist" aria-label={t(prefix + ".category_aria")}>
          {categories.map(category => (
            <button key={category} type="button" data-category={category} className={"category-tab" + (category === selectedCategory ? " active" : "")}
              role="tab" aria-selected={category === selectedCategory}
              onClick={() => { setActiveCategory(category); setHighlightedCategory(category); setPage(1); }}>
              {label(category)}
            </button>
          ))}
        </div>
        <input className="input menu-search" value={search} disabled={disabled}
          placeholder={t(prefix + ".search_placeholder")}
          onChange={event => { setSearch(event.target.value); setPage(1); }} />
      </div>
      <div id="menuGrid" className="grid grid-3">
        {visible.length ? visible.map(item => (
          <article className="card menu-card" data-menu-category={String(item.category || other)} key={item.id}>
            <div className="menu-image">
              <img src={item.image || "/assets/images/default-food.svg"} alt={item.name || ""}
                data-image-position-x="50" data-image-position-y={clamp(item.imagePositionY)}
                style={{ objectPosition: "50% " + clamp(item.imagePositionY) + "%" }} />
            </div>
            <div className="menu-name">{item.name}</div>
            <div className="menu-category">{label(String(item.category || other))}</div>
            <div className="menu-footer">
              <span className="price">{t(prefix.replace(/\.menu$/, ".cart") + ".amount", { amount: formatNumber(Number(item.price || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}</span>
              <button type="button" className="btn btn-primary btn-sm menu-add-button" disabled={disabled}
                aria-label={t(prefix + ".add")} title={t(prefix + ".add")} onClick={() => onAdd(item)}>
                <i className="bi bi-plus-lg" aria-hidden="true"></i>
              </button>
            </div>
          </article>
        )) : <div className="card empty">{t(prefix + (prefix.startsWith("delivery.") ? ".not_found" : ".empty"))}</div>}
      </div>
      {!mobile && totalPages > 1 ? (
        <nav className="menu-pagination" aria-label={t(prefix + ".pagination_aria")}>
          <button type="button" className="menu-page-button menu-page-nav" disabled={current === 1}
            onClick={() => setPage(Math.max(1, current - 1))}><i className="bi bi-chevron-left app-icon"></i></button>
          {pageNumbers(current, totalPages).map(value => (
            <button key={value} type="button" className={"menu-page-button" + (value === current ? " active" : "")}
              onClick={() => setPage(value)}>{value}</button>
          ))}
          <button type="button" className="menu-page-button menu-page-nav" disabled={current === totalPages}
            onClick={() => setPage(Math.min(totalPages, current + 1))}><i className="bi bi-chevron-right app-icon"></i></button>
          <div className="menu-page-summary">{t(prefix + ".page_summary", { current, total: totalPages, count: filtered.length })}</div>
        </nav>
      ) : null}
    </div>
  );
}

export function PublicCartList({ items = [], prefix, onIncrease, onDecrease, onNote, emptyTextKey }) {
  const { t, formatNumber } = useI18n();
  const cartPrefix = prefix;
  return (
    <div className="cart-list">
      {items.length ? items.map(item => (
        <div className="cart-row" key={item.id}>
          <div>
            <strong>{item.name}</strong>
            <div className="menu-category">{t(cartPrefix + ".amount", { amount: formatNumber(Number(item.price || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}</div>
            <input className="input" value={item.note || ""} placeholder={t(cartPrefix + ".item_note_placeholder")}
              style={{ marginTop: 7 }} onChange={event => onNote(item.id, event.target.value)} />
          </div>
          <div className="qty">
            <button type="button" onClick={() => onDecrease(item)}>−</button>
            <strong>{item.qty}</strong>
            <button type="button" onClick={() => onIncrease(item.id)}>+</button>
          </div>
        </div>
      )) : <div className="empty">{t(emptyTextKey || cartPrefix + ".empty")}</div>}
    </div>
  );
}
