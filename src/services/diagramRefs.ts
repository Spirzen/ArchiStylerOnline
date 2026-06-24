let svgEl: SVGSVGElement | null = null;
let viewportEl: SVGGElement | null = null;

export function registerDiagramRefs(svg: SVGSVGElement | null, viewport: SVGGElement | null): void {
  svgEl = svg;
  viewportEl = viewport;
}

export function getDiagramRefs(): { svg: SVGSVGElement; viewport: SVGGElement } | null {
  if (!svgEl || !viewportEl) return null;
  return { svg: svgEl, viewport: viewportEl };
}
