import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { functions, storage } from "@/firebase/client";

const getBranding = httpsCallable(functions, "getPlatformBranding");
const updateBranding = httpsCallable(functions, "updatePlatformBranding");

const PREFIX = { logo: "logo", favicon: "favicon", appIcon: "app-icon" };

function extension(file) {
  const mime = String(file?.type || "").toLowerCase();
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/x-icon" || mime === "image/vnd.microsoft.icon") return "ico";
  return "png";
}

export async function resolvePlatformBranding(item = {}) {
  const result = { ...item };
  for (const [kind, pathKey, urlKey] of [
    ["logo", "logoPath", "logoUrl"],
    ["favicon", "faviconPath", "faviconUrl"],
    ["appIcon", "appIconPath", "appIconUrl"],
  ]) {
    const path = String(item[pathKey] || "").trim();
    result[urlKey] = path ? await getDownloadURL(ref(storage, path)).catch(() => "") : "";
    result[`${kind}Configured`] = Boolean(path);
  }
  return result;
}

export async function loadPlatformBranding() {
  const response = await getBranding({});
  return resolvePlatformBranding(response?.data?.item || {});
}

export async function savePlatformBranding({ files = {}, clear = {} } = {}) {
  const uploaded = {};
  try {
    for (const [kind, file] of Object.entries(files)) {
      if (!file) continue;
      const path = `platform-branding/${PREFIX[kind]}-${crypto.randomUUID()}.${extension(file)}`;
      await uploadBytes(ref(storage, path), file, { contentType: file.type || "image/png" });
      uploaded[kind] = path;
    }

    const response = await updateBranding({
      logoPath: uploaded.logo || "",
      faviconPath: uploaded.favicon || "",
      appIconPath: uploaded.appIcon || "",
      clearLogo: clear.logo === true,
      clearFavicon: clear.favicon === true,
      clearAppIcon: clear.appIcon === true,
    });
    return resolvePlatformBranding(response?.data?.item || {});
  } catch (error) {
    await Promise.all(Object.values(uploaded).map(path => deleteObject(ref(storage, path)).catch(() => {})));
    throw error;
  }
}
