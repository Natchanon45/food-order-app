import {
  auth,
  db,
  doc,
  getDoc,
  onAuthStateChanged,
  serverTimestamp,
  setDoc,
} from "./firebase-config.js?v=20260630-073";
import { toast } from "./ui.js?v=20260731-080";

const settingsRef = doc(db, "platformSettings", "publicContact");

const form = document.getElementById("platformContactForm");
const enabledField = document.getElementById("contactEnabled");
const headingField = document.getElementById("contactHeading");
const descriptionField = document.getElementById("contactDescription");

const phoneEnabled = document.getElementById("phoneEnabled");
const phoneLabel = document.getElementById("phoneLabel");
const phoneNumber = document.getElementById("phoneNumber");

const lineEnabled = document.getElementById("lineEnabled");
const lineLabel = document.getElementById("lineLabel");
const lineUrl = document.getElementById("lineUrl");

const messengerEnabled = document.getElementById("messengerEnabled");
const messengerLabel = document.getElementById("messengerLabel");
const messengerUrl = document.getElementById("messengerUrl");

const emailEnabled = document.getElementById("emailEnabled");
const emailLabel = document.getElementById("emailLabel");
const emailField = document.getElementById("contactEmail");

const reloadButton = document.getElementById("reloadContactButton");
const saveButton = document.getElementById("saveContactButton");
const statusBox = document.getElementById("contactFormStatus");

const preview = document.getElementById("contactPreview");
const previewHeading = document.getElementById("previewHeading");
const previewDescription = document.getElementById("previewDescription");
const previewLinks = document.getElementById("previewLinks");

const defaults = {
  enabled: true,
  heading: "คุยกับเรา",
  description: "ติดต่อสอบถามข้อมูลแพ็กเกจและการใช้งานระบบ",
  phoneEnabled: false,
  phoneLabel: "โทรศัพท์",
  phoneNumber: "",
  lineEnabled: false,
  lineLabel: "LINE",
  lineUrl: "",
  messengerEnabled: false,
  messengerLabel: "Messenger",
  messengerUrl: "",
  emailEnabled: false,
  emailLabel: "อีเมล",
  email: "",
};

function waitForUser() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error("AUTH_TIMEOUT"));
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, user => {
      if (!user) return;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    });
  });
}

function showStatus(message = "", type = "success") {
  statusBox.textContent = message;
  statusBox.dataset.type = type;
  statusBox.hidden = !message;
}

