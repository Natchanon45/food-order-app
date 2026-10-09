import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { storage } from "@/firebase/client";

// Store branding reuses the existing, tenant-scoped product-images Storage
// permission: /tenants/{tenantId}/product-images/{productId}/{filename}.
// No new public-upload permissions or Storage Rules are necessary.
export async function compressStoreBrandImage(file, kind) {
  if (!file) throw new Error("STORE_BRAND_IMAGE_REQUIRED");
  if (file.size > 8 * 1024 * 1024) throw new Error("STORE_BRAND_IMAGE_TOO_LARGE");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("STORE_BRAND_IMAGE_TYPE_INVALID");
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("STORE_BRAND_IMAGE_DECODE_FAILED"));
      element.src = url;
    });
    const longSide = kind === "logo" ? 640 : 1800;
    const ratio = Math.min(1, longSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) throw new Error("STORE_BRAND_IMAGE_CANVAS_UNAVAILABLE");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || !blob.size || blob.size > 5 * 1024 * 1024) {
      throw new Error("STORE_BRAND_IMAGE_COMPRESS_FAILED");
    }
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function uploadStoreBrandImage(tenantId, file, kind) {
  if (!storage || !tenantId) throw new Error("STORE_BRAND_STORAGE_UNAVAILABLE");
  if (!["logo", "cover"].includes(kind)) throw new Error("STORE_BRAND_IMAGE_KIND_INVALID");
  const blob = await compressStoreBrandImage(file, kind);
  // productId "store-branding" is deliberately a dedicated bucket prefix.
  const path = `tenants/${tenantId}/product-images/store-branding/${kind}-${Date.now()}-${crypto.randomUUID()}.webp`;
  const reference = storageRef(storage, path);
  await uploadBytes(reference, blob, { contentType: "image/webp" });
  return { url: await getDownloadURL(reference), path };
}
