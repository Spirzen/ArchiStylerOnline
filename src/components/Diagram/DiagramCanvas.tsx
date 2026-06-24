import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { registerDiagramRefs } from '../../services/diagramRefs';
import { useDiagramStore } from '../../store/diagramStore';
import type { ConnectionPort, ProjectModel } from '../../types/models';
import {
  bezierPath,
  cardHeight,
  CARD_WIDTH,
  INTEGRATION_HEIGHT,
  INTEGRATION_WIDTH,
  integrationPortPosition,
  portPosition,
} from '../../utils/diagramGeometry';
import { nearestPortFromIntegrationLocal, nearestPortFromLocal } from '../../utils/hitTest';
import {
  computeSnap,
  type ActiveSnap,
  type Guide,
  type SnapNode,
} from '../../utils/snapping';
import { clientToWorld, wheelZoomFactor } from '../../utils/viewport';
import { ClassCard } from './ClassCard';
import { ContextMenu } from './ContextMenu';
import { FolderBox } from './FolderBox';
import { IntegrationCard } from './IntegrationCard';
import { RelationLayer } from './RelationLayer';
import { RelationPicker } from './RelationPicker';

const WORLD_W = 3200;
const WORLD_H = 2400;

function buildSnapNodes(project: ProjectModel, excludeId?: string): SnapNode[] {
  const nodes: SnapNode[] = [];
  for (const c of project.classes) {
    if (c.id === excludeId) continue;
    nodes.push({
      id: c.id,
      position: { x: c.x, y: c.y },
      width: CARD_WIDTH,
      height: cardHeight(c.members.length),
    });
  }
  for (const i of project.integrations) {
    if (i.id === excludeId) continue;
    nodes.push({
      id: i.id,
      position: { x: i.x, y: i.y },
      width: INTEGRATION_WIDTH,
      height: INTEGRATION_HEIGHT,
    });
  }
  return nodes;
}

