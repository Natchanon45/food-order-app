// Deprecated debug helper.
// Kept as a no-op so older cached HTML that still imports this file will not show the Firestore diagnostic panel.

document.querySelectorAll('#firestoreStatusText,#firestoreStatusError,#firestoreTestBtn').forEach(element => {
  element.closest('section.panel')?.remove();
});
