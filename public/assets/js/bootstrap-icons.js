const ICON_NAMES = Object.freeze({
  add: "plus-lg", back: "arrow-left", barcode: "upc-scan", cart: "cart3",
  check: "check-lg", "check-circle": "check-circle", "chevron-down": "chevron-down",
  close: "x-lg", delete: "trash3", delivery: "scooter", download: "download",
  edit: "pencil-square", home: "house", key: "key", kitchen: "bell",
  logout: "box-arrow-right", minus: "dash-lg", pencil: "pencil", plus: "plus-lg",
  print: "printer", qr: "qr-code", receipt: "receipt", save: "floppy",
  search: "search", settings: "arrow-left-right", table: "table", "times-circle": "x-circle",
  trash: "trash3", user: "person", users: "people", view: "eye", "x-circle": "x-circle"
});

export function bootstrapIconName(name = "") {
  return ICON_NAMES[name] || name || "circle";
}

export function iconMarkup(name, extraClass = "") {
  const classes = ["bi", `bi-${bootstrapIconName(name)}`, "app-icon", extraClass].filter(Boolean).join(" ");
  return `<i class="${classes}" aria-hidden="true"></i>`;
}
