import {
  db,
  doc,
  onSnapshot,
} from "./firebase-config.js?v=20260630-073";

const card = document.getElementById("publicContactCard");
const title = document.getElementById("publicContactTitle");
const description = document.getElementById("publicContactDescription");
const links = document.getElementById("publicContactLinks");

function safeHttpUrl(value = "") {
  try {
    const url = new URL(String(value).trim());
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.href;
  } catch {
    return "";
  }
}

function safePhone(value = "") {
  return String(value).replace(/[^\d+*#,;]/g, "");
}

function safeEmail(value = "") {
  const normalized = String(value).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    ? normalized
    : "";
}

function createContactLink({ channel, icon, label, href, external = false }) {
  const link = document.createElement("a");
  link.className = "public-contact-action";
  link.dataset.channel = channel;
  link.href = href;
  link.setAttribute("aria-label", label);

  if (external) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

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

function renderContact(data = null) {
  links.replaceChildren();

  if (!data || data.enabled !== true) {
    card.hidden = true;
    return;
  }

  title.textContent = String(data.heading || "คุยกับเรา").trim() || "คุยกับเรา";
  description.textContent =
    String(data.description || "ติดต่อสอบถามข้อมูลและการใช้งานระบบ").trim()
    || "ติดต่อสอบถามข้อมูลและการใช้งานระบบ";

  const actions = [];

  const phone = safePhone(data.phoneNumber);
  if (data.phoneEnabled === true && phone) {
    actions.push(createContactLink({
      channel: "phone",
      icon: "telephone-fill",
      label: String(data.phoneLabel || "โทรศัพท์").trim() || "โทรศัพท์",
      href: `tel:${phone}`,
    }));
  }

  const lineUrl = safeHttpUrl(data.lineUrl);
  if (data.lineEnabled === true && lineUrl) {
    actions.push(createContactLink({
      channel: "line",
      icon: "line",
      label: String(data.lineLabel || "LINE").trim() || "LINE",
      href: lineUrl,
      external: true,
    }));
  }

  const messengerUrl = safeHttpUrl(data.messengerUrl);
  if (data.messengerEnabled === true && messengerUrl) {
    actions.push(createContactLink({
      channel: "messenger",
      icon: "messenger",
      label: String(data.messengerLabel || "Messenger").trim() || "Messenger",
      href: messengerUrl,
      external: true,
    }));
  }

  const email = safeEmail(data.email);
  if (data.emailEnabled === true && email) {
    actions.push(createContactLink({
      channel: "email",
      icon: "envelope-fill",
      label: String(data.emailLabel || "อีเมล").trim() || "อีเมล",
      href: `mailto:${email}`,
    }));
  }

  if (!actions.length) {
    card.hidden = true;
    return;
  }

  links.append(...actions);
  card.hidden = false;
}

if (card && links && db) {
  const settingsRef = doc(db, "platformSettings", "publicContact");

  onSnapshot(
    settingsRef,
    snapshot => renderContact(snapshot.exists() ? snapshot.data() : null),
    error => {
      console.warn("[public-contact] unable to load contact settings", error);
      card.hidden = true;
    },
  );
}
