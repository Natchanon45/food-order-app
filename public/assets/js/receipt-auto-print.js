function waitForImage(image, timeout = 1500) {
  if (!image || image.complete) return Promise.resolve();
  return Promise.race([
    new Promise(resolve => image.addEventListener("load", resolve, { once: true })),
    new Promise(resolve => image.addEventListener("error", resolve, { once: true })),
    new Promise(resolve => setTimeout(resolve, timeout)),
  ]);
}

export async function autoPrintReceipt() {
  if (new URLSearchParams(location.search).get("autoprint") !== "1") return;
  if (document.fonts?.ready) await document.fonts.ready;
  await waitForImage(document.querySelector("#verifyQr"));
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.print();
}
