const {
  DocumentReference,
  GeoPoint,
  Timestamp,
} = require("firebase-admin/firestore");

const TYPE_KEY = "__penguinFirestoreType";

function encodeFirestoreValue(value) {
  if (value instanceof Timestamp) {
    return {
      [TYPE_KEY]: "timestamp",
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
    };
  }
  if (value instanceof GeoPoint) {
    return {
      [TYPE_KEY]: "geopoint",
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }
  if (typeof DocumentReference === "function" && value instanceof DocumentReference) {
    return {
      [TYPE_KEY]: "reference",
      path: value.path,
    };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return {
      [TYPE_KEY]: "bytes",
      value: Buffer.from(value).toString("base64"),
    };
  }
  if (value instanceof Date) {
    return {
      [TYPE_KEY]: "date",
      value: value.toISOString(),
    };
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    return {
      [TYPE_KEY]: "number",
      value: Number.isNaN(value) ? "NaN" : value > 0 ? "Infinity" : "-Infinity",
    };
  }
  if (Array.isArray(value)) return value.map(encodeFirestoreValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, encodeFirestoreValue(entry)]),
    );
  }
  return value;
}

function decodeFirestoreValue(value, db) {
  if (Array.isArray(value)) return value.map(entry => decodeFirestoreValue(entry, db));
  if (!value || typeof value !== "object") return value;

  const type = value[TYPE_KEY];

  if (type === "timestamp") {
    if (Number.isFinite(Number(value.seconds)) && Number.isFinite(Number(value.nanoseconds))) {
      return new Timestamp(Number(value.seconds), Number(value.nanoseconds));
    }
    // Transitional support for an early v2 candidate that encoded ISO timestamps.
    const date = new Date(String(value.value || ""));
    if (!Number.isFinite(date.getTime())) throw new Error("INVALID_BACKUP_TIMESTAMP");
    return Timestamp.fromDate(date);
  }

  if (type === "geopoint") {
    const latitude = Number(value.latitude);
    const longitude = Number(value.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("INVALID_BACKUP_GEOPOINT");
    }
    return new GeoPoint(latitude, longitude);
  }

  if (type === "reference") {
    const refPath = String(value.path || "").trim();
    if (!refPath || !db) throw new Error("INVALID_BACKUP_REFERENCE");
    return db.doc(refPath);
  }

  if (type === "bytes") {
    return Buffer.from(String(value.value || ""), "base64");
  }

  if (type === "date") {
    const date = new Date(String(value.value || ""));
    if (!Number.isFinite(date.getTime())) throw new Error("INVALID_BACKUP_DATE");
    return date;
  }

  if (type === "number") {
    if (value.value === "NaN") return Number.NaN;
    if (value.value === "Infinity") return Number.POSITIVE_INFINITY;
    if (value.value === "-Infinity") return Number.NEGATIVE_INFINITY;
    throw new Error("INVALID_BACKUP_NUMBER");
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, decodeFirestoreValue(entry, db)]),
  );
}

module.exports = {
  TYPE_KEY,
  encodeFirestoreValue,
  decodeFirestoreValue,
};
