import type { ClassDefinition, ConnectionPort, FolderDefinition } from '../types/models';

export const CARD_WIDTH = 200;
export const CARD_HEADER = 52;
export const CARD_LINE = 18;
export const CARD_MAX_LINES = 6;
export const CARD_PADDING = 8;

export function cardHeight(memberCount: number): number {
  const lines = Math.min(memberCount, CARD_MAX_LINES);
  return CARD_HEADER + lines * CARD_LINE + CARD_PADDING;
}

export function portPosition(
  cls: ClassDefinition,
  port: ConnectionPort,
  memberCount: number,
): { x: number; y: number } {
  const w = CARD_WIDTH;
  const h = cardHeight(memberCount);
  const cx = cls.x + w / 2;
  const cy = cls.y + h / 2;
  switch (port) {
    case 'north':
      return { x: cx, y: cls.y };
    case 'south':
      return { x: cx, y: cls.y + h };
    case 'east':
      return { x: cls.x + w, y: cy };
    case 'west':
      return { x: cls.x, y: cy };
  }
}

export function nearestPort(
  cls: ClassDefinition,
  targetX: number,
  targetY: number,
  memberCount: number,
): ConnectionPort {
  const ports: ConnectionPort[] = ['north', 'east', 'south', 'west'];
  let best: ConnectionPort = 'east';
  let bestDist = Infinity;
  for (const p of ports) {
    const pos = portPosition(cls, p, memberCount);
    const d = (pos.x - targetX) ** 2 + (pos.y - targetY) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

export function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = Math.abs(x2 - x1) * 0.5;
  const c1x = x1 + (x2 > x1 ? dx : -dx);
  const c2x = x2 + (x2 > x1 ? -dx : dx);
  return `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`;
}

export function pointInFolder(x: number, y: number, folder: FolderDefinition): boolean {
  return (
    x >= folder.x &&
    x <= folder.x + folder.width &&
    y >= folder.y + 32 &&
    y <= folder.y + folder.height
  );
}

export function findInnermostFolder(
  x: number,
  y: number,
  folders: FolderDefinition[],
): FolderDefinition | null {
  const hits = folders.filter((f) => pointInFolder(x, y, f));
  if (hits.length === 0) return null;
  return hits.reduce((a, b) => (a.width * a.height < b.width * b.height ? a : b));
}
