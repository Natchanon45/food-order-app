// Project a geographic pin onto an ordinary unrotated Google Maps viewport.
// Google Maps may render as a static/lite map without its classic Marker DOM;
// this overlay remains positioned at the saved customer's real coordinate.
export function mapPinPixel(pin, center, zoom, width, height) {
  const valid = v => Number.isFinite(Number(v?.latitude)) && Number.isFinite(Number(v?.longitude))
    && Math.abs(Number(v.latitude)) <= 90 && Math.abs(Number(v.longitude)) <= 180;
  if (!valid(pin) || !valid(center) || !Number.isFinite(zoom) || !Number.isFinite(width) || !Number.isFinite(height)) return null;
  const worldSize = 256 * 2 ** zoom;
  if (!Number.isFinite(worldSize) || worldSize <= 0 || width <= 0 || height <= 0) return null;
  const project = (latitude, longitude) => {
    const lat = Math.max(-85.05112878, Math.min(85.05112878, Number(latitude)));
    const sin = Math.sin(lat * Math.PI / 180);
    return {
      x: (Number(longitude) + 180) / 360 * worldSize,
      y: (.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize,
    };
  };
  const p=project(pin.latitude,pin.longitude);
  const c=project(center.latitude,center.longitude);
  // Wrap horizontally around the antimeridian.
  const dx=((p.x-c.x+worldSize*1.5)%worldSize)-worldSize*.5;
  return { x: width / 2 + dx, y: height / 2 + p.y - c.y };
}
