const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const {
  encodeFirestoreValue,
  decodeFirestoreValue,
} = require("./retail-pos-backup-codec");

const FULL_COLLECTIONS = [
  "products",
  "categories",
  "sales",
  "returns",
  "customers",
  "loyaltyLedger",
  "purchases",
  "suppliers",
  "stockCounts",
  "stockMovements",
  "shifts",
  "taxInvoices",
  "saleItems",
  "taxBuyerProfiles",
];
const SCOPED_COLLECTIONS = ["dailySummary", "counters", "runningNumbers", "syncQueue", "heldBills"];
const COLLECTIONS = [...FULL_COLLECTIONS, ...SCOPED_COLLECTIONS];
const POS_COUNTER_PREFIXES = ["SALE_", "TAX_", "REFUND_", "VOID_", "SHIFT_"];

const POS_SETTINGS_IDS = [
  "retailPos",
  "tax",
  "payment",
  "receipt",
  "loyalty",
  "pos-theme",
  "pos-roles",
  "roles",
  "catalog-order",
];

const MANAGER_ROLES = new Set(["owner", "super_admin"]);
const BACKUP_APP = "retail-pos-react";
const BACKUP_VERSION = 2;
const BACKUP_CODEC = "firestore-types-v1";

async function context(auth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required");
  const db = getFirestore();
  const snap = await db.collection("users").doc(auth.uid).get();
  const user = snap.data() || {};
  if (user.active === false || !MANAGER_ROLES.has(String(user.role || ""))) {
    throw new HttpsError("permission-denied", "Owner permission required");
  }
  const tenantId = String(user.tenantId || "").trim();
  if (!tenantId) throw new HttpsError("failed-precondition", "Tenant missing");
  return { db, user, tenantId };
}

function backupValue(value) {
  return encodeFirestoreValue(value);
}

function firestoreValue(value, db) {
  try {
    return decodeFirestoreValue(value, db);
  } catch (error) {
    throw new HttpsError("invalid-argument", "Backup contains an invalid Firestore value", {
      cause: String(error?.message || error),
    });
  }
}

function validDocumentId(value) {
  const id = String(value || "").trim();
  if (!id || id.includes("/")) throw new HttpsError("invalid-argument", "Backup contains an invalid document id");
  return id;
}

function hasPosPrefix(id) {
  return POS_COUNTER_PREFIXES.some(prefix => String(id || "").startsWith(prefix));
}

function belongsToPos(name, id, data = {}) {
  if (name === "counters" || name === "runningNumbers") return hasPosPrefix(id);
  if (name === "heldBills") return String(data.source || "").toLowerCase() === "retail_pos";
  if (name === "dailySummary" || name === "syncQueue") {
    return String(data.channel || "").toLowerCase() === "retail-pos"
      || String(data.orderType || "").toLowerCase() === "pos"
      || String(data.schemaVersion || "").startsWith("P9-");
  }
  return true;
}

function rowFromSnapshot(doc) {
  return {
    id: doc.id,
    value: backupValue(doc.data()),
  };
}

async function readCollection(tenant, name) {
  const snap = await tenant.collection(name).get();
  return snap.docs
    .filter(doc => belongsToPos(name, doc.id, doc.data()))
    .map(rowFromSnapshot);
}

async function readSettings(tenant) {
  const snapshots = await Promise.all(POS_SETTINGS_IDS.map(id => tenant.collection("settings").doc(id).get()));
  return snapshots.filter(snap => snap.exists).map(rowFromSnapshot);
}

async function readBackup(db, tenantId) {
  const tenant = db.collection("tenants").doc(tenantId);
  const entries = await Promise.all([
    ...COLLECTIONS.map(async name => [name, await readCollection(tenant, name)]),
    (async () => ["settings", await readSettings(tenant)])(),
  ]);
  return Object.fromEntries(entries);
}