export function DiagramCanvas() {
  const project = useDiagramStore((s) => s.project);
  const zoom = useDiagramStore((s) => s.zoom);
  const panX = useDiagramStore((s) => s.panX);
  const panY = useDiagramStore((s) => s.panY);
  const selectedClassIds = useDiagramStore((s) => s.selectedClassIds);
  const selectedFolderId = useDiagramStore((s) => s.selectedFolderId);
  const selectedIntegrationIds = useDiagramStore((s) => s.selectedIntegrationIds);
  const linkDraft = useDiagramStore((s) => s.linkDraft);
  const linkHoverTargetId = useDiagramStore((s) => s.linkHoverTargetId);
  const linkAwaitingTarget = useDiagramStore((s) => s.linkAwaitingTarget);
  const zoomAt = useDiagramStore((s) => s.zoomAt);
  const setPan = useDiagramStore((s) => s.setPan);
  const selectClass = useDiagramStore((s) => s.selectClass);
  const clearSelection = useDiagramStore((s) => s.clearSelection);
  const selectInRect = useDiagramStore((s) => s.selectInRect);
  const selectFolder = useDiagramStore((s) => s.selectFolder);
  const selectIntegration = useDiagramStore((s) => s.selectIntegration);
  const selectRelation = useDiagramStore((s) => s.selectRelation);
  const moveClass = useDiagramStore((s) => s.moveClass);
  const moveFolder = useDiagramStore((s) => s.moveFolder);
  const moveIntegration = useDiagramStore((s) => s.moveIntegration);
  const startLinkFromClass = useDiagramStore((s) => s.startLinkFromClass);
  const startLinkFromIntegration = useDiagramStore((s) => s.startLinkFromIntegration);
  const updateLinkDraft = useDiagramStore((s) => s.updateLinkDraft);
  const completeLinkAt = useDiagramStore((s) => s.completeLinkAt);
  const cancelLink = useDiagramStore((s) => s.cancelLink);
  const persist = useDiagramStore((s) => s.persist);
  const nudgeSelected = useDiagramStore((s) => s.nudgeSelected);
  const copySelection = useDiagramStore((s) => s.copySelection);
  const pasteClipboard = useDiagramStore((s) => s.pasteClipboard);
  const openContextMenu = useDiagramStore((s) => s.openContextMenu);
  const closeContextMenu = useDiagramStore((s) => s.closeContextMenu);
  const smartGuidesEnabled = useDiagramStore((s) => s.smartGuidesEnabled);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<SVGGElement>(null);
  const linkingRef = useRef(false);
  const activeSnaps = useRef<Map<string, ActiveSnap>>(new Map());
  const [guides, setGuides] = useState<Guide[]>([]);
  const [panning, setPanning] = useState(false);
  const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );

  type NodeOrigin = { x: number; y: number; kind: 'class' | 'integration' };

  const dragRef = useRef<{
    kind: 'class' | 'folder' | 'integration' | 'pan' | 'marquee' | 'group';
    id?: string;
    startX: number;
    startY: number;
    origX?: number;
    origY?: number;
    groupStartWorld?: { x: number; y: number };
    groupOrigins?: Map<string, NodeOrigin>;
    moved?: boolean;
  } | null>(null);

  const selectionCount = selectedClassIds.length + selectedIntegrationIds.length;

  const buildGroupOrigins = (): Map<string, NodeOrigin> => {
    const origins = new Map<string, NodeOrigin>();
    const state = useDiagramStore.getState();
    for (const id of state.selectedClassIds) {
      const cls = state.project.classes.find((c) => c.id === id);
      if (cls) origins.set(id, { x: cls.x, y: cls.y, kind: 'class' });
    }
    for (const id of state.selectedIntegrationIds) {
      const intg = state.project.integrations.find((i) => i.id === id);
      if (intg) origins.set(id, { x: intg.x, y: intg.y, kind: 'integration' });
    }
    return origins;
  };

  const startGroupDrag = (e: React.PointerEvent) => {
    const w = toWorld(e.clientX, e.clientY);
    dragRef.current = {
      kind: 'group',
      startX: e.clientX,
      startY: e.clientY,
      groupStartWorld: w,
      groupOrigins: buildGroupOrigins(),
      moved: false,
    };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const toWorld = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const vp = viewportRef.current;
    if (!svg || !vp) return { x: 0, y: 0 };
    return clientToWorld(svg, vp, clientX, clientY);
  }, []);

  const toScreen = useCallback((clientX: number, clientY: number) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const captureLinkPointer = (e: React.PointerEvent) => {
    linkingRef.current = true;
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const releaseLinkPointer = (e: React.PointerEvent) => {
    linkingRef.current = false;
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ok */
    }
  };

  const finishLinkGesture = (e: React.PointerEvent) => {
    const { linkDraft } = useDiagramStore.getState();
    if (!linkDraft && !linkingRef.current) return false;
    const w = toWorld(e.clientX, e.clientY);
    const s = toScreen(e.clientX, e.clientY);
    completeLinkAt(w.x, w.y, s.x, s.y);
    releaseLinkPointer(e);
    return true;
  };

  const beginLinkFromClassPort = (classId: string, port: ConnectionPort, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    startLinkFromClass(classId, port);
    const w = toWorld(e.clientX, e.clientY);
    updateLinkDraft(w.x, w.y);
    captureLinkPointer(e);
  };

  const beginLinkFromIntegrationPort = (integrationId: string, port: ConnectionPort, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    startLinkFromIntegration(integrationId, port);
    const w = toWorld(e.clientX, e.clientY);
    updateLinkDraft(w.x, w.y);
    captureLinkPointer(e);
  };

  const beginLinkFromClassBody = (classId: string, e: React.PointerEvent) => {
    const cls = project.classes.find((c) => c.id === classId)!;
    const w = toWorld(e.clientX, e.clientY);
    const port = nearestPortFromLocal(w.x - cls.x, w.y - cls.y, cls.members.length);
    beginLinkFromClassPort(classId, port, e);
  };

  const beginLinkFromIntegrationBody = (integrationId: string, e: React.PointerEvent) => {
    const intg = project.integrations.find((i) => i.id === integrationId)!;
    const w = toWorld(e.clientX, e.clientY);
    const port = nearestPortFromIntegrationLocal(w.x - intg.x, w.y - intg.y);
    beginLinkFromIntegrationPort(integrationId, port, e);
  };

  useLayoutEffect(() => {
    registerDiagramRefs(svgRef.current, viewportRef.current);
    return () => registerDiagramRefs(null, null);
  });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, wheelZoomFactor(e.deltaY));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        cancelLink();
        closeContextMenu();
        clearSelection();
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudgeSelected(-1, 0);
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudgeSelected(1, 0);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        nudgeSelected(0, -1);
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        nudgeSelected(0, 1);
      }
      if (e.ctrlKey && e.key === 'c') {
        e.preventDefault();
        copySelection();
      }
      if (e.ctrlKey && e.key === 'v') {
        e.preventDefault();
        pasteClipboard();
      }
      if (e.key === 'Delete') {
        useDiagramStore.getState().deleteSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelLink, closeContextMenu, clearSelection, nudgeSelected, copySelection, pasteClipboard]);

  const openMenuAt = (e: React.MouseEvent, target: 'canvas' | 'class' | 'integration' | 'relation', targetId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (target === 'class' && targetId) selectClass(targetId);
    if (target === 'integration' && targetId) selectIntegration(targetId);
    if (target === 'relation' && targetId) selectRelation(targetId);
    const w = toWorld(e.clientX, e.clientY);
    openContextMenu({
      screenX: e.clientX,
      screenY: e.clientY,
      worldX: w.x,
      worldY: w.y,
      target,
      targetId,
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as SVGElement;
    if (target.dataset.canvasBg !== 'true') return;

    closeContextMenu();
    if (useDiagramStore.getState().linkDraft) {
      cancelLink();
      return;
    }

    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setPanning(true);
      dragRef.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, moved: false };
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }

    if (e.button !== 0) return;

    const screen = toScreen(e.clientX, e.clientY);
    setMarquee({ x: screen.x, y: screen.y, width: 0, height: 0 });
    dragRef.current = {
      kind: 'marquee',
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
    };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (linkDraft || linkingRef.current) {
      const w = toWorld(e.clientX, e.clientY);
      updateLinkDraft(w.x, w.y);
    }

    const d = dragRef.current;
    if (!d) return;

    if (d.kind === 'pan') {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) d.moved = true;
      const { panX: px, panY: py } = useDiagramStore.getState();
      setPan(px + dx, py + dy);
      dragRef.current = { ...d, startX: e.clientX, startY: e.clientY };
    } else if (d.kind === 'marquee') {
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      const a = toScreen(d.startX, d.startY);
      const b = toScreen(e.clientX, e.clientY);
      setMarquee({
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y),
      });
    } else if (d.kind === 'group' && d.groupOrigins && d.groupStartWorld) {
      d.moved = true;
      const w = toWorld(e.clientX, e.clientY);
      const dx = w.x - d.groupStartWorld.x;
      const dy = w.y - d.groupStartWorld.y;
      for (const [id, orig] of d.groupOrigins) {
        if (orig.kind === 'class') moveClass(id, orig.x + dx, orig.y + dy);
        else moveIntegration(id, orig.x + dx, orig.y + dy);
      }
    } else if (d.kind === 'class' && d.id) {
      d.moved = true;
      const w = toWorld(e.clientX, e.clientY);
      let nx = w.x - (d.origX ?? 0);
      let ny = w.y - (d.origY ?? 0);
      const state = useDiagramStore.getState();
      if (state.smartGuidesEnabled) {
        const cls = state.project.classes.find((c) => c.id === d.id);
        if (cls) {
          const dragNode: SnapNode = {
            id: d.id,
            position: { x: nx, y: ny },
            width: CARD_WIDTH,
            height: cardHeight(cls.members.length),
          };
          const snap = computeSnap(
            dragNode,
            { x: nx, y: ny },
            buildSnapNodes(state.project, d.id),
            state.zoom,
            activeSnaps.current.get(d.id) ?? { x: null, y: null },
          );
          activeSnaps.current.set(d.id, snap.activeSnap);
          setGuides(snap.guides);
          nx = snap.position.x;
          ny = snap.position.y;
        }
      } else if (guides.length > 0) {
        setGuides([]);
      }
      moveClass(d.id, nx, ny);
    } else if (d.kind === 'integration' && d.id) {
      d.moved = true;
      const w = toWorld(e.clientX, e.clientY);
      let nx = w.x - (d.origX ?? 0);
      let ny = w.y - (d.origY ?? 0);
      const state = useDiagramStore.getState();
      if (state.smartGuidesEnabled) {
        const dragNode: SnapNode = {
          id: d.id,
          position: { x: nx, y: ny },
          width: INTEGRATION_WIDTH,
          height: INTEGRATION_HEIGHT,
        };
        const snap = computeSnap(
          dragNode,
          { x: nx, y: ny },
          buildSnapNodes(state.project, d.id),
          state.zoom,
          activeSnaps.current.get(d.id) ?? { x: null, y: null },
        );
        activeSnaps.current.set(d.id, snap.activeSnap);
        setGuides(snap.guides);
        nx = snap.position.x;
        ny = snap.position.y;
      } else if (guides.length > 0) {
        setGuides([]);
      }
      moveIntegration(d.id, nx, ny);
    } else if (d.kind === 'folder' && d.id) {
      d.moved = true;
      const { zoom: z } = useDiagramStore.getState();
      const dx = (e.clientX - d.startX) / z;
      const dy = (e.clientY - d.startY) / z;
      moveFolder(d.id, dx, dy);
      dragRef.current = { ...d, startX: e.clientX, startY: e.clientY };
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (finishLinkGesture(e)) {
      dragRef.current = null;
      setPanning(false);
      return;
    }

    const kind = dragRef.current?.kind;
    const dragId = dragRef.current?.id;
    const moved = dragRef.current?.moved;

    if (kind === 'marquee') {
      if (!moved || !marquee || marquee.width < 6 || marquee.height < 6) {
        clearSelection();
      } else {
        const w1 = toWorld(dragRef.current!.startX, dragRef.current!.startY);
        const w2 = toWorld(e.clientX, e.clientY);
        selectInRect({
          x: Math.min(w1.x, w2.x),
          y: Math.min(w1.y, w2.y),
          width: Math.abs(w2.x - w1.x),
          height: Math.abs(w2.y - w1.y),
        });
      }
      setMarquee(null);
    }

    if (kind === 'class' || kind === 'folder' || kind === 'integration' || kind === 'group') {
      if (dragId) activeSnaps.current.delete(dragId);
      setGuides([]);
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

  const onClassBodyDown = (id: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    closeContextMenu();

    if (linkAwaitingTarget || linkDraft) {
      finishLinkGesture(e);
      return;
    }

    if (e.shiftKey) {
      beginLinkFromClassBody(id, e);
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      selectClass(id, true);
      return;
    }

    const st = useDiagramStore.getState();
    const inSel = st.selectedClassIds.includes(id);
    const multi = st.selectedClassIds.length + st.selectedIntegrationIds.length > 1;
    if (!inSel) selectClass(id);

    if (inSel && multi) {
      startGroupDrag(e);
      return;
    }

    const cls = project.classes.find((c) => c.id === id)!;
    const w = toWorld(e.clientX, e.clientY);
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

  const onIntegrationBodyDown = (id: string, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    closeContextMenu();

    if (linkAwaitingTarget || linkDraft) {
      finishLinkGesture(e);
      return;
    }

    if (e.shiftKey) {
      beginLinkFromIntegrationBody(id, e);
      return;
    }

    if (e.ctrlKey || e.metaKey) {
      selectIntegration(id, true);
      return;
    }

    const st = useDiagramStore.getState();
    const inSel = st.selectedIntegrationIds.includes(id);
    const multi = st.selectedClassIds.length + st.selectedIntegrationIds.length > 1;
    if (!inSel) selectIntegration(id);

    if (inSel && multi) {
      startGroupDrag(e);
      return;
    }

    const intg = project.integrations.find((i) => i.id === id)!;
    const w = toWorld(e.clientX, e.clientY);
    dragRef.current = {
      kind: 'integration',
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: w.x - intg.x,
      origY: w.y - intg.y,
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
    const nodes: { x: number; y: number; w: number; h: number }[] = [
      ...project.classes.map((c) => ({
        x: c.x,
        y: c.y,
        w: 220,
        h: cardHeight(c.members.length),
      })),
      ...project.integrations.map((i) => ({ x: i.x, y: i.y, w: 200, h: 72 })),
    ];
    if (nodes.length === 0) {
      useDiagramStore.setState({ zoom: 1, panX: 48, panY: 48 });
      return;
    }
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.w);
      maxY = Math.max(maxY, n.y + n.h);
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

  const draftFromPos = () => {
    if (!linkDraft) return null;
    if (linkDraft.fromClassId) {
      const cls = project.classes.find((c) => c.id === linkDraft.fromClassId)!;
      return portPosition(cls, linkDraft.fromPort, cls.members.length);
    }
    const intg = project.integrations.find((i) => i.id === linkDraft.fromIntegrationId)!;
    return integrationPortPosition(intg, linkDraft.fromPort);
  };

  const fromPos = draftFromPos();
  const isLinking = !!linkDraft;

  return (
    <div
      ref={wrapRef}
      className={`canvas-wrap ${panning ? 'panning' : ''} ${isLinking ? 'linking' : ''} ${marquee ? 'selecting' : ''}`}
      onContextMenu={(e) => openMenuAt(e, 'canvas')}
    >
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
            <marker id="arrow-filled" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L10,3 L0,6 Z" fill="currentColor" />
            </marker>
            <marker id="arrow-open" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L12,4 L0,8 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </marker>
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

          {project.integrations.map((intg) => (
            <IntegrationCard
              key={intg.id}
              integration={intg}
              selected={selectedIntegrationIds.includes(intg.id)}
              linkTarget={linkHoverTargetId === intg.id}
              onBodyPointerDown={(e) => onIntegrationBodyDown(intg.id, e)}
              onPortPointerDown={(e, port) => beginLinkFromIntegrationPort(intg.id, port, e)}
              onContextMenu={(e) => openMenuAt(e, 'integration', intg.id)}
            />
          ))}

          {project.classes.map((cls) => (
            <ClassCard
              key={cls.id}
              cls={cls}
              selected={selectedClassIds.includes(cls.id)}
              linkTarget={linkHoverTargetId === cls.id}
              onBodyPointerDown={(e) => onClassBodyDown(cls.id, e)}
              onPortPointerDown={(e, port) => beginLinkFromClassPort(cls.id, port, e)}
              onContextMenu={(e) => openMenuAt(e, 'class', cls.id)}
            />
          ))}

          <RelationLayer
            classes={project.classes}
            integrations={project.integrations}
            relations={project.relations}
            implicit
          />

          {isLinking && fromPos && (
            <g className="link-draft-layer" pointerEvents="none">
              <path
                d={bezierPath(fromPos.x, fromPos.y, linkDraft!.x, linkDraft!.y)}
                fill="none"
                stroke="var(--accent-primary)"
                strokeWidth={3}
                strokeDasharray="10 6"
                opacity={0.95}
              />
              <circle cx={fromPos.x} cy={fromPos.y} r={6} fill="var(--accent-primary)" />
              <circle cx={linkDraft!.x} cy={linkDraft!.y} r={5} fill="var(--accent-secondary)" stroke="var(--bg-canvas)" strokeWidth={2} />
            </g>
          )}
        </g>
      </svg>

      {marquee && marquee.width > 2 && (
        <div
          className="selection-marquee"
          style={{
            left: marquee.x,
            top: marquee.y,
            width: marquee.width,
            height: marquee.height,
          }}
        />
      )}

      {selectionCount > 1 && !marquee && (
        <div className="selection-count-badge">{selectionCount} выбрано</div>
      )}

      {smartGuidesEnabled && guides.length > 0 && (
        <svg className="smart-guides-overlay" aria-hidden>
          {guides.map((g, i) => {
            if (g.axis === 'x') {
              const x = panX + g.pos * zoom;
              return (
                <line
                  key={i}
                  x1={x}
                  x2={x}
                  y1={panY + g.from * zoom}
                  y2={panY + g.to * zoom}
                  stroke="#ef4444"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
              );
            }
            const y = panY + g.pos * zoom;
            return (
              <line
                key={i}
                x1={panX + g.from * zoom}
                x2={panX + g.to * zoom}
                y1={y}
                y2={y}
                stroke="#ef4444"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            );
          })}
        </svg>
      )}

      {isLinking && (
        <div className="link-hint-banner">Отпустите на целевом классе или сервисе · Shift — связь с тела карточки</div>
      )}

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
      <ContextMenu />
    </div>
  );
}
