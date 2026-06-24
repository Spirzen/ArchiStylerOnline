export const SNAP_THRESHOLD = 6;
export const SNAP_RELEASE_MULTIPLIER = 1.75;

export type SnapNode = {
  id: string;
  position: { x: number; y: number };
  width: number;
  height: number;
};

export type Guide = {
  axis: 'x' | 'y';
  pos: number;
  from: number;
  to: number;
};

export type Point = { x: number; y: number };

type SnapAnchorKind = 'border' | 'center';
type SnapAnchor = { value: number; kind: SnapAnchorKind };
type ActiveSnapAxis = { value: number; kind: SnapAnchorKind };

export type ActiveSnap = {
  x: ActiveSnapAxis | null;
  y: ActiveSnapAxis | null;
};

export function resolveSnapPosition(rawPosition: Point, snappedPosition: Point, dragging: boolean): Point {
  return dragging ? rawPosition : snappedPosition;
}

export function computeSnap(
  drag: SnapNode,
  dragPos: Point,
  others: SnapNode[],
  zoom = 1,
  activeSnap: ActiveSnap = { x: null, y: null },
): { position: Point; guides: Guide[]; activeSnap: ActiveSnap } {
  const threshold = SNAP_THRESHOLD / zoom;
  const releaseThreshold = threshold * SNAP_RELEASE_MULTIPLIER;
  const dw = drag.width;
  const dh = drag.height;
  const dEdgesX: SnapAnchor[] = [
    { value: dragPos.x, kind: 'border' },
    { value: dragPos.x + dw / 2, kind: 'center' },
    { value: dragPos.x + dw, kind: 'border' },
  ];
  const dEdgesY: SnapAnchor[] = [
    { value: dragPos.y, kind: 'border' },
    { value: dragPos.y + dh / 2, kind: 'center' },
    { value: dragPos.y + dh, kind: 'border' },
  ];

  let bestX = { diff: threshold, delta: 0, line: null as SnapAnchor | null, inRange: false };
  let bestY = { diff: threshold, delta: 0, line: null as SnapAnchor | null, inRange: false };
  let activeX = { diff: releaseThreshold, delta: 0, line: null as SnapAnchor | null };
  let activeY = { diff: releaseThreshold, delta: 0, line: null as SnapAnchor | null };

  for (const o of others) {
    if (o.width === 0 || o.height === 0) continue;
    const oXLines: SnapAnchor[] = [
      { value: o.position.x, kind: 'border' },
      { value: o.position.x + o.width / 2, kind: 'center' },
      { value: o.position.x + o.width, kind: 'border' },
    ];
    const oYLines: SnapAnchor[] = [
      { value: o.position.y, kind: 'border' },
      { value: o.position.y + o.height / 2, kind: 'center' },
      { value: o.position.y + o.height, kind: 'border' },
    ];
    for (const de of dEdgesX) {
      for (const line of oXLines) {
        if (de.kind !== line.kind) continue;
        const diff = line.value - de.value;
        if (Math.abs(diff) < bestX.diff) {
          bestX = { diff: Math.abs(diff), delta: diff, line, inRange: true };
        }
        if (
          line.value === activeSnap.x?.value &&
          line.kind === activeSnap.x.kind &&
          Math.abs(diff) < activeX.diff
        ) {
          activeX = { diff: Math.abs(diff), delta: diff, line };
        }
      }
    }
    for (const de of dEdgesY) {
      for (const line of oYLines) {
        if (de.kind !== line.kind) continue;
        const diff = line.value - de.value;
        if (Math.abs(diff) < bestY.diff) {
          bestY = { diff: Math.abs(diff), delta: diff, line, inRange: true };
        }
        if (
          line.value === activeSnap.y?.value &&
          line.kind === activeSnap.y.kind &&
          Math.abs(diff) < activeY.diff
        ) {
          activeY = { diff: Math.abs(diff), delta: diff, line };
        }
      }
    }
  }

  if (!bestX.inRange && activeX.line !== null) bestX = { ...activeX, inRange: true };
  if (!bestY.inRange && activeY.line !== null) bestY = { ...activeY, inRange: true };

  const finalPos = { x: dragPos.x + bestX.delta, y: dragPos.y + bestY.delta };
  const guides: Guide[] = [];

  if (bestX.line !== null) {
    const ys: number[] = [finalPos.y, finalPos.y + dh];
    for (const o of others) {
      const lines: SnapAnchor[] = [
        { value: o.position.x, kind: 'border' },
        { value: o.position.x + o.width / 2, kind: 'center' },
        { value: o.position.x + o.width, kind: 'border' },
      ];
      if (lines.some((v) => v.kind === bestX.line!.kind && Math.abs(v.value - bestX.line!.value) < 0.5)) {
        ys.push(o.position.y, o.position.y + o.height);
      }
    }
    guides.push({ axis: 'x', pos: bestX.line.value, from: Math.min(...ys), to: Math.max(...ys) });
  }
  if (bestY.line !== null) {
    const xs: number[] = [finalPos.x, finalPos.x + dw];
    for (const o of others) {
      const lines: SnapAnchor[] = [
        { value: o.position.y, kind: 'border' },
        { value: o.position.y + o.height / 2, kind: 'center' },
        { value: o.position.y + o.height, kind: 'border' },
      ];
      if (lines.some((v) => v.kind === bestY.line!.kind && Math.abs(v.value - bestY.line!.value) < 0.5)) {
        xs.push(o.position.x, o.position.x + o.width);
      }
    }
    guides.push({ axis: 'y', pos: bestY.line.value, from: Math.min(...xs), to: Math.max(...xs) });
  }

  return {
    position: finalPos,
    guides,
    activeSnap: {
      x: bestX.line ? { value: bestX.line.value, kind: bestX.line.kind } : null,
      y: bestY.line ? { value: bestY.line.value, kind: bestY.line.kind } : null,
    },
  };
}
