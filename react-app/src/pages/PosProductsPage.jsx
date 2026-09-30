import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import Sortable from "sortablejs";
import { useAuth } from "@/auth/AuthProvider";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { PosNavigation } from "@/components/PosNavigation";
import { UserMenu } from "@/components/UserMenu";
import { sweetAlert, sweetConfirm } from "@/components/sweetDialog";
import {
  adjustRetailStock,
  deleteRetailCategory,
  deleteRetailProduct,
  deleteRetailProductImage,
  listRetailCategories,
  listRetailProducts,
  listRetailStockMovements,
  loadRetailCatalogOrder,
  saveRetailCatalogOrder,
  saveRetailCategory,
  saveRetailProduct,
  uploadRetailProductImage,
} from "@/data/retailProductsData";
import { useI18n } from "@/i18n/I18nProvider";
import { useParityPage } from "@/hooks/useParityPage";
import { useTenant } from "@/tenant/TenantProvider";

const PRODUCT_PAGE_SIZES = [10, 20, 50, 100];
const CATEGORY_PAGE_SIZES = [10, 20, 50];
const PRODUCT_PATTERN = /^P\d{9}$/;
const emptyProduct = () => ({
  id: "", barcode: "", name: "", price: 0, unit: "", stock: 0, minStock: 5,
  cost: "", categoryId: "", category: "", sortOrder: 999, imageUrl: "", imagePath: "",
  imageKey: "", showOnPos: true,
});
const clean = value => String(value || "").trim();
const nameKey = value => clean(value).replace(/\s+/g, " ").toLocaleLowerCase("th");
const movementTime = value => {
  if (value?.toMillis) return value.toMillis();
  if (value?.seconds) return Number(value.seconds) * 1000;
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : Number(value || 0);
};
const pagesAround = (current, total) => Array.from({ length: total }, (_, index) => index + 1)
  .filter(page => page === 1 || page === total || Math.abs(page - current) <= 2);

function hasPosPermission(profile, permission) {
  if (!profile) return false;
  if (profile.role === "owner" || profile.roleId === "owner") return true;
  try {
    const roles = JSON.parse(localStorage.getItem("retail_pos_roles_v1") || "[]");
    const roleId = String(profile.roleId || profile.role || "");
    const role = Array.isArray(roles) ? roles.find(item => String(item?.id || "") === roleId) : null;
    if (role?.permissions?.length) return role.permissions.includes(permission);
  } catch {}
  if (profile.role === "admin" || profile.role === "manager") {
    return !["pos.backup", "pos.users", "pos.backup.restore"].includes(permission);
  }
  if (profile.role === "stock") {
    return ["pos.products", "pos.products.adjust_stock", "pos.stock_movements", "pos.stock_counts",
      "pos.purchases", "pos.suppliers"].includes(permission);
  }
  return false;
}

function showToast(message, type = "success") {
  const el = document.createElement("div");
  el.className = "app-toast " + (type === "error" ? "error" : "success");
  el.setAttribute("role", type === "error" ? "alert" : "status");
  el.innerHTML = '<span class="app-toast-icon" aria-hidden="true"><i class="bi bi-' +
    (type === "error" ? "x-circle" : "check-circle") +
    ' app-icon"></i></span><span class="app-toast-message"></span>';
  el.querySelector(".app-toast-message").textContent = String(message || "");
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add("show"));
  window.setTimeout(() => {
    el.classList.remove("show");
    window.setTimeout(() => el.remove(), 250);
  }, 2600);
}

