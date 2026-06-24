import type { AppTheme, ProjectModel } from '../types/models';
import {
  CARD_WIDTH,
  cardHeight,
  INTEGRATION_HEIGHT,
  INTEGRATION_WIDTH,
} from '../utils/diagramGeometry';
import { getDiagramRefs } from './diagramRefs';

export interface ExportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const EXPORT_CSS_VARS = [
  '--bg-canvas',
  '--bg-card',
  '--bg-integration',
  '--accent-primary',
  '--accent-secondary',
  '--accent-tertiary',
  '--text-primary',
  '--text-muted',
  '--border-soft',
  '--arrow-inherit',
  '--arrow-implement',
  '--arrow-use',
];

export function computeProjectBounds(project: ProjectModel): ExportBounds | null {
  const boxes: ExportBounds[] = [];
  for (const f of project.folders) {
    boxes.push({ x: f.x, y: f.y, width: f.width, height: f.height });
  }
  for (const c of project.classes) {
    boxes.push({ x: c.x, y: c.y, width: CARD_WIDTH, height: cardHeight(c.members.length) });
  }
  for (const i of project.integrations) {
    boxes.push({ x: i.x, y: i.y, width: INTEGRATION_WIDTH, height: INTEGRATION_HEIGHT });
  }
  if (boxes.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boxes) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function themeCssBlock(theme: AppTheme): string {
  const root = document.documentElement;
  const prev = root.dataset.theme;
  root.dataset.theme = theme;
  const style = getComputedStyle(root);
  const lines = EXPORT_CSS_VARS.map((v) => `${v}: ${style.getPropertyValue(v).trim() || 'transparent'};`);
  if (prev) root.dataset.theme = prev;
  else delete root.dataset.theme;
  return `:root { ${lines.join(' ')} }`;
}

function buildExportSvgContent(viewport: SVGGElement, bounds: ExportBounds, padding: number, theme: AppTheme): string {
  const clone = viewport.cloneNode(true) as SVGGElement;
  clone.removeAttribute('transform');
  clone.querySelector('.link-draft-layer')?.remove();
  clone.querySelectorAll('.selection-halo').forEach((el) => el.remove());

  const defs = viewport.ownerSVGElement?.querySelector('defs');
  const defsHtml = defs ? new XMLSerializer().serializeToString(defs) : '';

  const x = bounds.x - padding;
  const y = bounds.y - padding;
  const w = bounds.width + padding * 2;
  const h = bounds.height + padding * 2;
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim() || '#0a0d14';

  const inner = new XMLSerializer().serializeToString(clone);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${Math.round(w)}" height="${Math.round(h)}">
  <defs>
    <style><![CDATA[${themeCssBlock(theme)}]]></style>
    ${defsHtml}
  </defs>
  <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${bg.startsWith('#') ? bg : `var(--bg-canvas)`}" />
  ${inner}
</svg>`;
}

export function exportDiagramSvg(
  project: ProjectModel,
  theme: AppTheme,
  customBounds?: ExportBounds,
  padding = 48,
): string | null {
  const refs = getDiagramRefs();
  const bounds = customBounds ?? computeProjectBounds(project);
  if (!refs || !bounds || bounds.width === 0 || bounds.height === 0) return null;
  return buildExportSvgContent(refs.viewport, bounds, padding, theme);
}

export function downloadSvg(svgContent: string, filename: string): void {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportDiagramPng(
  project: ProjectModel,
  theme: AppTheme,
  customBounds?: ExportBounds,
  padding = 48,
  pixelRatio = 2,
): Promise<Blob | null> {
  const svgContent = exportDiagramSvg(project, theme, customBounds, padding);
  if (!svgContent) return null;

  const bounds = customBounds ?? computeProjectBounds(project);
  if (!bounds) return null;
  const w = Math.round(bounds.width + padding * 2);
  const h = Math.round(bounds.height + padding * 2);

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgContent], { type: 'image/svg+xml' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * pixelRatio;
      canvas.height = h * pixelRatio;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      ctx.scale(pixelRatio, pixelRatio);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function downloadPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.png') ? filename : `${filename}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
