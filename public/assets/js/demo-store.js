const MENU_KEY = "food_order_demo_menus";
const TABLE_KEY = "food_order_demo_tables";
const ORDER_KEY = "food_order_demo_orders";

const defaultMenus = [
  { id: "m1", name: "ข้าวผัดหมู", category: "อาหารจานเดียว", price: 70, active: true, image: "" },
  { id: "m2", name: "กะเพราไก่ไข่ดาว", category: "อาหารจานเดียว", price: 75, active: true, image: "" },
  { id: "m3", name: "ต้มยำกุ้ง", category: "กับข้าว", price: 180, active: true, image: "" },
  { id: "m4", name: "น้ำเปล่า", category: "เครื่องดื่ม", price: 15, active: true, image: "" }
];

const defaultTables = [
  { id: "A01", code: "A01", name: "โต๊ะ A01", active: true, status: "available", orderToken: "" },
  { id: "A02", code: "A02", name: "โต๊ะ A02", active: true, status: "available", orderToken: "" },
  { id: "A03", code: "A03", name: "โต๊ะ A03", active: true, status: "available", orderToken: "" }
];

function read(key, fallback) {
  const value = localStorage.getItem(key);
  if (!value) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return structuredClone(fallback);
  }
  return JSON.parse(value);
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("demo-store-change", { detail: { key } }));
}

export const demoStore = {
  menus: {
    list: () => read(MENU_KEY, defaultMenus),
    save(item) {
      const items = read(MENU_KEY, defaultMenus);
      const index = items.findIndex(x => x.id === item.id);
      if (index >= 0) items[index] = item;
      else items.push({ ...item, id: crypto.randomUUID() });
      write(MENU_KEY, items);
    },
    remove(id) {
      write(MENU_KEY, read(MENU_KEY, defaultMenus).filter(x => x.id !== id));
    }
  },
  tables: {
    list: () => read(TABLE_KEY, defaultTables),
    save(item) {
      const items = read(TABLE_KEY, defaultTables);
      const index = items.findIndex(x => x.id === item.id);
      const normalized = {
        status: "available",
        orderToken: "",
        ...item
      };
      if (index >= 0) items[index] = { ...items[index], ...normalized };
      else items.push({ ...normalized, id: item.code || crypto.randomUUID() });
      write(TABLE_KEY, items);
    },
    remove(id) {
      write(TABLE_KEY, read(TABLE_KEY, defaultTables).filter(x => x.id !== id));
    }
  },
  orders: {
    list: () => read(ORDER_KEY, []),
    add(order) {
      const items = read(ORDER_KEY, []);
      const item = { ...order, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
      items.unshift(item);
      write(ORDER_KEY, items);
      return item;
    },
    update(id, patch) {
      const items = read(ORDER_KEY, []);
      const index = items.findIndex(x => x.id === id);
      if (index >= 0) items[index] = { ...items[index], ...patch };
      write(ORDER_KEY, items);
    }
  }
};
