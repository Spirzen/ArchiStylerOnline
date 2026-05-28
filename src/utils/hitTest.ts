import type { ClassDefinition, ConnectionPort, IntegrationDefinition, ProjectModel } from '../types/models';
import {
  CARD_WIDTH,
  cardHeight,
  INTEGRATION_HEIGHT,
  INTEGRATION_WIDTH,
  nearestIntegrationPort,
  nearestPort,
} from './diagramGeometry';

export type HitNode =
  | { type: 'class'; id: string; cls: ClassDefinition }
  | { type: 'integration'; id: string; integration: IntegrationDefinition };

const DROP_PAD = 16;

function hitClass(cls: ClassDefinition, worldX: number, worldY: number): boolean {
  const h = cardHeight(cls.members.length);
  return (
    worldX >= cls.x - DROP_PAD &&
    worldX <= cls.x + CARD_WIDTH + DROP_PAD &&
    worldY >= cls.y - DROP_PAD &&
    worldY <= cls.y + h + DROP_PAD
  );
}

/** Верхний по z-order элемент (последний в массиве рисуется сверху). */
export function findNodeAt(worldX: number, worldY: number, project: ProjectModel): HitNode | null {
  for (let i = project.classes.length - 1; i >= 0; i--) {
    const cls = project.classes[i];
    if (hitClass(cls, worldX, worldY)) {
      return { type: 'class', id: cls.id, cls };
    }
  }
  for (let i = project.integrations.length - 1; i >= 0; i--) {
    const intg = project.integrations[i];
    if (
      worldX >= intg.x - DROP_PAD &&
      worldX <= intg.x + INTEGRATION_WIDTH + DROP_PAD &&
      worldY >= intg.y - DROP_PAD &&
      worldY <= intg.y + INTEGRATION_HEIGHT + DROP_PAD
    ) {
      return { type: 'integration', id: intg.id, integration: intg };
    }
  }
  return null;
}

export function nearestPortForNode(node: HitNode, worldX: number, worldY: number): ConnectionPort {
  if (node.type === 'class') {
    return nearestPort(node.cls, worldX, worldY, node.cls.members.length);
  }
  return nearestIntegrationPort(node.integration, worldX, worldY);
}

export function nearestPortFromLocal(
  localX: number,
  localY: number,
  memberCount: number,
): ConnectionPort {
  const w = CARD_WIDTH;
  const h = cardHeight(memberCount);
  const cx = w / 2;
  const cy = h / 2;
  const dx = localX - cx;
  const dy = localY - cy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'east' : 'west';
  }
  return dy > 0 ? 'south' : 'north';
}

export function nearestPortFromIntegrationLocal(localX: number, localY: number): ConnectionPort {
  const w = INTEGRATION_WIDTH;
  const h = INTEGRATION_HEIGHT;
  const cx = w / 2;
  const cy = h / 2;
  const dx = localX - cx;
  const dy = localY - cy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'east' : 'west';
  }
  return dy > 0 ? 'south' : 'north';
}
