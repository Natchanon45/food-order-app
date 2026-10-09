import React from "react";

// A matching set of clean, open-stroke Lucide-style icons for the three
// delivery-address actions. No hand-drawn fills, boxes inside boxes, or
// Bootstrap glyph mixing. The controls keep their accessible button labels.
const iconProps = {
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  focusable: "false",
};

export function DeliveryAddArtwork() {
  return (
    <svg {...iconProps} className="delivery-address-action-svg delivery-address-add-svg" data-delivery-icon="add">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function DeliveryEditArtwork() {
  return (
    <svg {...iconProps} className="delivery-address-action-svg" data-delivery-icon="edit">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function DeliveryDeleteArtwork() {
  return (
    <svg {...iconProps} className="delivery-address-action-svg" data-delivery-icon="delete">
      <path d="M3 6h18M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2" />
      <path d="m19 6-1 14c-.1 1.1-1 2-2 2H8c-1.1 0-1.9-.9-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
