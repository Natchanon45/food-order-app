// Convert locally generated SVG QR artwork into a real PNG, on the client.
// Prepare the PNG before the user clicks so iOS Safari can handle a normal link.
export async function svgQrPngBlob(svgDataUrl, size = 640) {
  if (!String(svgDataUrl || "").startsWith("data:image/svg+xml")) {
    throw new Error("QR_SVG_REQUIRED");
  }
  const image = new Image();
  image.decoding = "async";
  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("QR_IMAGE_DECODE_FAILED"));
    image.src = svgDataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("QR_CANVAS_UNAVAILABLE");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0, size, size);
  return new Promise((resolve, reject) => {
    canvas.toBlob(value => value ? resolve(value) : reject(new Error("QR_PNG_ENCODING_FAILED")), "image/png");
  });
}
