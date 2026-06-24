import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeProjectBounds,
  downloadPng,
  downloadSvg,
  exportDiagramPng,
  exportDiagramSvg,
  type ExportBounds,
} from '../services/imageExport';
import { useDiagramStore } from '../store/diagramStore';

type CropMode = { format: 'png' | 'svg' } | null;

export function ExportMenu() {
  const project = useDiagramStore((s) => s.project);
  const theme = useDiagramStore((s) => s.theme);
  const setStatus = useDiagramStore((s) => s.setStatus);
  const exportJson = useDiagramStore((s) => s.exportJson);
  const [open, setOpen] = useState(false);
  const [cropMode, setCropMode] = useState<CropMode>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  const defaultName = () =>
    `${project.name || 'diagram'}-${new Date().toISOString().slice(0, 10)}`;

  const runSvgExport = useCallback(
    (bounds?: ExportBounds) => {
      const svg = exportDiagramSvg(project, theme, bounds);
      if (!svg) {
        setStatus('Нечего экспортировать — добавьте элементы на схему');
        return;
      }
      downloadSvg(svg, defaultName());
      setStatus('SVG экспортирован');
    },
    [project, theme, setStatus],
  );

  const runPngExport = useCallback(
    async (bounds?: ExportBounds) => {
      const blob = await exportDiagramPng(project, theme, bounds);
      if (!blob) {
        setStatus('Нечего экспортировать — добавьте элементы на схему');
        return;
      }
      downloadPng(blob, defaultName());
      setStatus('PNG экспортирован');
    },
    [project, theme, setStatus],
  );

  const onCropComplete = useCallback(
    (rect: { x: number; y: number; width: number; height: number }) => {
      if (!cropMode) return;
      const wrap = document.querySelector('.canvas-wrap');
      const svg = document.querySelector('.diagram-svg') as SVGSVGElement | null;
      const vp = svg?.querySelector('g') as SVGGElement | null;
      if (!wrap || !svg || !vp) return;

      const tl = clientToWorld(svg, vp, rect.x, rect.y);
      const br = clientToWorld(svg, vp, rect.x + rect.width, rect.y + rect.height);
      const bounds: ExportBounds = {
        x: Math.min(tl.x, br.x),
        y: Math.min(tl.y, br.y),
        width: Math.abs(br.x - tl.x),
        height: Math.abs(br.y - tl.y),
      };
      setCropMode(null);
      if (cropMode.format === 'svg') runSvgExport(bounds);
      else void runPngExport(bounds);
    },
    [cropMode, runSvgExport, runPngExport],
  );

  return (
    <>
      <div className="export-menu-wrap" ref={ref}>
        <button type="button" className="btn btn-compact" onClick={() => setOpen((o) => !o)}>
          Экспорт ▾
        </button>
        {open && (
          <div className="export-menu" role="menu">
            <button
              type="button"
              className="export-menu-item"
              onClick={() => {
                exportJson();
                setOpen(false);
              }}
            >
              JSON (.archistyler.json)
            </button>
            <button
              type="button"
              className="export-menu-item"
              onClick={() => {
                setOpen(false);
                if (computeProjectBounds(project)) runSvgExport();
                else setStatus('Нечего экспортировать');
              }}
            >
              SVG — вся схема
            </button>
            <button
              type="button"
              className="export-menu-item"
              onClick={() => {
                setOpen(false);
                setCropMode({ format: 'svg' });
              }}
            >
              SVG — выделить область
            </button>
            <button
              type="button"
              className="export-menu-item"
              onClick={() => {
                setOpen(false);
                if (computeProjectBounds(project)) void runPngExport();
                else setStatus('Нечего экспортировать');
              }}
            >
              PNG — вся схема
            </button>
            <button
              type="button"
              className="export-menu-item"
              onClick={() => {
                setOpen(false);
                setCropMode({ format: 'png' });
              }}
            >
              PNG — выделить область
            </button>
          </div>
        )}
      </div>
      {cropMode && (
        <CropOverlay
          onComplete={onCropComplete}
          onExportAll={() => {
            const fmt = cropMode.format;
            setCropMode(null);
            if (fmt === 'svg') runSvgExport();
            else void runPngExport();
          }}
          onCancel={() => setCropMode(null)}
        />
      )}
    </>
  );
}

function clientToWorld(svg: SVGSVGElement, viewport: SVGGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const ctm = viewport.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const local = pt.matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}

function CropOverlay({
  onComplete,
  onExportAll,
  onCancel,
}: {
  onComplete: (rect: { x: number; y: number; width: number; height: number }) => void;
  onExportAll: () => void;
  onCancel: () => void;
}) {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [end, setEnd] = useState<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onCancel]);

  const rect =
    start && end
      ? {
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y),
          width: Math.abs(end.x - start.x),
          height: Math.abs(end.y - start.y),
        }
      : null;

  return (
    <div
      className="export-crop-overlay"
      onMouseDown={(e) => {
        if (e.button !== 0) return;
        dragging.current = true;
        setStart({ x: e.clientX, y: e.clientY });
        setEnd({ x: e.clientX, y: e.clientY });
      }}
      onMouseMove={(e) => {
        if (!dragging.current) return;
        setEnd({ x: e.clientX, y: e.clientY });
      }}
      onMouseUp={() => {
        if (!dragging.current || !rect || rect.width < 10 || rect.height < 10) {
          dragging.current = false;
          setStart(null);
          setEnd(null);
          return;
        }
        dragging.current = false;
        onComplete(rect);
      }}
    >
      {rect && rect.width > 2 ? (
        <div
          className="export-crop-selection"
          style={{
            left: rect.x,
            top: rect.y,
            width: rect.width,
            height: rect.height,
          }}
        />
      ) : (
        <div className="export-crop-dim" />
      )}
      <div className="export-crop-hint">
        <span>Выделите область для экспорта</span>
        <button type="button" className="btn btn-compact" onMouseDown={(e) => e.stopPropagation()} onClick={onExportAll}>
          Вся схема
        </button>
        <span className="export-crop-esc">Esc — отмена</span>
      </div>
    </div>
  );
}