async function clearCollection(db, ref, name) {
  const snap = await ref.get();
  const docs = FULL_COLLECTIONS.includes(name)
    ? snap.docs
    : snap.docs.filter(doc => belongsToPos(name, doc.id, doc.data()));

  for (let offset = 0; offset < docs.length; offset += 200) {
    const batch = db.batch();
    docs.slice(offset, offset + 200).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
}

function preparedRows(name, rows, db) {
  if (!Array.isArray(rows)) throw new HttpsError("invalid-argument", "Backup collection must be an array");
  return rows.map(row => {
    if (!row || typeof row !== "object" || !("value" in row)) {
      throw new HttpsError("invalid-argument", "Backup row is invalid");
    }
    const id = validDocumentId(row.id);
    const value = firestoreValue(row.value, db);
    if (SCOPED_COLLECTIONS.includes(name) && !belongsToPos(name, id, value)) {
      throw new HttpsError("invalid-argument", "Backup contains a non-POS scoped document");
    }
    return { id, value };
  });
}

async function restoreRows(db, ref, rows) {
  for (let offset = 0; offset < rows.length; offset += 200) {
    const batch = db.batch();
    rows.slice(offset, offset + 200).forEach(row => batch.set(ref.doc(row.id), row.value));
    await batch.commit();
  }
}

async function restoreSettings(db, tenant, rows) {
  const allowed = new Set(POS_SETTINGS_IDS);
  const safeRows = rows.filter(row => allowed.has(row.id));
  const rowMap = new Map(safeRows.map(row => [row.id, row.value]));

  for (let offset = 0; offset < POS_SETTINGS_IDS.length; offset += 200) {
    const batch = db.batch();
    POS_SETTINGS_IDS.slice(offset, offset + 200).forEach(id => {
      const ref = tenant.collection("settings").doc(id);
      if (rowMap.has(id)) batch.set(ref, rowMap.get(id));
      else batch.delete(ref);
    });
    await batch.commit();
  }
}

exports.exportRetailPosBackup = onCall(
  { region: "asia-southeast1", timeoutSeconds: 120, memory: "512MiB" },
  async request => {
    const { db, tenantId } = await context(request.auth);
    const data = await readBackup(db, tenantId);
    return {
      app: BACKUP_APP,
      version: BACKUP_VERSION,
      codec: BACKUP_CODEC,
      tenantId,
      exportedAt: new Date().toISOString(),
      collections: data,
    };
  },
);

exports.restoreRetailPosBackup = onCall(
  { region: "asia-southeast1", timeoutSeconds: 540, memory: "1GiB" },
  async request => {
    const { db, tenantId } = await context(request.auth);
    const backup = request.data?.backup || {};

    if (request.data?.confirmation !== "REPLACE_TENANT_DATA") {
      throw new HttpsError("failed-precondition", "Restore confirmation required");
    }
    if (
      backup.app !== BACKUP_APP
      || Number(backup.version) !== BACKUP_VERSION
      || backup.codec !== BACKUP_CODEC
    ) {
      throw new HttpsError("invalid-argument", "Unsupported backup");
    }
    if (String(backup.tenantId || "") !== tenantId) {
      throw new HttpsError("permission-denied", "Backup belongs to another tenant");
    }

    const source = backup.collections || {};
    const prepared = Object.fromEntries(
      COLLECTIONS.map(name => [name, preparedRows(name, source[name] || [], db)]),
    );

    const tenant = db.collection("tenants").doc(tenantId);

    for (const name of COLLECTIONS) {
      const ref = tenant.collection(name);
      await clearCollection(db, ref, name);
      await restoreRows(db, ref, prepared[name]);
    }

    const settings = preparedRows("settings", source.settings || [], db);
    const allowedSettings = new Set(POS_SETTINGS_IDS);
    if (settings.some(row => !allowedSettings.has(row.id))) {
      throw new HttpsError("invalid-argument", "Backup contains a non-POS settings document");
    }

    await restoreSettings(db, tenant, settings);

    return {
      ok: true,
      version: BACKUP_VERSION,
      codec: BACKUP_CODEC,
      restoredAt: new Date().toISOString(),
    };
  },
);
