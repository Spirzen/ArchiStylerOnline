/** Convert client (screen) coords to world coords inside the viewport group. */
export function clientToWorld(
  svg: SVGSVGElement,
  viewport: SVGGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = viewport.getScreenCTM()?.inverse();
  if (!ctm) return { x: 0, y: 0 };
  const w = pt.matrixTransform(ctm);
  return { x: w.x, y: w.y };
}

/** Zoom toward a screen point; returns new pan to keep world point under cursor. */
export function zoomAtPoint(
  panX: number,
  panY: number,
  zoom: number,
  screenX: number,
  screenY: number,
  newZoom: number,
): { panX: number; panY: number } {
  const worldX = (screenX - panX) / zoom;
  const worldY = (screenY - panY) / zoom;
  return {
    panX: screenX - worldX * newZoom,
    panY: screenY - worldY * newZoom,
  };
}

export function clampZoom(z: number): number {
  return Math.min(4, Math.max(0.15, z));
}

export function wheelZoomFactor(deltaY: number): number {
  return Math.exp(-deltaY * 0.002);
}