function normalizeHttpUrl(value = "") {
  const raw = String(value).trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function normalizeMessengerUrl(value = "") {
  const raw = String(value).trim();
  if (!raw) return "";

  const fullUrl = normalizeHttpUrl(raw);
  if (fullUrl) return fullUrl;

  const username = raw
    .replace(/^@/, "")
    .replace(/^m\.me\//i, "")
    .replace(/^facebook\.com\//i, "")
    .replace(/^www\.facebook\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .trim();

  if (!/^[a-zA-Z0-9._-]{2,100}$/.test(username)) return "";
  return `https://m.me/${username}`;
}

function normalizePhone(value = "") {
  return String(value).replace(/[^\d+*#,;]/g, "");
}

function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

function createPreviewAction({ channel, icon, label, href }) {
  const link = document.createElement("a");
  link.className = "public-contact-action";
  link.dataset.channel = channel;
  link.href = href || "#";
  link.addEventListener("click", event => event.preventDefault());

  const iconWrap = document.createElement("span");
  iconWrap.className = "public-contact-action-icon";
  iconWrap.setAttribute("aria-hidden", "true");

  const iconNode = document.createElement("i");
  iconNode.className = `bi bi-${icon}`;
  iconWrap.appendChild(iconNode);

  const labelNode = document.createElement("span");
  labelNode.textContent = label;

  link.append(iconWrap, labelNode);
  return link;
}

function readForm() {
  return {
    enabled: enabledField.checked,
    heading: headingField.value.trim() || defaults.heading,
    description: descriptionField.value.trim(),
    phoneEnabled: phoneEnabled.checked,
    phoneLabel: phoneLabel.value.trim() || defaults.phoneLabel,
    phoneNumber: normalizePhone(phoneNumber.value),
    lineEnabled: lineEnabled.checked,
    lineLabel: lineLabel.value.trim() || defaults.lineLabel,
    lineUrl: normalizeHttpUrl(lineUrl.value),
    messengerEnabled: messengerEnabled.checked,
    messengerLabel: messengerLabel.value.trim() || defaults.messengerLabel,
    messengerUrl: normalizeMessengerUrl(messengerUrl.value),
    emailEnabled: emailEnabled.checked,
    emailLabel: emailLabel.value.trim() || defaults.emailLabel,
    email: normalizeEmail(emailField.value),
  };
}

function writeForm(data = {}) {
  const value = { ...defaults, ...data };

  enabledField.checked = value.enabled === true;
  headingField.value = value.heading || defaults.heading;
  descriptionField.value = value.description || defaults.description;

  phoneEnabled.checked = value.phoneEnabled === true;
  phoneLabel.value = value.phoneLabel || defaults.phoneLabel;
  phoneNumber.value = value.phoneNumber || "";

  lineEnabled.checked = value.lineEnabled === true;
  lineLabel.value = value.lineLabel || defaults.lineLabel;
  lineUrl.value = value.lineUrl || "";

  messengerEnabled.checked = value.messengerEnabled === true;
  messengerLabel.value = value.messengerLabel || defaults.messengerLabel;
  messengerUrl.value = value.messengerUrl || "";

  emailEnabled.checked = value.emailEnabled === true;
  emailLabel.value = value.emailLabel || defaults.emailLabel;
  emailField.value = value.email || "";

  renderPreview();
}

function renderPreview() {
  const data = readForm();
  preview.hidden = data.enabled !== true;
  previewHeading.textContent = data.heading;
  previewDescription.textContent =
    data.description || "ติดต่อสอบถามข้อมูลและการใช้งานระบบ";

  previewLinks.replaceChildren();

  const actions = [];

  if (data.phoneEnabled && data.phoneNumber) {
    actions.push(createPreviewAction({
      channel: "phone",
      icon: "telephone-fill",
      label: data.phoneLabel,
      href: `tel:${data.phoneNumber}`,
    }));
  }

  if (data.lineEnabled && data.lineUrl) {
    actions.push(createPreviewAction({
      channel: "line",
      icon: "line",
      label: data.lineLabel,
      href: data.lineUrl,
    }));
  }

  if (data.messengerEnabled && data.messengerUrl) {
    actions.push(createPreviewAction({
      channel: "messenger",
      icon: "messenger",
      label: data.messengerLabel,
      href: data.messengerUrl,
    }));
  }

  if (data.emailEnabled && data.email) {
    actions.push(createPreviewAction({
      channel: "email",
      icon: "envelope-fill",
      label: data.emailLabel,
      href: `mailto:${data.email}`,
    }));
  }

  previewLinks.append(...actions);
}

function validateData(data) {
  if (!data.heading) return "กรุณากรอกหัวข้อ";

  if (data.phoneEnabled && !data.phoneNumber) {
    return "เปิดโทรศัพท์แล้ว กรุณากรอกเบอร์โทร";
  }

  if (data.lineEnabled && !data.lineUrl) {
    return "เปิด LINE แล้ว กรุณากรอก LINE URL ที่ถูกต้อง";
  }

  if (data.messengerEnabled && !data.messengerUrl) {
    return "เปิด Messenger แล้ว กรุณากรอก Messenger URL หรือชื่อเพจ";
  }

  if (
    data.emailEnabled
    && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)
  ) {
    return "เปิดอีเมลแล้ว กรุณากรอกอีเมลที่ถูกต้อง";
  }

  const enabledChannels = [
    data.phoneEnabled && data.phoneNumber,
    data.lineEnabled && data.lineUrl,
    data.messengerEnabled && data.messengerUrl,
    data.emailEnabled && data.email,
  ].filter(Boolean).length;

  if (data.enabled && enabledChannels === 0) {
    return "เปิด Contact หน้าแรกแล้ว กรุณาเปิดอย่างน้อยหนึ่งช่องทาง";
  }

  return "";
}

async function loadSettings({ announce = false } = {}) {
  reloadButton.disabled = true;
  saveButton.disabled = true;
  showStatus("กำลังโหลดข้อมูลล่าสุด...");

  try {
    await waitForUser();
    const snapshot = await getDoc(settingsRef);
    writeForm(snapshot.exists() ? snapshot.data() : defaults);
    showStatus(
      snapshot.exists()
        ? "โหลดข้อมูลติดต่อแล้ว"
        : "ยังไม่มีข้อมูลเดิม กรุณากรอกและบันทึก",
    );
    if (announce) toast("โหลดข้อมูลติดต่อล่าสุดแล้ว");
  } catch (error) {
    console.error("[platform-contact] load failed", error);
    showStatus(
      "โหลดข้อมูลไม่สำเร็จ กรุณาตรวจสอบสิทธิ์ Super Admin แล้วลองใหม่",
      "error",
    );
  } finally {
    reloadButton.disabled = false;
    saveButton.disabled = false;
  }
}

form.addEventListener("input", renderPreview);
form.addEventListener("change", renderPreview);

reloadButton.addEventListener("click", () => {
  loadSettings({ announce: true });
});

form.addEventListener("submit", async event => {
  event.preventDefault();

  const data = readForm();
  const validationError = validateData(data);

  if (validationError) {
    showStatus(validationError, "error");
    return;
  }

  saveButton.disabled = true;
  reloadButton.disabled = true;
  saveButton.innerHTML =
    '<span class="platform-contact-saving" aria-hidden="true"></span>'
    + "<span>กำลังบันทึก...</span>";
  showStatus("กำลังบันทึกข้อมูลติดต่อ...");

  try {
    const user = await waitForUser();

    await setDoc(settingsRef, {
      id: "publicContact",
      tenantId: "__platform__",
      ...data,
      updatedBy: user.uid,
      updatedByEmail: user.email || "",
      updatedAt: serverTimestamp(),
      updatedAtMs: Date.now(),
    }, { merge: false });

    showStatus("บันทึกข้อมูลติดต่อเรียบร้อยแล้ว");
    toast("อัปเดต Contact หน้าแรกแล้ว");
  } catch (error) {
    console.error("[platform-contact] save failed", error);
    showStatus(
      error?.code === "permission-denied"
        ? "บัญชีนี้ไม่มีสิทธิ์แก้ไข Contact หน้าแรก"
        : "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่",
      "error",
    );
  } finally {
    saveButton.disabled = false;
    reloadButton.disabled = false;
    saveButton.innerHTML =
      '<i class="bi bi-floppy" aria-hidden="true"></i>'
      + "<span>บันทึกข้อมูลติดต่อ</span>";
  }
});

loadSettings();
