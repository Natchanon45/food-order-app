const fs = require("node:fs");
const path = require("node:path");
const { initializeApp, cert, getApps } = require("firebase-admin/app");
const {
  getFirestore,
  Timestamp,
  GeoPoint,
  DocumentReference
} = require("firebase-admin/firestore");

const serviceAccountPath = path.join(__dirname, "service-account.json");

if (!fs.existsSync(serviceAccountPath)) {
  console.error("ไม่พบไฟล์ tools/service-account.json");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
const app = getApps()[0] || initializeApp({
  credential: cert(serviceAccount)
});
const db = getFirestore(app);

function detectType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (value instanceof Timestamp) return "timestamp";
  if (value instanceof GeoPoint) return "geopoint";
  if (value instanceof DocumentReference) return "document-reference";
  if (Buffer.isBuffer(value)) return "bytes";
  return typeof value;
}

function collectFieldTypes(target, data, prefix = "") {
  for (const [key, value] of Object.entries(data || {})) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const type = detectType(value);

    if (!target[fieldPath]) target[fieldPath] = new Set();
    target[fieldPath].add(type);

    if (type === "object" && value && value.constructor === Object) {
      collectFieldTypes(target, value, fieldPath);
    }
  }
}

async function inspectCollection(collectionRef, depth = 0, maxDepth = 10) {
  const snapshot = await collectionRef.get();

  const result = {
    path: collectionRef.path,
    documentCount: snapshot.size,
    fields: {},
    documents: {}
  };

  const aggregateFields = {};

  for (const documentSnapshot of snapshot.docs) {
    const data = documentSnapshot.data();
    collectFieldTypes(aggregateFields, data);

    const documentFields = {};
    collectFieldTypes(documentFields, data);

    const documentResult = {
      id: documentSnapshot.id,
      fields: {},
      subcollections: {}
    };

    for (const [field, types] of Object.entries(documentFields)) {
      documentResult.fields[field] = [...types];
    }

    if (depth < maxDepth) {
      const subcollections = await documentSnapshot.ref.listCollections();
      for (const subcollection of subcollections) {
        documentResult.subcollections[subcollection.id] = await inspectCollection(
          subcollection,
          depth + 1,
          maxDepth
        );
      }
    }

    result.documents[documentSnapshot.id] = documentResult;
  }

  for (const [field, types] of Object.entries(aggregateFields)) {
    result.fields[field] = [...types];
  }

  return result;
}

async function main() {
  console.log("กำลังอ่านโครงสร้าง Firestore...");

  const rootCollections = await db.listCollections();
  const structure = {
    projectId: app.options.projectId,
    generatedAt: new Date().toISOString(),
    collections: {}
  };

  for (const collectionRef of rootCollections) {
    console.log(`กำลังอ่าน: ${collectionRef.path}`);
    structure.collections[collectionRef.id] = await inspectCollection(collectionRef);
  }

  const outputPath = path.join(process.cwd(), "firestore-structure.json");
  fs.writeFileSync(outputPath, JSON.stringify(structure, null, 2), "utf8");

  console.log(`สร้างไฟล์เรียบร้อย: ${outputPath}`);
}

main().catch(error => {
  console.error("อ่าน Firestore ไม่สำเร็จ:", error);
  process.exit(1);
});
