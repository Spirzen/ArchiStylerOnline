import { useCallback, useEffect, useRef, useState } from 'react';
import { useDiagramStore } from '../../store/diagramStore';
import type { ConnectionPort } from '../../types/models';
import { bezierPath, portPosition } from '../../utils/diagramGeometry';
import { clientToWorld, wheelZoomFactor } from '../../utils/viewport';
import { ClassCard } from './ClassCard';
import { FolderBox } from './FolderBox';
import { RelationLayer } from './RelationLayer';
import { RelationPicker } from './RelationPicker';

const WORLD_W = 3200;
const WORLD_H = 2400;

export function DiagramCanvas() {
  const project = useDiagramStore((s) => s.project);
  const zoom = useDiagramStore((s) => s.zoom);
  const panX = useDiagramStore((s) => s.panX);
  const panY = useDiagramStore((s) => s.panY);
  const selectedClassId = useDiagramStore((s) => s.selectedClassId);
  const selectedFolderId = useDiagramStore((s) => s.selectedFolderId);
  const linkDraft = useDiagramStore((s) => s.linkDraft);
  const zoomAt = useDiagramStore((s) => s.zoomAt);
  const setPan = useDiagramStore((s) => s.setPan);
  const selectClass = useDiagramStore((s) => s.selectClass);
  const selectFolder = useDiagramStore((s) => s.selectFolder);
  const selectRelation = useDiagramStore((s) => s.selectRelation);
  const moveClass = useDiagramStore((s) => s.moveClass);
  const moveFolder = useDiagramStore((s) => s.moveFolder);
  const startLink = useDiagramStore((s) => s.startLink);
  const updateLinkDraft = useDiagramStore((s) => s.updateLinkDraft);
  const finishLinkOnClass = useDiagramStore((s) => s.finishLinkOnClass);
  const cancelLink = useDiagramStore((s) => s.cancelLink);
  const persist = useDiagramStore((s) => s.persist);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<SVGGElement>(null);
  const [panning, setPanning] = useState(false);

  const dragRef = useRef<{
    kind: 'class' | 'folder' | 'pan';
    id?: string;
    startX: number;
    startY: number;
    origX?: number;
    origY?: number;
    moved?: boolean;
  } | null>(null);

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const vp = viewportRef.current;
    if (!svg || !vp) return { x: 0, y: 0 };
    return clientToWorld(svg, vp, clientX, clientY);
  }, []);

  const toScreen = useCallback(
    (clientX: number, clientY: number) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return { x: clientX, y: clientY };
      return { x: clientX - rect.left, y: clientY - rect.top };
    },
    [],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      zoomAt(sx, sy, wheelZoomFactor(e.deltaY));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as SVGElement;
    if (target.dataset.canvasBg !== 'true') return;
    if (e.button !== 0) return;

    setPanning(true);
    dragRef.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, moved: false };
    selectClass(null);
    selectFolder(null);
    selectRelation(null);
    cancelLink();
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) {
      if (linkDraft) {
        const w = toWorld(e.clientX, e.clientY);
        updateLinkDraft(w.x, w.y);
      }
      return;
    }

    if (d.kind === 'pan') {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true;
      setPan(panX + dx, panY + dy);
      dragRef.current = { ...d, startX: e.clientX, startY: e.clientY };
    } else if (d.kind === 'class' && d.id) {
      d.moved = true;
      const w = toWorld(e.clientX, e.clientY);
      moveClass(d.id, w.x - (d.origX ?? 0), w.y - (d.origY ?? 0));
    } else if (d.kind === 'folder' && d.id) {
      d.moved = true;
      const dx = (e.clientX - d.startX) / zoom;
      const dy = (e.clientY - d.startY) / zoom;
      moveFolder(d.id, dx, dy);
      dragRef.current = { ...d, startX: e.clientX, startY: e.clientY };
    }

    if (linkDraft) {
      const w = toWorld(e.clientX, e.clientY);
      updateLinkDraft(w.x, w.y);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (dragRef.current?.kind === 'class' || dragRef.current?.kind === 'folder') {
      persist();
    }
    dragRef.current = null;
    setPanning(false);
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ok */
    }
  };

  const beginClassDrag = (id: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const cls = project.classes.find((c) => c.id === id)!;
    const w = toWorld(e.clientX, e.clientY);
    selectClass(id);
    dragRef.current = {
      kind: 'class',
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: w.x - cls.x,
      origY: w.y - cls.y,
      moved: false,
    };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const beginFolderDrag = (id: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    selectFolder(id);
    dragRef.current = { kind: 'folder', id, startX: e.clientX, startY: e.clientY, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const handleZoomButton = (delta: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAt(rect.width / 2, rect.height / 2, delta > 0 ? 1.15 : 1 / 1.15);
  };

  const handleFitView = () => {
    if (project.classes.length === 0) {
      useDiagramStore.setState({ zoom: 1, panX: 48, panY: 48 });
      return;
    }
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of project.classes) {
      minX = Math.min(minX, c.x);
      minY = Math.min(minY, c.y);
      maxX = Math.max(maxX, c.x + 220);
      maxY = Math.max(maxY, c.y + 180);
    }
    const bw = maxX - minX + 80;
    const bh = maxY - minY + 80;
    const fitZoom = Math.min(rect.width / bw, rect.height / bh, 1.5);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    useDiagramStore.setState({
      zoom: Math.max(0.15, Math.min(4, fitZoom)),
      panX: rect.width / 2 - cx * fitZoom,
      panY: rect.height / 2 - cy * fitZoom,
    });
  };

  return (
    <div ref={wrapRef} className={`canvas-wrap ${panning ? 'panning' : ''}`}>
      <svg
        ref={svgRef}
        className="diagram-svg"
        width="100%"
        height="100%"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <g ref={viewportRef} transform={`translate(${panX}, ${panY}) scale(${zoom})`}>
          <rect
            data-canvas-bg="true"
            x={-5000}
            y={-5000}
            width={WORLD_W + 10000}
            height={WORLD_H + 10000}
            fill="var(--bg-canvas)"
          />
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="var(--border-soft)"
                strokeWidth="0.5"
                opacity="0.35"
              />
            </pattern>
          </defs>
          <rect data-canvas-bg="true" width={WORLD_W} height={WORLD_H} fill="url(#grid)" />

          {project.folders.map((f) => (
            <g key={f.id}>
              <FolderBox
                folder={f}
                selected={selectedFolderId === f.id}
                onTitlePointerDown={(e) => beginFolderDrag(f.id, e)}
              />
            </g>
          ))}

          <RelationLayer classes={project.classes} relations={project.relations} implicit />

          {linkDraft && (
            <path
              d={(() => {
                const cls = project.classes.find((c) => c.id === linkDraft.fromClassId)!;
                const p = portPosition(cls, linkDraft.fromPort, cls.members.length);
                return bezierPath(p.x, p.y, linkDraft.x, linkDraft.y);
              })()}
              fill="none"
              stroke="var(--accent-primary)"
              strokeWidth={2}
              strokeDasharray="8 4"
              opacity={0.8}
              pointerEvents="none"
            />
          )}

          {project.classes.map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              selected={selectedClassId === cls.id}
              onPointerDown={(e) => beginClassDrag(cls.id, e)}
              onStartLink={(id, port: ConnectionPort) => {
                startLink(id, port);
                const c = project.classes.find((x) => x.id === id)!;
                const p = portPosition(c, port, c.members.length);
                updateLinkDraft(p.x, p.y);
              }}
              onPointerUp={(e) => {
                if (linkDraft && linkDraft.fromClassId !== cls.id) {
                  const s = toScreen(e.clientX, e.clientY);
                  finishLinkOnClass(cls.id, s.x, s.y);
                }
              }}
            />
          ))}
        </g>
      </svg>

      <div className="canvas-controls">
        <button type="button" className="btn btn-compact" title="Уменьшить" onClick={() => handleZoomButton(-1)}>
          −
        </button>
        <span className="zoom-label">{Math.round(zoom * 100)}%</span>
        <button type="button" className="btn btn-compact" title="Увеличить" onClick={() => handleZoomButton(1)}>
          +
        </button>
        <button type="button" className="btn btn-compact" title="Вписать схему" onClick={handleFitView}>
          ⊡
        </button>
      </div>

      <RelationPicker />
    </div>
  );
}
