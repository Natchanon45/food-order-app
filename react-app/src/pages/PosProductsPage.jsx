import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Sortable from "sortablejs";
import { useAuth } from "@/auth/AuthProvider";
import { canUseRetailPos, getRetailPosSession } from "@/auth/retailPosSession";
import { AppDeveloperPanel } from "@/components/AppDeveloperPanel";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { PageReadyOverlay } from "@/components/PageReadyOverlay";
import { firstAllowedPosPage, getPosPermissions, PosNavigation } from "@/components/PosNavigation";
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
  watchRetailCatalogOrder,
  watchRetailCategories,
  watchRetailProducts,
  watchRetailStockMovements,
  saveRetailCategory,
  saveRetailProduct,
  uploadRetailProductImage,
} from "@/data/retailProductsData";
import { loadPosRoleSettings } from "@/data/retailPosSystemData";
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
const BUILTIN_POS_ROLES = new Set(["owner", "admin", "manager", "cashier", "stock", "kitchen"]);
const ROLE_SETTINGS_TIMEOUT_MS = 6000;
const INITIAL_DATA_TIMEOUT_MS = 10000;
const cachedPosRoles = () => {
  try {
    const rows = JSON.parse(localStorage.getItem("retail_pos_roles_v1") || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
};
const withTimeout = (promise, timeoutMs, code) => Promise.race([
  promise,
  new Promise((_, reject) => window.setTimeout(() => {
    const error = new Error(code);
    error.code = code;
    reject(error);
  }, timeoutMs)),
]);

function hasPosPermission(profile, roleRows, permission) {
  if (!profile) return false;
  const roleId = String(profile.roleId || profile.role || "");
  if (roleId === "owner") return true;
  const roles = Array.isArray(roleRows) ? roleRows : [];
  const role = roles.find(item => String(item?.id || "") === roleId);
  if (Array.isArray(role?.permissions) && role.permissions.length) {
    if (role.permissions.includes("*")) return true;
    return role.permissions.includes(permission);
  }
  if (roleId === "admin" || roleId === "manager") {
    return !["pos.backup", "pos.users", "pos.backup.restore"].includes(permission);
  }
  if (roleId === "stock") {
    return ["pos.products", "pos.products.adjust_stock", "pos.stock_movements", "pos.stock_counts",
      "pos.purchases", "pos.suppliers"].includes(permission);
  }
  return false;
}

let zxingLoader = null;
function loadZxing() {
  if (globalThis.ZXing) return Promise.resolve(globalThis.ZXing);
  if (zxingLoader) return zxingLoader;
  zxingLoader = new Promise((resolve, reject) => {
    const old = document.querySelector('script[data-zxing="1"]');
    if (old) {
      old.addEventListener("load", () => resolve(globalThis.ZXing), { once: true });
      old.addEventListener("error", reject, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.dataset.zxing = "1";
    script.src = "https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js";
    script.onload = () => globalThis.ZXing ? resolve(globalThis.ZXing) : reject(new Error("ZXing not available"));
    script.onerror = reject;
    document.head.appendChild(script);
  }).catch(error => {
    zxingLoader = null;
    throw error;
  });
  return zxingLoader;
}

export function PosProductsPage() {
  const authState = useAuth();
  const tenantState = useTenant();
  const { profile, user: authUser } = authState;
  const { tenant } = tenantState;
  const { t, formatNumber } = useI18n();
  const tr = useCallback((key, replacements = {}) => t("pos_products." + key, replacements), [t]);
  const stylesReady = useParityPage({
    title: tr("meta.title"),
    attributes: { "data-module": "retail-pos-products" },
    disabledGlobalStyles: ["app.css", "icons.css", "shared-responsive.css"],
    styles: [
      "app-version-badge-runtime.css",
      "retail-pos-font-local.css",
      "pos-locale-switcher-placement.css",
      "retail-pos.css",
      "retail-products.css",
      "retail-products-sort-manager.css",
      "retail-pos-navigation.css",
      "retail-product-categories.css",
      "retail-product-merchandising.css",
      "retail-barcode-scan-tools.css",
      "sweet-dialog.css",
    ],
  });

  const productDialogRef = useRef(null);
  const categoryDialogRef = useRef(null);
  const stockDialogRef = useRef(null);
  const scanDialogRef = useRef(null);
  const scanVideoRef = useRef(null);
  const scanStreamRef = useRef(null);
  const scanDetectorRef = useRef(null);
  const scanFrameRef = useRef(0);
  const zxingReaderRef = useRef(null);
  const zxingControlsRef = useRef(null);
  const scanTargetRef = useRef("");
  const toastTimerRef = useRef(0);
  const categorySortRef = useRef(null);
  const productSortRef = useRef(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [movements, setMovements] = useState([]);
  const [catalogOrder, setCatalogOrder] = useState([]);
  const [initialReady, setInitialReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleRows, setRoleRows] = useState(() => cachedPosRoles());
  const [rolesReady, setRolesReady] = useState(() => {
    const session = getRetailPosSession();
    const roleId = String(session?.roleId || session?.role || "");
    return BUILTIN_POS_ROLES.has(roleId) || cachedPosRoles().length > 0;
  });
  const [scanStatus, setScanStatus] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState("success");

  const [productSearch, setProductSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(20);

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

  const showToast = useCallback((message, type = "success") => {
    setToastType(type === "error" ? "error" : "success");
    setToastMessage(String(message || ""));
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMessage(""), 2600);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  const posSession = useMemo(() => getRetailPosSession(), [
    authUser?.uid,
    profile?.id,
    profile?.uid,
    profile?.tenantId,
    profile?.role,
    profile?.roleId,
  ]);
  const posAccessProfile = useMemo(() => ({
    ...(profile || {}),
    ...(posSession || {}),
    role: posSession?.role || profile?.role || profile?.roleId || "",
    roleId: posSession?.roleId || posSession?.role || profile?.roleId || profile?.role || "",
  }), [profile, posSession]);

  const pagePermissions = useMemo(
    () => getPosPermissions(posAccessProfile, roleRows),
    [posAccessProfile, roleRows],
  );
  const canView = pagePermissions.has("pos.products")
    || hasPosPermission(posAccessProfile, roleRows, "pos.products");
  const canCreate = hasPosPermission(posAccessProfile, roleRows, "pos.products.create");
  const canEdit = hasPosPermission(posAccessProfile, roleRows, "pos.products.edit");
  const canDelete = hasPosPermission(posAccessProfile, roleRows, "pos.products.delete");
  const canAdjust = hasPosPermission(posAccessProfile, roleRows, "pos.products.adjust_stock");
  const canViewCost = hasPosPermission(posAccessProfile, roleRows, "pos.products.view_cost");
  const canClearHistory = hasPosPermission(posAccessProfile, roleRows, "pos.products.clear_history");

  const redirectTarget = useMemo(() => {
    if (authState.status === "loading" || tenantState.status === "loading" || !stylesReady) return "";
    const requested = location.pathname + location.search;
    if (!profile) return "/pos/login/?next=" + encodeURIComponent(requested);
    if (!canUseRetailPos(posAccessProfile) || tenantState.status === "error" || !tenant) return "/";
    if (!rolesReady) return "";
    if (!canView) {
      const first = firstAllowedPosPage(posAccessProfile, roleRows);
      return first === "/pos/forbidden"
        ? "/pos/forbidden/?permission=pos.products&next=" + encodeURIComponent(requested)
        : first + "?from=permission";
    }
    return "";
  }, [
    authState.status,
    tenantState.status,
    tenant,
    profile,
    posAccessProfile,
    canView,
    roleRows,
    rolesReady,
    stylesReady,
  ]);
  useEffect(() => {
    if (redirectTarget) location.replace(redirectTarget);
  }, [redirectTarget]);

  useEffect(() => {
    let alive = true;
    if (!tenant?.id || !profile) {
      setRoleRows([]);
      setRolesReady(true);
      return () => { alive = false; };
    }

    const cached = cachedPosRoles();
    const roleId = String(posAccessProfile?.roleId || posAccessProfile?.role || "");
    if (cached.length) setRoleRows(cached);
    setRolesReady(BUILTIN_POS_ROLES.has(roleId) || cached.length > 0);

    withTimeout(loadPosRoleSettings(tenant.id), ROLE_SETTINGS_TIMEOUT_MS, "POS_ROLE_SETTINGS_TIMEOUT").then(rows => {
      if (!alive) return;
      const normalized = Array.isArray(rows) ? rows : [];
      setRoleRows(normalized);
      try { localStorage.setItem("retail_pos_roles_v1", JSON.stringify(normalized)); } catch {}
    }).catch(error => {
      console.warn("POS_PRODUCTS_ROLE_SETTINGS_LOAD_FAILED", error);
      if (!alive) return;
      if (!cached.length && !BUILTIN_POS_ROLES.has(roleId)) setRoleRows([]);
    }).finally(() => {
      if (alive) setRolesReady(true);
    });
    return () => { alive = false; };
  }, [
    tenant?.id,
    profile?.id,
    profile?.uid,
    profile?.role,
    profile?.roleId,
    posAccessProfile?.role,
    posAccessProfile?.roleId,
  ]);

  const refresh = useCallback(async () => {
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
  }, [tenant?.id]);

  useEffect(() => {
    let alive = true;
    if (!tenant?.id || !profile || !rolesReady || !canView || redirectTarget) return () => { alive = false; };
    setInitialReady(false);
    withTimeout(refresh(), INITIAL_DATA_TIMEOUT_MS, "POS_PRODUCTS_INITIAL_LOAD_TIMEOUT").catch(error => {
      console.error("POS_PRODUCTS_LOAD_FAILED", error);
      if (error?.code !== "POS_PRODUCTS_INITIAL_LOAD_TIMEOUT") {
        showToast(error?.message || tr("products.empty"), "error");
      }
    }).finally(() => {
      if (alive) setInitialReady(true);
    });
    return () => { alive = false; };
  }, [tenant?.id, profile, rolesReady, canView, redirectTarget, refresh]);

  useEffect(() => {
    if (!tenant?.id || !profile || !rolesReady || !canView || redirectTarget || !initialReady) return undefined;
    const onError = error => console.warn("POS_PRODUCTS_WATCH_FAILED", error);
    const stops = [
      watchRetailProducts(tenant.id, setProducts, onError),
      watchRetailCategories(tenant.id, setCategories, onError),
      watchRetailStockMovements(tenant.id, setMovements, onError),
      watchRetailCatalogOrder(tenant.id, setCatalogOrder, onError),
    ];
    return () => stops.forEach(stop => stop?.());
  }, [tenant?.id, profile, rolesReady, canView, redirectTarget, initialReady]);

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
    const managedById = new Map(categories.map(item => [String(item.id || ""), item]));
    const managedKeys = new Set(categories.flatMap(item =>
      [item.name, ...(Array.isArray(item.aliases) ? item.aliases : [])].map(nameKey).filter(Boolean)
    ));
    const derived = new Map();
    products.forEach(product => {
      const productCategoryId = String(product.categoryId || "");
      const name = clean(product.category || "ทั่วไป") || "ทั่วไป";
      const key = nameKey(name);
      if ((productCategoryId && managedById.has(productCategoryId)) || managedKeys.has(key) || derived.has(key)) return;
      derived.set(key, {
        id: `derived:${name}`,
        sourceCategoryId: productCategoryId,
        name,
        aliases: [],
        sortOrder: Number(product.categorySortOrder || 999999),
        active: true,
        derived: true,
      });
    });
    return [...categories, ...derived.values()].map(item => {
      const keys = new Set([item.name, ...(item.aliases || [])].map(nameKey).filter(Boolean));
      return {
        ...item,
        productCount: products.filter(product => {
          const productCategoryId = String(product.categoryId || "");
          if (!item.derived && productCategoryId) return productCategoryId === String(item.id || "");
          return keys.has(nameKey(product.category));
        }).length,
      };
    });
  }, [categories, products]);

  const visibleCategories = useMemo(() => {
    const query = nameKey(categorySearch);
    return enrichedCategories.filter(item => {
      const names = [item.name, ...(item.aliases || [])];
      if (query && !names.some(name => nameKey(name).includes(query))) return false;
      if (categoryStatus === "used" && (item.derived || item.productCount <= 0)) return false;
      if (categoryStatus === "empty" && (item.derived || item.productCount > 0)) return false;
      if (categoryStatus === "derived" && !item.derived) return false;
      return true;
    }).sort((a, b) => {
      if (categorySort === "count-desc") return b.productCount - a.productCount || a.name.localeCompare(b.name, "th");
      if (categorySort === "empty-first") return Number(a.productCount > 0) - Number(b.productCount > 0)
        || Number(a.derived) - Number(b.derived)
        || a.name.localeCompare(b.name, "th");
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
    const base = {
      animation: 180,
      handle: ".sort-handle",
      ghostClass: "sort-ghost",
      chosenClass: "sort-chosen",
      dragClass: "sort-drag",
      fallbackClass: "sort-fallback",
      forceFallback: true,
      fallbackOnBody: true,
      fallbackTolerance: 3,
      delay: 120,
      delayOnTouchOnly: true,
      touchStartThreshold: 4,
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
        id: categoryEditing?.derived ? "" : (categoryEditing?.id || ""),
        name: categoryName,
        sortOrder: categoryEditing?.sortOrder ?? categories.length * 10,
      }, categoryEditing);
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
      const code = String(error?.message || "");
      const messages = {
        CATEGORY_NAME_REQUIRED: tr("runtime.category_name_required"),
        CATEGORY_RESERVED_NAME: tr("runtime.category_reserved_name"),
        CATEGORY_DUPLICATE: tr("runtime.category_duplicate"),
      };
      setCategoryFormError(messages[code] || code || tr("runtime.category_manage_failed"));
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
      await adjustRetailStock(tenant.id, selectedStockProduct || { id: stockForm.productId }, stockForm.action, quantity, stockForm.note || tr("runtime.stock_default_note"));
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

  const signalScanSuccess = useCallback(() => {
    try { navigator.vibrate?.(80); } catch {}
    try {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = new AudioContextCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(.04, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .12);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + .12);
      oscillator.addEventListener("ended", () => context.close(), { once: true });
    } catch {}
  }, []);

  const stopScanner = useCallback((closeDialog = true) => {
    window.cancelAnimationFrame(scanFrameRef.current);
    scanFrameRef.current = 0;
    try { zxingControlsRef.current?.stop?.(); } catch {}
    try { zxingReaderRef.current?.reset?.(); } catch {}
    zxingControlsRef.current = null;
    zxingReaderRef.current = null;
    scanDetectorRef.current = null;
    if (scanStreamRef.current) {
      scanStreamRef.current.getTracks().forEach(track => track.stop());
      scanStreamRef.current = null;
    }
    if (scanVideoRef.current) scanVideoRef.current.srcObject = null;
    if (closeDialog && scanDialogRef.current?.open) scanDialogRef.current.close();
  }, []);

  const acceptScan = useCallback(codeValue => {
    const code = clean(codeValue);
    if (!code) return false;
    setScanStatus(tr("scanner.found", { code }));
    if (scanTargetRef.current === "barcode") {
      setProductForm(current => ({ ...current, barcode: code }));
    } else {
      setProductSearch(code);
      setProductPage(1);
    }
    signalScanSuccess();
    showToast(tr("scanner.success"));
    stopScanner();
    return true;
  }, [showToast, signalScanSuccess, stopScanner, tr]);

  const nativeScanLoop = useCallback(async function scanLoop() {
    if (!scanStreamRef.current || !scanDetectorRef.current || !scanVideoRef.current) return;
    try {
      const codes = await scanDetectorRef.current.detect(scanVideoRef.current);
      const value = clean(codes?.[0]?.rawValue);
      if (value && acceptScan(value)) return;
    } catch {}
    scanFrameRef.current = window.requestAnimationFrame(scanLoop);
  }, [acceptScan]);

  const startScanner = useCallback(async target => {
    scanTargetRef.current = target === "barcode" ? "barcode" : "search";
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast(tr("scanner.unsupported"), "error");
      return;
    }
    setScanStatus(tr("scanner.preparing"));
    if (!scanDialogRef.current?.open) scanDialogRef.current?.showModal?.();
    try {
      if ("BarcodeDetector" in window) {
        scanDetectorRef.current = new window.BarcodeDetector({
          formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"],
        });
        scanStreamRef.current = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        scanVideoRef.current.srcObject = scanStreamRef.current;
        await scanVideoRef.current.play();
        setScanStatus(tr("scanner.scanning"));
        nativeScanLoop();
        return;
      }
      setScanStatus(tr("scanner.loading"));
      const ZXing = await loadZxing();
      zxingReaderRef.current = new ZXing.BrowserMultiFormatReader();
      setScanStatus(tr("scanner.scanning"));
      zxingControlsRef.current = await zxingReaderRef.current.decodeFromVideoDevice(
        null,
        scanVideoRef.current,
        result => {
          const value = clean(result?.getText?.() || result?.text || "");
          if (value) acceptScan(value);
        },
      );
    } catch (error) {
      console.warn("POS_PRODUCTS_BARCODE_SCANNER_FAILED", error);
      stopScanner();
      showToast(tr("scanner.failed"), "error");
    }
  }, [acceptScan, nativeScanLoop, showToast, stopScanner, tr]);

  useEffect(() => () => stopScanner(false), [stopScanner]);

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

  const needsReady = authState.status === "loading"
    || tenantState.status === "loading"
    || !stylesReady
    || Boolean(redirectTarget)
    || (Boolean(profile && tenant) && !rolesReady)
    || Boolean(tenant?.id && profile && rolesReady && canView && !initialReady);
  if (needsReady) {
    return <PageReadyOverlay context="PENGUIN" title={t("shared.state.loading")} message={t("shared.state.please_wait")} progress={92} />;
  }

  const selectedStockProduct = products.find(item => item.id === stockForm.productId);
  const pageNumbers = pagesAround(safeProductPage, productPageCount);
  const categoryNumbers = pagesAround(safeCategoryPage, categoryPageCount);

  return (
    <>
      <header className="pos-header" data-pos-management-header>
        <div className="app-title"><div><strong>{tr("header.title")}</strong><small>{tr("header.subtitle")}</small></div></div>
        <div className="header-actions">
          <LocaleSwitcher />
          <PosNavigation profile={posAccessProfile} currentKey="pos.products" />
        </div>
      </header>

      <main data-pos-management className="management-container">
        <section className="stats-grid">
          <article className="stat-card"><span>{tr("stats.product_count")}</span><strong id="productCount">{formatNumber(stats.count)}</strong></article>
          <article className="stat-card"><span>{tr("stats.stock_total")}</span><strong id="stockTotal">{formatNumber(stats.stock)}</strong></article>
          <article className="stat-card warning"><span>{tr("stats.low_stock")}</span><strong id="lowStockCount">{formatNumber(stats.low)}</strong></article>
          <article className="stat-card danger"><span>{tr("stats.out_of_stock")}</span><strong id="outStockCount">{formatNumber(stats.out)}</strong></article>
        </section>

        <section className="panel management-panel">
          <div className="section-heading product-list-heading">
            <div><h2>{tr("products.title")}</h2><p>{tr("products.description")}</p></div>
            {canCreate ? <button id="addProductBtn" className="btn btn-pay" type="button" onClick={openAddProduct}>{tr("products.add")}</button> : null}
          </div>
          <div className="toolbar">
            <div className="barcode-input-group">
              <input id="productSearch" value={productSearch} onChange={event => { setProductSearch(event.target.value); setProductPage(1); }} placeholder={tr("products.search_placeholder")} />
              <button id="scanProductSearchBtn" className="scan-barcode-btn" type="button" onClick={() => startScanner("search")} aria-label={tr("scanner.button")} title={tr("scanner.button")}>
                <i className="bi bi-upc-scan scan-barcode-icon" aria-hidden="true"></i><span>{tr("scanner.button")}</span>
              </button>
            </div>
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
                    <td>{product.barcode}</td><td className="number">{formatNumber(Number(product.price || 0), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="number"><span className={"stock-badge" + (out ? " out" : low ? " low" : "")}>{formatNumber(product.stock || 0)}</span></td>
                    <td>{product.unit}</td>
                    <td><div className="row-actions">
                      {canAdjust ? <button type="button" className="stock" data-action="stock" data-id={product.id} onClick={() => openStock(product)}>{tr("common.adjust_stock")}</button> : null}
                      {canEdit ? <button type="button" data-action="edit" data-id={product.id} onClick={() => openEditProduct(product)}>{tr("common.edit")}</button> : null}
                      {canDelete ? <button type="button" className="delete" data-action="delete" data-id={product.id} onClick={() => removeProduct(product)}>{tr("common.delete")}</button> : null}
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
          <div className="section-heading category-manager-heading"><div><div className="category-manager-title-row"><h2>{tr("categories.title")}</h2><span id="categoryCountBadge" className="category-count-badge">{tr("categories.count", { count: formatNumber(enrichedCategories.length) })}</span></div><p>{tr("categories.description")}</p></div>{canCreate ? <button id="addCategoryBtn" className="btn btn-pay" type="button" onClick={() => openCategoryEditor()}><i className="bi bi-plus-lg"></i><span>{tr("categories.add")}</span></button> : null}</div>
          <div className="category-manager-toolbar">
            <div className="category-search-control"><i className="bi bi-search"></i><input id="categorySearch" type="search" value={categorySearch} onChange={event => { setCategorySearch(event.target.value); setCategoryPage(1); }} placeholder={tr("categories.search_placeholder")} />{categorySearch ? <button id="clearCategorySearch" className="category-search-clear" type="button" onClick={() => setCategorySearch("")}><i className="bi bi-x-lg"></i></button> : null}</div>
            <div className="category-toolbar-controls">
              <label className="category-filter-control">{tr("categories.status")}<select id="categoryStatusFilter" value={categoryStatus} onChange={event => { setCategoryStatus(event.target.value); setCategoryPage(1); }}><option value="all">{tr("categories.status_all")}</option><option value="used">{tr("categories.status_used")}</option><option value="empty">{tr("categories.status_empty")}</option><option value="derived">{tr("categories.status_derived")}</option></select></label>
              <label className="category-filter-control">{tr("categories.sort")}<select id="categorySort" value={categorySort} onChange={event => setCategorySort(event.target.value)}><option value="name">{tr("categories.sort_name")}</option><option value="count-desc">{tr("categories.sort_count")}</option><option value="empty-first">{tr("categories.sort_empty")}</option><option value="manual">{tr("categories.sort_manual")}</option></select></label>
              <label className="category-filter-control">{tr("categories.page_size")}<select id="categoryPageSize" value={categoryPageSize} onChange={event => { setCategoryPageSize(Number(event.target.value)); setCategoryPage(1); }}>{CATEGORY_PAGE_SIZES.map(size => <option key={size} value={size}>{tr("categories.page_size_option", { count: size })}</option>)}</select></label>
            </div>
          </div>
          <div id="categoryManagerSummary" className="category-manager-summary"><span className="category-summary-chip"><strong>{formatNumber(visibleCategories.length)}</strong>{tr("categories.summary_visible")}</span><span className="category-summary-chip"><strong>{formatNumber(usedCategoryCount)}</strong>{tr("categories.status_used")}</span><span className="category-summary-chip"><strong>{formatNumber(emptyCategoryCount)}</strong>{tr("categories.status_empty")}</span></div>
          <div id="categoryManagerRoot" className="category-manager-root">
            {categoryPageRows.length ? <><div className="category-list-head"><span>{tr("categories.title")}</span><span>{tr("categories.product_count")}</span><span>{tr("categories.status")}</span><span>{tr("categories.manage")}</span></div>
              {categoryPageRows.map(item => {
                const status = item.derived ? ["derived", tr("categories.status_derived")] : item.productCount > 0 ? ["used", tr("categories.status_used")] : ["empty", tr("categories.status_empty")];
                return <article className="category-row" key={(item.id || "derived") + ":" + item.name}><div className="category-main"><span className="category-avatar">{item.name.slice(0, 1)}</span><div className="category-main-text"><strong>{item.name}</strong><small>{item.derived ? tr("categories.derived_help") : tr("categories.ready_pos")}</small></div></div><div className="category-product-count"><strong>{formatNumber(item.productCount)}</strong><span>{tr("common.items")}</span></div><div className="category-status-cell"><span className={"category-status " + status[0]}>{status[1]}</span></div><div className="category-card-actions">{item.derived ? (canCreate ? <button type="button" className="save" onClick={() => openCategoryEditor(item)}><i className="bi bi-cloud-arrow-up"></i>{tr("categories.save_derived")}</button> : null) : <>{canEdit ? <button type="button" className="edit" onClick={() => openCategoryEditor(item)}><i className="bi bi-pencil-square"></i>{tr("common.edit")}</button> : null}{canDelete ? <button type="button" className="delete" onClick={() => removeCategory(item)}><i className="bi bi-trash3"></i>{tr("common.delete")}</button> : null}</>}</div></article>;
              })}
            </> : <div className="category-manager-empty"><strong>{enrichedCategories.length ? tr("categories.no_match") : tr("categories.empty_title")}</strong><span>{enrichedCategories.length ? tr("categories.no_match_help") : tr("categories.empty_help")}</span></div>}
          </div>
          {visibleCategories.length > categoryPageSize ? <nav id="categoryPagination" className="category-pagination"><div className="category-pagination-summary">{tr("common.showing_short", { start: formatNumber((safeCategoryPage - 1) * categoryPageSize + 1), end: formatNumber(Math.min(safeCategoryPage * categoryPageSize, visibleCategories.length)), total: formatNumber(visibleCategories.length) })}</div><div className="category-page-controls"><button type="button" disabled={safeCategoryPage <= 1} onClick={() => setCategoryPage(page => page - 1)}><i className="bi bi-chevron-left"></i></button>{categoryNumbers.map((page, index) => <span key={page}>{index > 0 && page - categoryNumbers[index - 1] > 1 ? <span className="category-page-ellipsis">…</span> : null}<button type="button" className={"category-page-number" + (page === safeCategoryPage ? " active" : "")} onClick={() => setCategoryPage(page)}>{page}</button></span>)}<button type="button" disabled={safeCategoryPage >= categoryPageCount} onClick={() => setCategoryPage(page => page + 1)}><i className="bi bi-chevron-right"></i></button></div></nav> : null}
        </section>

        <section className="panel sort-manager-panel" id="productSortManager"><div className="section-heading"><div><h2>{tr("sort_manager.title")}</h2><p>{tr("sort_manager.description")}</p></div></div>
          <div id="sortManagerRoot" className="sort-manager-root">
            <div className="sort-column"><div className="sort-column-head"><div><h3>{tr("sort_manager.category_title")}</h3><span>{tr("sort_manager.category_help")}</span></div></div><div className="sort-list" ref={categorySortRef}>{orderedCategoryIds.map((id, index) => <div className={"sort-row" + (id === selectedSortCategory ? " active" : "") + (id === "quick" ? " best-seller" : "")} data-category-id={id} key={id}><span className="sort-handle"><i className="bi bi-grip-vertical"></i></span><button type="button" className="sort-row-main" onClick={() => setSelectedSortCategory(id)}><span className="sort-row-title">{id === "quick" ? tr("sort_manager.best_sellers") : id === "all" ? tr("sort_manager.all") : id.slice(9)}</span></button><span className="sort-order-badge">{index + 1}</span></div>)}</div></div>
            <div className="sort-column"><div className="sort-column-head"><div><h3>{tr("sort_manager.products_title", { category: selectedSortCategory === "quick" ? tr("sort_manager.best_sellers") : selectedSortCategory === "all" ? tr("sort_manager.all") : selectedSortCategory.slice(9) })}</h3><span>{tr("sort_manager.products_help")}</span></div></div>
              <div className="sort-list" ref={productSortRef}>{selectedSortCategory === "quick" ? <div className="sort-empty">{tr("sort_manager.best_sellers_locked")}</div> : selectedSortCategory === "all" ? <div className="sort-empty">{tr("sort_manager.all_auto")}</div> : sortProducts.length ? sortProducts.map((product, index) => <div className="sort-row" data-product-id={product.id} key={product.id}><span className="sort-handle"><i className="bi bi-grip-vertical"></i></span><div className="sort-row-main"><span className="sort-row-title">{product.name}</span><span className="sort-row-meta">{product.id} • {product.barcode || tr("sort_manager.no_barcode")}</span></div><span className="sort-order-badge">{index + 1}</span></div>) : <div className="sort-empty">{tr("sort_manager.category_empty")}</div>}</div>
              <div className="sort-footer"><p className="sort-note">{tr("sort_manager.note")}</p><button className="sort-save" type="button" disabled={saving} onClick={saveSort}>{saving ? tr("sort_manager.saving") : tr("sort_manager.save")}</button></div>
            </div>
          </div>
        </section>

        <section className="panel movement-panel"><div className="section-heading"><div><h2>{tr("movements.title")}</h2><p>{tr("movements.description")}</p></div>{canClearHistory ? <button id="clearMovementBtn" className="btn btn-danger" type="button" onClick={clearMovements}>{tr("movements.clear")}</button> : null}</div>
          <div id="movementList" className="movement-list">{visibleMovements.map(item => { const before = Number(item.before ?? item.stockBefore ?? 0), after = Number(item.after ?? item.stockAfter ?? before), delta = after - before; return <article className="movement-item" key={item.id}><div><strong>{item.productName || item.productId}</strong><div className="movement-meta">{item.productId} • {item.note || tr("runtime.stock_default_note")} • {new Date(movementTime(item.createdAtServer || item.createdAt || item.updatedAt)).toLocaleString()} • {tr("common.synced")}</div></div><div className={"movement-qty " + (delta >= 0 ? "plus" : "minus")}>{delta > 0 ? "+" : ""}{formatNumber(delta)} ({formatNumber(before)} → {formatNumber(after)})</div></article>; })}</div>
          {!visibleMovements.length ? <div id="movementEmpty" className="empty-state">{tr("movements.empty")}</div> : null}
        </section>
      </main>

      <dialog data-pos-management-dialog id="productDialog" ref={productDialogRef}>
        <form id="productForm" className="payment-form" onSubmit={submitProduct}>
          <div className="dialog-head"><h2 id="productDialogTitle">{editingProductId ? tr("product_form.edit_title") : tr("product_form.add_title")}</h2><button id="closeProductDialog" type="button" className="icon-btn" onClick={() => productDialogRef.current?.close?.()}><i className="bi bi-x-lg"></i></button></div>
          <input id="editingProductId" type="hidden" value={editingProductId} readOnly />
          <div className="form-grid">
            <label>{tr("product_form.id")}<input id="productId" required maxLength={10} value={productForm.id} disabled={Boolean(editingProductId)} onChange={event => setProductForm(current => ({ ...current, id: event.target.value.toUpperCase() }))} placeholder={tr("product_form.id_placeholder")} /></label>
            <label>{tr("product_form.barcode")}<input id="productBarcode" required maxLength={50} inputMode="numeric" value={productForm.barcode} onChange={event => setProductForm(current => ({ ...current, barcode: event.target.value }))} /></label>
            <label className="full">{tr("product_form.name")}<input id="productName" required maxLength={120} value={productForm.name} onChange={event => setProductForm(current => ({ ...current, name: event.target.value }))} /></label>
            <label>{tr("product_form.price")}<input id="productPrice" required type="number" min="0" step="0.01" value={productForm.price} onChange={event => setProductForm(current => ({ ...current, price: event.target.value }))} /></label>
            <label>{tr("product_form.unit")}<input id="productUnit" required maxLength={30} value={productForm.unit} onChange={event => setProductForm(current => ({ ...current, unit: event.target.value }))} placeholder={tr("product_form.unit_placeholder")} /></label>
            <label>{tr("product_form.initial_stock")}<input id="productStock" required type="number" min="0" step="1" value={productForm.stock} onChange={event => setProductForm(current => ({ ...current, stock: event.target.value }))} /></label>
            <label>{tr("product_form.min_stock")}<input id="productMinStock" required type="number" min="0" step="1" value={productForm.minStock} onChange={event => setProductForm(current => ({ ...current, minStock: event.target.value }))} /></label>
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
          <p id="productFormError" className="error-text">{productFormError}</p><div className="dialog-actions"><button id="cancelProductBtn" type="button" className="btn btn-secondary" onClick={() => productDialogRef.current?.close?.()}>{tr("common.cancel")}</button><button type="submit" className="btn btn-pay" disabled={saving}>{tr("product_form.save")}</button></div>
        </form>
      </dialog>

      <dialog data-pos-management-dialog id="categoryDialog" ref={categoryDialogRef}><form id="categoryForm" className="payment-form" onSubmit={submitCategory}><div className="dialog-head"><h2 id="categoryDialogTitle">{categoryEditing?.id && !categoryEditing?.derived ? tr("category_form.edit_title") : tr("category_form.add_title")}</h2><button id="closeCategoryDialog" type="button" className="icon-btn" onClick={closeCategoryEditor}><i className="bi bi-x-lg"></i></button></div><label>{tr("category_form.name")}<input id="categoryName" type="text" maxLength={80} required value={categoryName} onChange={event => setCategoryName(event.target.value)} placeholder={tr("category_form.placeholder")} /></label><p id="categoryDialogHint" className="category-dialog-hint">{categoryEditing?.productCount ? tr("category_form.hint_with_count", { count: formatNumber(categoryEditing.productCount) }) : tr("category_form.hint_empty")}</p><p id="categoryFormError" className="error-text">{categoryFormError}</p><div className="dialog-actions"><button id="cancelCategoryBtn" type="button" className="btn btn-secondary" onClick={closeCategoryEditor}>{tr("common.cancel")}</button><button id="saveCategoryBtn" type="submit" className="btn btn-pay" disabled={saving}>{tr("category_form.save")}</button></div></form></dialog>

      <dialog data-pos-management-dialog id="stockDialog" ref={stockDialogRef}><form id="stockForm" className="payment-form" onSubmit={submitStock}><div className="dialog-head"><h2>{tr("stock_form.title")}</h2><button id="closeStockDialog" type="button" className="icon-btn" onClick={() => stockDialogRef.current?.close?.()}><i className="bi bi-x-lg"></i></button></div><input id="stockProductId" type="hidden" value={stockForm.productId} readOnly /><div id="stockProductName" className="stock-product-name">{selectedStockProduct ? tr("stock_form.remaining", { product: selectedStockProduct.name, stock: formatNumber(selectedStockProduct.stock) + " " + selectedStockProduct.unit }) : ""}</div><label>{tr("stock_form.action")}<select id="stockAction" value={stockForm.action} onChange={event => setStockForm(current => ({ ...current, action: event.target.value }))}><option value="add">{tr("stock_form.add")}</option><option value="remove">{tr("stock_form.remove")}</option><option value="set">{tr("stock_form.set")}</option></select></label><label>{tr("stock_form.quantity")}<input id="stockQuantity" required type="number" min="0" step="1" value={stockForm.quantity} onChange={event => setStockForm(current => ({ ...current, quantity: event.target.value }))} /></label><label>{tr("stock_form.note")}<input id="stockNote" maxLength={150} value={stockForm.note} onChange={event => setStockForm(current => ({ ...current, note: event.target.value }))} placeholder={tr("stock_form.note_placeholder")} /></label><p id="stockFormError" className="error-text">{stockFormError}</p><div className="dialog-actions"><button id="cancelStockBtn" type="button" className="btn btn-secondary" onClick={() => stockDialogRef.current?.close?.()}>{tr("common.cancel")}</button><button type="submit" className="btn btn-pay" disabled={saving}>{tr("stock_form.confirm")}</button></div></form></dialog>

      <dialog id="posScanDialog" ref={scanDialogRef} className="pos-scan-dialog">
        <div className="pos-scan-sheet">
          <div className="pos-scan-head">
            <div><h2>{tr("scanner.title")}</h2><p>{tr("scanner.help")}</p></div>
            <button className="pos-scan-close" type="button" aria-label={tr("scanner.close")} onClick={() => stopScanner()}>
              <i className="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </div>
          <div className="pos-scan-view">
            <video ref={scanVideoRef} id="posScanVideo" playsInline muted></video>
            <div className="pos-scan-guide"></div><div className="pos-scan-line"></div>
          </div>
          <p id="posScanStatus" className="pos-scan-status">{scanStatus}</p>
        </div>
      </dialog>

      <div id="toast" className={`toast ${toastType}${toastMessage ? " show" : ""}`} role={toastType === "error" ? "alert" : "status"} aria-live="polite">
        <span className="app-toast-icon" aria-hidden="true"><i className={`bi bi-${toastType === "error" ? "x-circle" : "check-circle"} app-icon`}></i></span>
        <span className="app-toast-message">{toastMessage}</span>
      </div>
      <AppDeveloperPanel />
    </>
  );
}