export function PosProductsPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber } = useI18n();
  const tr = (key, replacements = {}) => t("pos_products." + key, replacements);
  const stylesReady = useParityPage({
    title: tr("meta.title"),
    attributes: { "data-module": "retail-pos-products" },
    styles: [
      "retail-pos.css",
      "retail-products.css",
      "retail-products-sort-manager.css",
      "retail-pos-navigation.css",
      "retail-product-categories.css",
      "retail-product-merchandising.css",
      "sweet-dialog.css",
    ],
  });

  const productDialogRef = useRef(null);
  const categoryDialogRef = useRef(null);
  const stockDialogRef = useRef(null);
  const categorySortRef = useRef(null);
  const productSortRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [movements, setMovements] = useState([]);
  const [catalogOrder, setCatalogOrder] = useState([]);
  const [initialReady, setInitialReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const [productSearch, setProductSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(10);

  const [categorySearch, setCategorySearch] = useState("");
  const [categoryStatus, setCategoryStatus] = useState("all");
  const [categorySort, setCategorySort] = useState("name");
  const [categoryPage, setCategoryPage] = useState(1);
  const [categoryPageSize, setCategoryPageSize] = useState(10);

  const [productForm, setProductForm] = useState(emptyProduct);
  const [editingProductId, setEditingProductId] = useState("");
  const [productFormError, setProductFormError] = useState("");
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryPickerSearch, setCategoryPickerSearch] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeImage, setRemoveImage] = useState(false);

  const [categoryEditing, setCategoryEditing] = useState(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryFormError, setCategoryFormError] = useState("");
  const [reopenProductAfterCategory, setReopenProductAfterCategory] = useState(false);

  const [stockForm, setStockForm] = useState({ productId: "", action: "add", quantity: 1, note: "" });
  const [stockFormError, setStockFormError] = useState("");

  const [selectedSortCategory, setSelectedSortCategory] = useState("");
  const [sortDirty, setSortDirty] = useState(false);
  const [dirtyProductIds, setDirtyProductIds] = useState(() => new Set());
  const [movementClearedAt, setMovementClearedAt] = useState(() =>
    Number(localStorage.getItem("retail_pos_movement_cleared_at") || 0)
  );

  const canView = hasPosPermission(profile, "pos.products");
  const canCreate = hasPosPermission(profile, "pos.products.create");
  const canEdit = hasPosPermission(profile, "pos.products.edit");
  const canDelete = hasPosPermission(profile, "pos.products.delete");
  const canAdjust = hasPosPermission(profile, "pos.products.adjust_stock");
  const canViewCost = hasPosPermission(profile, "pos.products.view_cost");
  const canClearHistory = hasPosPermission(profile, "pos.products.clear_history");

  const refresh = async () => {
    if (!tenant?.id) return;
    const [nextProducts, nextCategories, nextMovements, nextOrder] = await Promise.all([
      listRetailProducts(tenant.id),
      listRetailCategories(tenant.id),
      listRetailStockMovements(tenant.id),
      loadRetailCatalogOrder(tenant.id).catch(() => []),
    ]);
    setProducts(nextProducts);
    setCategories(nextCategories);
    setMovements(nextMovements);
    setCatalogOrder(nextOrder);
  };

  useEffect(() => {
    let alive = true;
    if (!tenant?.id || !canView) {
      setInitialReady(true);
      return undefined;
    }
    Promise.all([
      listRetailProducts(tenant.id),
      listRetailCategories(tenant.id),
      listRetailStockMovements(tenant.id),
      loadRetailCatalogOrder(tenant.id).catch(() => []),
    ]).then(([nextProducts, nextCategories, nextMovements, nextOrder]) => {
      if (!alive) return;
      setProducts(nextProducts);
      setCategories(nextCategories);
      setMovements(nextMovements);
      setCatalogOrder(nextOrder);
    }).catch(error => {
      console.error("POS_PRODUCTS_LOAD_FAILED", error);
      showToast(error?.message || tr("products.empty"), "error");
    }).finally(() => {
      if (alive) setInitialReady(true);
    });
    return () => { alive = false; };
  }, [tenant?.id, canView]);

  useEffect(() => () => {
    if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const stats = useMemo(() => ({
    count: products.length,
    stock: products.reduce((sum, item) => sum + Number(item.stock || 0), 0),
    low: products.filter(item => Number(item.stock || 0) > 0 && Number(item.stock || 0) <= Number(item.minStock || 0)).length,
    out: products.filter(item => Number(item.stock || 0) <= 0).length,
  }), [products]);

  const productRows = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    return products.filter(product => {
      const matches = !keyword || [product.id, product.barcode, product.name]
        .some(value => String(value || "").toLowerCase().includes(keyword));
      const low = Number(product.stock || 0) > 0 && Number(product.stock || 0) <= Number(product.minStock || 0);
      const out = Number(product.stock || 0) <= 0;
      return matches && (stockFilter === "all" || (stockFilter === "low" && low) || (stockFilter === "out" && out));
    }).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "th"));
  }, [products, productSearch, stockFilter]);

  const productPageCount = Math.max(1, Math.ceil(productRows.length / productPageSize));
  const safeProductPage = Math.min(productPage, productPageCount);
  const productPageRows = productRows.slice((safeProductPage - 1) * productPageSize, safeProductPage * productPageSize);
  const productStart = productRows.length ? (safeProductPage - 1) * productPageSize + 1 : 0;
  const productEnd = Math.min(productRows.length, safeProductPage * productPageSize);

  useEffect(() => { if (productPage > productPageCount) setProductPage(productPageCount); }, [productPage, productPageCount]);

  const enrichedCategories = useMemo(() => {
    const managedKeys = new Set(categories.map(item => nameKey(item.name)));
    const derived = new Map();
    products.forEach(product => {
      const name = clean(product.category || "ทั่วไป") || "ทั่วไป";
      const key = nameKey(name);
      if (managedKeys.has(key) || derived.has(key)) return;
      derived.set(key, {
        id: String(product.categoryId || ""),
        name,
        sortOrder: Number(product.categorySortOrder || 999999),
        active: true,
        derived: true,
      });
    });
    return [...categories, ...derived.values()].map(item => ({
      ...item,
      productCount: products.filter(product =>
        String(product.categoryId || "") === String(item.id || "")
        || nameKey(product.category) === nameKey(item.name)
      ).length,
    }));
  }, [categories, products]);

  const visibleCategories = useMemo(() => {
    const query = nameKey(categorySearch);
    return enrichedCategories.filter(item => {
      if (query && !nameKey(item.name).includes(query)) return false;
      if (categoryStatus === "used" && item.productCount <= 0) return false;
      if (categoryStatus === "empty" && (item.productCount > 0 || item.derived)) return false;
      if (categoryStatus === "derived" && !item.derived) return false;
      return true;
    }).sort((a, b) => {
      if (categorySort === "count-desc") return b.productCount - a.productCount || a.name.localeCompare(b.name, "th");
      if (categorySort === "empty-first") return Number(a.productCount > 0) - Number(b.productCount > 0) || a.name.localeCompare(b.name, "th");
      if (categorySort === "manual") return Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || a.name.localeCompare(b.name, "th");
      return a.name.localeCompare(b.name, "th");
    });
  }, [enrichedCategories, categorySearch, categoryStatus, categorySort]);

  const categoryPageCount = Math.max(1, Math.ceil(visibleCategories.length / categoryPageSize));
  const safeCategoryPage = Math.min(categoryPage, categoryPageCount);
  const categoryPageRows = visibleCategories.slice((safeCategoryPage - 1) * categoryPageSize, safeCategoryPage * categoryPageSize);
  const usedCategoryCount = enrichedCategories.filter(item => item.productCount > 0).length;
  const emptyCategoryCount = enrichedCategories.filter(item => item.productCount === 0 && !item.derived).length;

  useEffect(() => { if (categoryPage > categoryPageCount) setCategoryPage(categoryPageCount); }, [categoryPage, categoryPageCount]);

  const actualCategoryNames = useMemo(() => [...new Set(products.map(product => clean(product.category || "ทั่วไป") || "ทั่วไป"))], [products]);
  const availableCategoryIds = useMemo(() => ["quick", ...actualCategoryNames.map(name => "category:" + name), "all"], [actualCategoryNames]);
  const orderedCategoryIds = useMemo(() => [
    ...catalogOrder.filter(id => availableCategoryIds.includes(id)),
    ...availableCategoryIds.filter(id => !catalogOrder.includes(id)),
  ], [catalogOrder, availableCategoryIds]);

  useEffect(() => {
    const candidate = orderedCategoryIds.find(id => id.startsWith("category:")) || "quick";
    if (!orderedCategoryIds.includes(selectedSortCategory)) setSelectedSortCategory(candidate);
  }, [orderedCategoryIds, selectedSortCategory]);

  const sortProducts = useMemo(() => {
    if (!selectedSortCategory.startsWith("category:")) return [];
    const category = selectedSortCategory.slice(9);
    return products.filter(product => (clean(product.category || "ทั่วไป") || "ทั่วไป") === category)
      .sort((a, b) => Number(a.sortOrder ?? 9999) - Number(b.sortOrder ?? 9999) || a.name.localeCompare(b.name, "th"));
  }, [products, selectedSortCategory]);

  useEffect(() => {
    const touchDevice = "ontouchstart" in window || Number(navigator.maxTouchPoints || 0) > 0;
    const base = {
      animation: 120,
      handle: ".sort-handle",
      ghostClass: "sort-ghost",
      chosenClass: "sort-chosen",
      dragClass: "sort-drag",
      fallbackClass: "sort-fallback",
      forceFallback: Boolean(touchDevice),
      fallbackOnBody: Boolean(touchDevice),
      fallbackTolerance: 5,
      delay: 80,
      delayOnTouchOnly: true,
      touchStartThreshold: 4,
      scroll: true,
      scrollSensitivity: 60,
      scrollSpeed: 14,
      bubbleScroll: true,
    };
    const categorySortable = categorySortRef.current ? new Sortable(categorySortRef.current, {
      ...base,
      onEnd() {
        const ids = [...categorySortRef.current.querySelectorAll("[data-category-id]")].map(node => node.dataset.categoryId);
        setCatalogOrder(ids);
        setSortDirty(true);
      },
    }) : null;
    const productSortable = productSortRef.current && selectedSortCategory.startsWith("category:") ? new Sortable(productSortRef.current, {
      ...base,
      onEnd() {
        const ids = [...productSortRef.current.querySelectorAll("[data-product-id]")].map(node => node.dataset.productId);
        const rank = new Map(ids.map((id, index) => [id, index * 10]));
        setProducts(current => current.map(product => rank.has(product.id) ? { ...product, sortOrder: rank.get(product.id) } : product));
        setDirtyProductIds(current => new Set([...current, ...ids]));
        setSortDirty(true);
      },
    }) : null;
    return () => { categorySortable?.destroy(); productSortable?.destroy(); };
  }, [orderedCategoryIds.join("|"), selectedSortCategory, sortProducts.map(item => item.id + ":" + item.sortOrder).join("|")]);

  const openAddProduct = () => {
    const category = categories.find(item => item.active !== false) || null;
    const next = { ...emptyProduct(), categoryId: category?.id || "", category: category?.name || "" };
    setEditingProductId("");
    setProductForm(next);
    setCategoryPickerSearch(next.category);
    setProductFormError("");
    setImageFile(null);
    setRemoveImage(false);
    setImagePreview(next.imageUrl || "");
    productDialogRef.current?.showModal?.();
  };

  const openEditProduct = product => {
    setEditingProductId(product.id);
    setProductForm({ ...emptyProduct(), ...product, cost: product.cost ?? "" });
    setCategoryPickerSearch(product.category || "");
    setProductFormError("");
    setImageFile(null);
    setRemoveImage(false);
    setImagePreview(product.imageUrl || "");
    productDialogRef.current?.showModal?.();
  };

  const chooseProductCategory = category => {
    setProductForm(current => ({ ...current, categoryId: category?.id || "", category: category?.name || "" }));
    setCategoryPickerSearch(category?.name || "");
    setCategoryPickerOpen(false);
  };

  const productCategoryOptions = useMemo(() => {
    const needle = nameKey(categoryPickerSearch);
    return categories.filter(item => item.active !== false && (!needle || nameKey(item.name).includes(needle)));
  }, [categories, categoryPickerSearch]);

  const openCategoryEditor = (item = null, { fromProduct = false } = {}) => {
    setCategoryEditing(item);
    setCategoryName(item?.name || (fromProduct ? categoryPickerSearch : ""));
    setCategoryFormError("");
    setReopenProductAfterCategory(fromProduct);
    if (fromProduct) productDialogRef.current?.close?.();
    categoryDialogRef.current?.showModal?.();
  };

  const closeCategoryEditor = () => {
    categoryDialogRef.current?.close?.();
    if (reopenProductAfterCategory) {
      setReopenProductAfterCategory(false);
      window.setTimeout(() => productDialogRef.current?.showModal?.(), 20);
    }
  };

  const submitCategory = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setCategoryFormError("");
    try {
      const saved = await saveRetailCategory(tenant.id, {
        id: categoryEditing?.derived ? (categoryEditing.id || "") : (categoryEditing?.id || ""),
        name: categoryName,
        sortOrder: categoryEditing?.sortOrder ?? categories.length * 10,
      });
      const nextCategories = await listRetailCategories(tenant.id);
      setCategories(nextCategories);
      categoryDialogRef.current?.close?.();
      showToast(tr("runtime.category_saved", {
        action: categoryEditing ? tr("runtime.category_action_edit") : tr("runtime.category_action_add"),
        name: saved.name,
      }));
      if (reopenProductAfterCategory) {
        setProductForm(current => ({ ...current, categoryId: saved.id, category: saved.name }));
        setCategoryPickerSearch(saved.name);
        setReopenProductAfterCategory(false);
        window.setTimeout(() => productDialogRef.current?.showModal?.(), 20);
      }
    } catch (error) {
      setCategoryFormError(error?.message || tr("runtime.category_manage_failed"));
    } finally {
      setSaving(false);
    }
  };

  const removeCategory = async item => {
    if (!await sweetConfirm(tr("runtime.category_delete_confirm", { name: item.name }), {
      title: tr("runtime.category_delete_title"),
      confirmText: tr("common.delete"),
      type: "warning",
    })) return;
    try {
      await deleteRetailCategory(tenant.id, item.id);
      await refresh();
      showToast(tr("runtime.category_deleted", { name: item.name }));
    } catch (error) {
      showToast(error?.code === "CATEGORY_IN_USE" || error?.message === "CATEGORY_IN_USE"
        ? tr("runtime.category_in_use")
        : (error?.message || tr("runtime.category_manage_failed")), "error");
    }
  };

  const submitProduct = async event => {
    event.preventDefault();
    if (saving) return;
    setProductFormError("");
    const id = clean(editingProductId || productForm.id).toUpperCase();
    if (!PRODUCT_PATTERN.test(id)) {
      setProductFormError(tr("runtime.product_code_format"));
      return;
    }
    if (!clean(productForm.barcode) || !clean(productForm.name) || !clean(productForm.unit) || !productForm.categoryId
      || Number(productForm.price) < 0 || Number(productForm.stock) < 0 || Number(productForm.minStock) < 0
      || (productForm.cost !== "" && Number(productForm.cost) < 0)) {
      setProductFormError(tr("runtime.product_required"));
      return;
    }
    setSaving(true);
    try {
      const old = editingProductId ? products.find(item => item.id === editingProductId) : null;
      let image = {
        imageUrl: clean(productForm.imageUrl),
        imagePath: productForm.imagePath || "",
        imageKey: productForm.imageKey || "",
      };
      if (removeImage) {
        await deleteRetailProductImage(old || productForm);
        image = { imageUrl: "", imagePath: "", imageKey: "" };
      } else if (imageFile) {
        const uploaded = await uploadRetailProductImage(tenant.id, id, imageFile);
        if (old?.imagePath && old.imagePath !== uploaded.imagePath) await deleteRetailProductImage(old);
        image = uploaded;
      } else if (old?.imagePath && clean(productForm.imageUrl) !== clean(old.imageUrl)) {
        await deleteRetailProductImage(old);
        image = { imageUrl: clean(productForm.imageUrl), imagePath: "", imageKey: "" };
      }
      await saveRetailProduct(tenant.id, { ...productForm, ...image, id }, editingProductId);
      productDialogRef.current?.close?.();
      await refresh();
      showToast(editingProductId ? tr("runtime.product_updated") : tr("runtime.product_added"));
    } catch (error) {
      const code = String(error?.message || "");
      const messages = {
        PRODUCT_REQUIRED_FIELDS: tr("runtime.product_required"),
        INVALID_PRODUCT_ID: tr("runtime.product_code_format"),
        DUPLICATE_PRODUCT_ID: tr("runtime.product_code_exists"),
        DUPLICATE_BARCODE: tr("runtime.barcode_exists"),
      };
      setProductFormError(messages[code] || code || tr("runtime.product_required"));
    } finally {
      setSaving(false);
    }
  };

  const removeProduct = async product => {
    if (!await sweetConfirm(tr("runtime.delete_product_confirm", { name: product.name }), {
      title: tr("runtime.delete_product_title"),
      confirmText: tr("common.delete"),
      type: "warning",
    })) return;
    try {
      await deleteRetailProductImage(product);
      await deleteRetailProduct(tenant.id, product);
      await refresh();
      showToast(tr("runtime.product_deleted"));
    } catch (error) {
      showToast(tr("runtime.product_delete_failed", { error: error?.message || "error" }), "error");
    }
  };

  const openStock = product => {
    setStockForm({ productId: product.id, action: "add", quantity: 1, note: "" });
    setStockFormError("");
    stockDialogRef.current?.showModal?.();
  };

  const submitStock = async event => {
    event.preventDefault();
    if (saving) return;
    const quantity = Number(stockForm.quantity);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setStockFormError(tr("runtime.stock_quantity_invalid"));
      return;
    }
    setSaving(true);
    try {
      await adjustRetailStock(tenant.id, stockForm.productId, stockForm.action, quantity, stockForm.note || tr("runtime.stock_default_note"));
      stockDialogRef.current?.close?.();
      await refresh();
      showToast(tr("runtime.stock_adjusted"));
    } catch (error) {
      setStockFormError(error?.message === "NEGATIVE_STOCK" ? tr("runtime.stock_negative") : (error?.message || tr("runtime.stock_quantity_invalid")));
    } finally {
      setSaving(false);
    }
  };

  const saveSort = async () => {
    if (!canEdit) {
      showToast(tr("runtime.sort_no_permission"), "error");
      return;
    }
    if (!sortDirty || saving) {
      if (!sortDirty) showToast(tr("runtime.sort_nothing"));
      return;
    }
    setSaving(true);
    try {
      const changed = products.filter(product => dirtyProductIds.has(product.id));
      await saveRetailCatalogOrder(tenant.id, orderedCategoryIds, changed);
      setCatalogOrder(orderedCategoryIds);
      setDirtyProductIds(new Set());
      setSortDirty(false);
      showToast(tr("runtime.sort_saved"));
    } catch (error) {
      showToast(tr("runtime.sort_save_failed", { error: error?.message || tr("runtime.try_again") }), "error");
    } finally {
      setSaving(false);
    }
  };

  const visibleMovements = useMemo(() => movements
    .filter(item => movementTime(item.createdAtServer || item.createdAt || item.updatedAt) > movementClearedAt)
    .slice(0, 50), [movements, movementClearedAt]);

  const clearMovements = async () => {
    if (!visibleMovements.length || !await sweetConfirm(tr("runtime.clear_history_confirm"), {
      title: tr("runtime.clear_history_title"),
      confirmText: tr("movements.clear"),
      type: "warning",
    })) return;
    const timestamp = Date.now();
    localStorage.setItem("retail_pos_movement_cleared_at", String(timestamp));
    setMovementClearedAt(timestamp);
    showToast(tr("runtime.history_cleared"));
  };

  if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady || !initialReady) {
    return <PageReadyOverlay context="LUKKAJA" title={t("shared.state.loading")} message={t("shared.state.please_wait")} progress={92} />;
  }
  if (!profile) return <Navigate to="/login?next=%2Fpos%2Fproducts" replace />;
  if (!tenant || !canView) return <Navigate to="/pos" replace />;

  const selectedStockProduct = products.find(item => item.id === stockForm.productId);
  const pageNumbers = pagesAround(safeProductPage, productPageCount);
  const categoryNumbers = pagesAround(safeCategoryPage, categoryPageCount);

  return (
    <>
      <header className="pos-header" data-pos-management-header>
        <div className="app-title"><div><strong>{tr("header.title")}</strong><small>{tr("header.subtitle")}</small></div></div>
        <div className="header-actions">
          <PosNavigation profile={profile} currentKey="pos.products" />
          <LocaleSwitcher />
          <UserMenu profile={profile} />
        </div>
      </header>

      <main data-pos-management className="management-container">
        <section className="stats-grid">
          <article className="stat-card"><span>{tr("stats.product_count")}</span><strong>{formatNumber(stats.count)}</strong></article>
          <article className="stat-card"><span>{tr("stats.stock_total")}</span><strong>{formatNumber(stats.stock)}</strong></article>
          <article className="stat-card warning"><span>{tr("stats.low_stock")}</span><strong>{formatNumber(stats.low)}</strong></article>
          <article className="stat-card danger"><span>{tr("stats.out_of_stock")}</span><strong>{formatNumber(stats.out)}</strong></article>
        </section>

        <section className="panel management-panel">
          <div className="section-heading product-list-heading">
            <div><h2>{tr("products.title")}</h2><p>{tr("products.description")}</p></div>
            {canCreate ? <button id="addProductBtn" className="btn btn-pay" type="button" onClick={openAddProduct}>{tr("products.add")}</button> : null}
          </div>
          <div className="toolbar">
            <input id="productSearch" value={productSearch} onChange={event => { setProductSearch(event.target.value); setProductPage(1); }} placeholder={tr("products.search_placeholder")} />
            <select id="stockFilter" value={stockFilter} onChange={event => { setStockFilter(event.target.value); setProductPage(1); }}>
              <option value="all">{tr("products.filter_all")}</option><option value="low">{tr("products.filter_low")}</option><option value="out">{tr("products.filter_out")}</option>
            </select>
          </div>
          <div className="table-wrap">
            <table className="product-table">
              <thead><tr><th>{tr("products.columns.id")}</th><th>{tr("products.columns.product")}</th><th>{tr("products.columns.barcode")}</th><th className="number">{tr("products.columns.price")}</th><th className="number">{tr("products.columns.stock")}</th><th>{tr("products.columns.unit")}</th><th></th></tr></thead>
              <tbody id="productTableBody">
                {productPageRows.map(product => {
                  const low = Number(product.stock || 0) > 0 && Number(product.stock || 0) <= Number(product.minStock || 0);
                  const out = Number(product.stock || 0) <= 0;
                  const category = clean(product.category);
                  return <tr key={product.id}>
                    <td>{product.id}</td>
                    <td>
                      <div className="product-cell">
                        <div className="product-thumb">{product.imageUrl ? <img src={product.imageUrl} alt={product.name} loading="lazy" /> : clean(product.name).slice(0, 2).toUpperCase()}</div>
                        <div><div className="product-name">{product.name}</div><div className="product-sub">{tr("runtime.low_stock_alert", { stock: formatNumber(product.minStock || 0) })}{canViewCost ? <> • {product.cost != null ? tr("runtime.cost", { amount: Number(product.cost).toFixed(2) }) : tr("runtime.cost_unset")}</> : null}</div><div className="merch-tags">{category ? <span className="merch-tag">{category}</span> : null}{product.showOnPos === false ? <span className="merch-tag hidden">{tr("merch.hidden_on_pos")}</span> : null}</div></div>
                      </div>
                    </td>
                    <td>{product.barcode}</td><td className="number">{Number(product.price || 0).toFixed(2)}</td>
                    <td className="number"><span className={"stock-badge" + (out ? " out" : low ? " low" : "")}>{formatNumber(product.stock || 0)}</span></td>
                    <td>{product.unit}</td>
                    <td><div className="row-actions">
                      {canAdjust ? <button type="button" className="stock" onClick={() => openStock(product)}>{tr("common.adjust_stock")}</button> : null}
                      {canEdit ? <button type="button" onClick={() => openEditProduct(product)}>{tr("common.edit")}</button> : null}
                      {canDelete ? <button type="button" className="delete" onClick={() => removeProduct(product)}>{tr("common.delete")}</button> : null}
                    </div></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          {!productRows.length ? <div id="tableEmpty" className="empty-state">{tr("products.empty")}</div> : null}
          {productRows.length ? <nav id="productPagination" className="product-pagination" aria-label={tr("products.pagination_aria")}>
            <div className="pagination-summary"><span>{tr("common.showing", { start: formatNumber(productStart), end: formatNumber(productEnd), total: formatNumber(productRows.length) })}</span><label>{tr("common.per_page")} <select value={productPageSize} onChange={event => { setProductPageSize(Number(event.target.value)); setProductPage(1); }}>{PRODUCT_PAGE_SIZES.map(size => <option value={size} key={size}>{size}</option>)}</select> {tr("common.items")}</label></div>
            <div className="page-controls"><button type="button" disabled={safeProductPage <= 1} onClick={() => setProductPage(page => page - 1)}><i className="bi bi-chevron-left"></i></button>
              {pageNumbers.map((page, index) => <span key={page}>{index > 0 && page - pageNumbers[index - 1] > 1 ? <span className="page-ellipsis">…</span> : null}<button type="button" className={"page-number" + (page === safeProductPage ? " active" : "")} onClick={() => setProductPage(page)}>{formatNumber(page)}</button></span>)}
              <button type="button" disabled={safeProductPage >= productPageCount} onClick={() => setProductPage(page => page + 1)}><i className="bi bi-chevron-right"></i></button>
            </div>
          </nav> : null}
        </section>

        <section className="panel category-manager-panel" id="productCategoryManager">
          <div className="section-heading category-manager-heading"><div><div className="category-manager-title-row"><h2>{tr("categories.title")}</h2><span className="category-count-badge">{tr("categories.count", { count: formatNumber(enrichedCategories.length) })}</span></div><p>{tr("categories.description")}</p></div>{canCreate ? <button className="btn btn-pay" type="button" onClick={() => openCategoryEditor()}><i className="bi bi-plus-lg"></i><span>{tr("categories.add")}</span></button> : null}</div>
          <div className="category-manager-toolbar">
            <div className="category-search-control"><i className="bi bi-search"></i><input type="search" value={categorySearch} onChange={event => { setCategorySearch(event.target.value); setCategoryPage(1); }} placeholder={tr("categories.search_placeholder")} />{categorySearch ? <button className="category-search-clear" type="button" onClick={() => setCategorySearch("")}><i className="bi bi-x-lg"></i></button> : null}</div>
            <div className="category-toolbar-controls">
              <label className="category-filter-control">{tr("categories.status")}<select value={categoryStatus} onChange={event => { setCategoryStatus(event.target.value); setCategoryPage(1); }}><option value="all">{tr("categories.status_all")}</option><option value="used">{tr("categories.status_used")}</option><option value="empty">{tr("categories.status_empty")}</option><option value="derived">{tr("categories.status_derived")}</option></select></label>
              <label className="category-filter-control">{tr("categories.sort")}<select value={categorySort} onChange={event => setCategorySort(event.target.value)}><option value="name">{tr("categories.sort_name")}</option><option value="count-desc">{tr("categories.sort_count")}</option><option value="empty-first">{tr("categories.sort_empty")}</option><option value="manual">{tr("categories.sort_manual")}</option></select></label>
              <label className="category-filter-control">{tr("categories.page_size")}<select value={categoryPageSize} onChange={event => { setCategoryPageSize(Number(event.target.value)); setCategoryPage(1); }}>{CATEGORY_PAGE_SIZES.map(size => <option key={size} value={size}>{tr("categories.page_size_option", { count: size })}</option>)}</select></label>
            </div>
          </div>
          <div className="category-manager-summary"><span className="category-summary-chip"><strong>{formatNumber(visibleCategories.length)}</strong>{tr("categories.summary_visible")}</span><span className="category-summary-chip"><strong>{formatNumber(usedCategoryCount)}</strong>{tr("categories.status_used")}</span><span className="category-summary-chip"><strong>{formatNumber(emptyCategoryCount)}</strong>{tr("categories.status_empty")}</span></div>
          <div className="category-manager-root">
            {categoryPageRows.length ? <><div className="category-list-head"><span>{tr("categories.title")}</span><span>{tr("categories.product_count")}</span><span>{tr("categories.status")}</span><span>{tr("categories.manage")}</span></div>
              {categoryPageRows.map(item => {
                const status = item.derived ? ["derived", tr("categories.status_derived")] : item.productCount > 0 ? ["used", tr("categories.status_used")] : ["empty", tr("categories.status_empty")];
                return <article className="category-row" key={(item.id || "derived") + ":" + item.name}><div className="category-main"><span className="category-avatar">{item.name.slice(0, 1)}</span><div className="category-main-text"><strong>{item.name}</strong><small>{item.derived ? tr("categories.derived_help") : tr("categories.ready_pos")}</small></div></div><div className="category-product-count"><strong>{formatNumber(item.productCount)}</strong><span>{tr("common.items")}</span></div><div className="category-status-cell"><span className={"category-status " + status[0]}>{status[1]}</span></div><div className="category-card-actions">{item.derived ? (canCreate ? <button type="button" className="save" onClick={() => openCategoryEditor(item)}><i className="bi bi-cloud-arrow-up"></i>{tr("categories.save_derived")}</button> : null) : <>{canEdit ? <button type="button" className="edit" onClick={() => openCategoryEditor(item)}><i className="bi bi-pencil-square"></i>{tr("common.edit")}</button> : null}{canDelete ? <button type="button" className="delete" onClick={() => removeCategory(item)}><i className="bi bi-trash3"></i>{tr("common.delete")}</button> : null}</>}</div></article>;
              })}
            </> : <div className="category-manager-empty"><strong>{enrichedCategories.length ? tr("categories.no_match") : tr("categories.empty_title")}</strong><span>{enrichedCategories.length ? tr("categories.no_match_help") : tr("categories.empty_help")}</span></div>}
          </div>
          {visibleCategories.length > categoryPageSize ? <nav className="category-pagination"><div className="category-pagination-summary">{tr("common.showing_short", { start: formatNumber((safeCategoryPage - 1) * categoryPageSize + 1), end: formatNumber(Math.min(safeCategoryPage * categoryPageSize, visibleCategories.length)), total: formatNumber(visibleCategories.length) })}</div><div className="category-page-controls"><button type="button" disabled={safeCategoryPage <= 1} onClick={() => setCategoryPage(page => page - 1)}><i className="bi bi-chevron-left"></i></button>{categoryNumbers.map((page, index) => <span key={page}>{index > 0 && page - categoryNumbers[index - 1] > 1 ? <span className="category-page-ellipsis">…</span> : null}<button type="button" className={"category-page-number" + (page === safeCategoryPage ? " active" : "")} onClick={() => setCategoryPage(page)}>{page}</button></span>)}<button type="button" disabled={safeCategoryPage >= categoryPageCount} onClick={() => setCategoryPage(page => page + 1)}><i className="bi bi-chevron-right"></i></button></div></nav> : null}
        </section>

        <section className="panel sort-manager-panel" id="productSortManager"><div className="section-heading"><div><h2>{tr("sort_manager.title")}</h2><p>{tr("sort_manager.description")}</p></div></div>
          <div className="sort-manager-root">
            <div className="sort-column"><div className="sort-column-head"><div><h3>{tr("sort_manager.category_title")}</h3><span>{tr("sort_manager.category_help")}</span></div></div><div className="sort-list" ref={categorySortRef}>{orderedCategoryIds.map((id, index) => <div className={"sort-row" + (id === selectedSortCategory ? " active" : "") + (id === "quick" ? " best-seller" : "")} data-category-id={id} key={id}><span className="sort-handle"><i className="bi bi-grip-vertical"></i></span><button type="button" className="sort-row-main" onClick={() => setSelectedSortCategory(id)}><span className="sort-row-title">{id === "quick" ? tr("sort_manager.best_sellers") : id === "all" ? tr("sort_manager.all") : id.slice(9)}</span></button><span className="sort-order-badge">{index + 1}</span></div>)}</div></div>
            <div className="sort-column"><div className="sort-column-head"><div><h3>{tr("sort_manager.products_title", { category: selectedSortCategory === "quick" ? tr("sort_manager.best_sellers") : selectedSortCategory === "all" ? tr("sort_manager.all") : selectedSortCategory.slice(9) })}</h3><span>{tr("sort_manager.products_help")}</span></div></div>
              <div className="sort-list" ref={productSortRef}>{selectedSortCategory === "quick" ? <div className="sort-empty">{tr("sort_manager.best_sellers_locked")}</div> : selectedSortCategory === "all" ? <div className="sort-empty">{tr("sort_manager.all_auto")}</div> : sortProducts.length ? sortProducts.map((product, index) => <div className="sort-row" data-product-id={product.id} key={product.id}><span className="sort-handle"><i className="bi bi-grip-vertical"></i></span><div className="sort-row-main"><span className="sort-row-title">{product.name}</span><span className="sort-row-meta">{product.id} • {product.barcode || tr("sort_manager.no_barcode")}</span></div><span className="sort-order-badge">{index + 1}</span></div>) : <div className="sort-empty">{tr("sort_manager.category_empty")}</div>}</div>
              <div className="sort-footer"><p className="sort-note">{tr("sort_manager.note")}</p><button className="sort-save" type="button" disabled={saving} onClick={saveSort}>{saving ? tr("sort_manager.saving") : tr("sort_manager.save")}</button></div>
            </div>
          </div>
        </section>

        <section className="panel movement-panel"><div className="section-heading"><div><h2>{tr("movements.title")}</h2><p>{tr("movements.description")}</p></div>{canClearHistory ? <button id="clearMovementBtn" className="btn btn-danger" type="button" onClick={clearMovements}>{tr("movements.clear")}</button> : null}</div>
          <div className="movement-list">{visibleMovements.map(item => { const before = Number(item.before ?? item.stockBefore ?? 0), after = Number(item.after ?? item.stockAfter ?? before), delta = after - before; return <article className="movement-item" key={item.id}><div><strong>{item.productName || item.productId}</strong><div className="movement-meta">{item.productId} • {item.note || tr("runtime.stock_default_note")} • {new Date(movementTime(item.createdAtServer || item.createdAt || item.updatedAt)).toLocaleString()} • {tr("common.synced")}</div></div><div className={"movement-qty " + (delta >= 0 ? "plus" : "minus")}>{delta > 0 ? "+" : ""}{formatNumber(delta)} ({formatNumber(before)} → {formatNumber(after)})</div></article>; })}</div>
          {!visibleMovements.length ? <div className="empty-state">{tr("movements.empty")}</div> : null}
        </section>
      </main>

      <dialog data-pos-management-dialog id="productDialog" ref={productDialogRef}>
        <form className="payment-form" onSubmit={submitProduct}>
          <div className="dialog-head"><h2>{editingProductId ? tr("product_form.edit_title") : tr("product_form.add_title")}</h2><button type="button" className="icon-btn" onClick={() => productDialogRef.current?.close?.()}><i className="bi bi-x-lg"></i></button></div>
          <div className="form-grid">
            <label>{tr("product_form.id")}<input required maxLength={10} value={productForm.id} disabled={Boolean(editingProductId)} onChange={event => setProductForm(current => ({ ...current, id: event.target.value.toUpperCase() }))} placeholder={tr("product_form.id_placeholder")} /></label>
            <label>{tr("product_form.barcode")}<input required maxLength={50} inputMode="numeric" value={productForm.barcode} onChange={event => setProductForm(current => ({ ...current, barcode: event.target.value }))} /></label>
            <label className="full">{tr("product_form.name")}<input required maxLength={120} value={productForm.name} onChange={event => setProductForm(current => ({ ...current, name: event.target.value }))} /></label>
            <label>{tr("product_form.price")}<input required type="number" min="0" step="0.01" value={productForm.price} onChange={event => setProductForm(current => ({ ...current, price: event.target.value }))} /></label>
            <label>{tr("product_form.unit")}<input required maxLength={30} value={productForm.unit} onChange={event => setProductForm(current => ({ ...current, unit: event.target.value }))} placeholder={tr("product_form.unit_placeholder")} /></label>
            <label>{tr("product_form.initial_stock")}<input required type="number" min="0" step="1" value={productForm.stock} onChange={event => setProductForm(current => ({ ...current, stock: event.target.value }))} /></label>
            <label>{tr("product_form.min_stock")}<input required type="number" min="0" step="1" value={productForm.minStock} onChange={event => setProductForm(current => ({ ...current, minStock: event.target.value }))} /></label>
            <section className="merch-form-section">
              <h3>{tr("merch.title")}</h3><div className="merch-grid">
                {canViewCost ? <label>{tr("merch.cost")}<input type="number" min="0" step="0.01" value={productForm.cost} onChange={event => setProductForm(current => ({ ...current, cost: event.target.value }))} placeholder={tr("merch.cost_placeholder")} /></label> : null}
                <label>{tr("merch.category")}<div className="category-combobox"><input type="search" value={categoryPickerSearch} onFocus={() => setCategoryPickerOpen(true)} onChange={event => { setCategoryPickerSearch(event.target.value); setProductForm(current => ({ ...current, categoryId: "", category: "" })); setCategoryPickerOpen(true); }} placeholder={tr("merch.category_search")} />{categoryPickerOpen ? <div className="category-combobox-options"><button type="button" className="category-combobox-create" onClick={() => openCategoryEditor(null, { fromProduct: true })}><i className="bi bi-plus-circle"></i><span>{tr("merch.create_category")}</span></button>{productCategoryOptions.map(category => <button type="button" key={category.id} onClick={() => chooseProductCategory(category)}><span>{category.name}</span></button>)}{!productCategoryOptions.length ? <p className="category-combobox-empty">{tr("merch.category_not_found")}</p> : null}</div> : null}</div></label>
                <label>{tr("merch.sort_order")}<input type="number" min="0" step="1" value={productForm.sortOrder} onChange={event => setProductForm(current => ({ ...current, sortOrder: event.target.value }))} /></label>
                <label className="full">{tr("merch.upload_image")}<input type="file" accept="image/*" onChange={event => { const file = event.target.files?.[0] || null; setImageFile(file); setRemoveImage(false); if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview); setImagePreview(file ? URL.createObjectURL(file) : clean(productForm.imageUrl)); }} /></label>
                <label className="full">{tr("merch.image_url")}<input type="url" maxLength={1000} value={productForm.imageUrl} onChange={event => { setProductForm(current => ({ ...current, imageUrl: event.target.value })); if (!imageFile) setImagePreview(event.target.value); }} placeholder={tr("merch.image_url_placeholder")} /></label>
                <div className="full image-editor-row"><div className="product-image-preview">{imagePreview ? <img src={imagePreview} alt={tr("merch.image_alt")} /> : clean(productForm.name).slice(0, 2).toUpperCase() || tr("merch.no_image")}</div><button className="btn btn-danger" type="button" onClick={() => { setImageFile(null); setRemoveImage(true); setImagePreview(""); setProductForm(current => ({ ...current, imageUrl: "" })); }}>{tr("merch.remove_image")}</button></div>
              </div><div className="merch-options"><label><input type="checkbox" checked={productForm.showOnPos !== false} onChange={event => setProductForm(current => ({ ...current, showOnPos: event.target.checked }))} /> {tr("merch.show_on_pos")}</label></div>{canViewCost ? <p className="product-sub">{tr("merch.cost_help")}</p> : null}
            </section>
          </div>
          <p className="error-text">{productFormError}</p><div className="dialog-actions"><button type="button" className="btn btn-secondary" onClick={() => productDialogRef.current?.close?.()}>{tr("common.cancel")}</button><button type="submit" className="btn btn-pay" disabled={saving}>{tr("product_form.save")}</button></div>
        </form>
      </dialog>

      <dialog data-pos-management-dialog id="categoryDialog" ref={categoryDialogRef}><form className="payment-form" onSubmit={submitCategory}><div className="dialog-head"><h2>{categoryEditing?.id && !categoryEditing?.derived ? tr("category_form.edit_title") : tr("category_form.add_title")}</h2><button type="button" className="icon-btn" onClick={closeCategoryEditor}><i className="bi bi-x-lg"></i></button></div><label>{tr("category_form.name")}<input type="text" maxLength={80} required value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder={tr("category_form.placeholder")} /></label><p className="category-dialog-hint">{categoryEditing?.productCount ? tr("category_form.hint_with_count", { count: formatNumber(categoryEditing.productCount) }) : tr("category_form.hint_empty")}</p><p className="error-text">{categoryFormError}</p><div className="dialog-actions"><button type="button" className="btn btn-secondary" onClick={closeCategoryEditor}>{tr("common.cancel")}</button><button type="submit" className="btn btn-pay" disabled={saving}>{tr("category_form.save")}</button></div></form></dialog>

      <dialog data-pos-management-dialog id="stockDialog" ref={stockDialogRef}><form className="payment-form" onSubmit={submitStock}><div className="dialog-head"><h2>{tr("stock_form.title")}</h2><button type="button" className="icon-btn" onClick={() => stockDialogRef.current?.close?.()}><i className="bi bi-x-lg"></i></button></div><div className="stock-product-name">{selectedStockProduct ? tr("stock_form.remaining", { product: selectedStockProduct.name, stock: formatNumber(selectedStockProduct.stock) + " " + selectedStockProduct.unit }) : ""}</div><label>{tr("stock_form.action")}<select value={stockForm.action} onChange={event => setStockForm(current => ({ ...current, action: event.target.value }))}><option value="add">{tr("stock_form.add")}</option><option value="remove">{tr("stock_form.remove")}</option><option value="set">{tr("stock_form.set")}</option></select></label><label>{tr("stock_form.quantity")}<input required type="number" min="0" step="1" value={stockForm.quantity} onChange={event => setStockForm(current => ({ ...current, quantity: event.target.value }))} /></label><label>{tr("stock_form.note")}<input maxLength={150} value={stockForm.note} onChange={event => setStockForm(current => ({ ...current, note: event.target.value }))} placeholder={tr("stock_form.note_placeholder")} /></label><p className="error-text">{stockFormError}</p><div className="dialog-actions"><button type="button" className="btn btn-secondary" onClick={() => stockDialogRef.current?.close?.()}>{tr("common.cancel")}</button><button type="submit" className="btn btn-pay" disabled={saving}>{tr("stock_form.confirm")}</button></div></form></dialog>
    </>
  );
}
