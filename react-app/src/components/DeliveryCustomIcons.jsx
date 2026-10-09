import React from "react";

// Dedicated vector art for Delivery. These icons are path-based rather than
// Bootstrap font glyphs, so their actual silhouettes are not inherited.
export function DeliveryEditArtwork() {
  return (
    <svg className="delivery-address-action-svg" data-delivery-icon="edit" viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      <path d="M11.6 4.4H6.2a2 2 0 0 0-2 2v11.4a2 2 0 0 0 2 2h11.4a2 2 0 0 0 2-2v-5.1" />
      <path d="m10 13.8 7.7-7.7a2.2 2.2 0 0 1 3.1 3.1L13.1 17 9 18l1-4.2Z"
        fill="rgba(26,136,79,.15)" />
      <path d="m16.4 7.4 3.1 3.1" />
    </svg>
  );
}

export function DeliveryDeleteArtwork() {
  return (
    <svg className="delivery-address-action-svg" data-delivery-icon="delete" viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      <path d="M5.1 7.4h13.8" strokeWidth="2.1" />
      <path d="M9.2 4.5h5.6a1.1 1.1 0 0 1 1.1 1.1v1.8H8.1V5.6a1.1 1.1 0 0 1 1.1-1.1Z" />
      <path d="m6.8 7.6.9 11.1c.1 1.2 1 1.9 2.2 1.9h4.2c1.2 0 2.1-.7 2.2-1.9l.9-11.1"
        fill="rgba(218,63,57,.12)" />
      <path d="M10.1 11.1v5.5M13.9 11.1v5.5" />
    </svg>
  );
}
