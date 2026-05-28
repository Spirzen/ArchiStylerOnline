import { relationLabel, relationStyle } from '../../utils/relationKind';
import { useDiagramStore } from '../../store/diagramStore';
import type { ClassDefinition, IntegrationDefinition, RelationDefinition } from '../../types/models';
import {
  bezierPath,
  CARD_WIDTH,
  cardHeight,
  INTEGRATION_HEIGHT,
  INTEGRATION_WIDTH,
  integrationPortPosition,
  nearestIntegrationPort,
  nearestPort,
  portPosition,
} from '../../utils/diagramGeometry';

interface Props {
  classes: ClassDefinition[];
  integrations: IntegrationDefinition[];
  relations: RelationDefinition[];
  implicit?: boolean;
}

type Endpoint = { x: number; y: number };

function classEndpoint(
  cls: ClassDefinition,
  port: RelationDefinition['fromPort'] | undefined,
  toward: Endpoint,
): Endpoint {
  const p = port ?? nearestPort(cls, toward.x, toward.y, cls.members.length);
  return portPosition(cls, p, cls.members.length);
}

function integrationEndpoint(
  intg: IntegrationDefinition,
  port: RelationDefinition['fromPort'] | undefined,
  toward: Endpoint,
): Endpoint {
  const p = port ?? nearestIntegrationPort(intg, toward.x, toward.y);
  return integrationPortPosition(intg, p);
}

function resolveEndpoints(
  rel: RelationDefinition,
  classes: ClassDefinition[],
  integrations: IntegrationDefinition[],
): { x1: number; y1: number; x2: number; y2: number } | null {
  const fromCls = rel.fromClassId ? classes.find((c) => c.id === rel.fromClassId) : undefined;
  const toCls = rel.toClassId ? classes.find((c) => c.id === rel.toClassId) : undefined;
  const fromIntg = rel.fromIntegrationId
    ? integrations.find((i) => i.id === rel.fromIntegrationId)
    : undefined;
  const toIntg = rel.toIntegrationId
    ? integrations.find((i) => i.id === rel.toIntegrationId)
    : undefined;

  const toCenter = (): Endpoint => {
    if (toCls) return { x: toCls.x + CARD_WIDTH / 2, y: toCls.y + cardHeight(toCls.members.length) / 2 };
    if (toIntg) return { x: toIntg.x + INTEGRATION_WIDTH / 2, y: toIntg.y + INTEGRATION_HEIGHT / 2 };
    return { x: 0, y: 0 };
  };
  const fromCenter = (): Endpoint => {
    if (fromCls) return { x: fromCls.x + CARD_WIDTH / 2, y: fromCls.y + cardHeight(fromCls.members.length) / 2 };
    if (fromIntg) return { x: fromIntg.x + INTEGRATION_WIDTH / 2, y: fromIntg.y + INTEGRATION_HEIGHT / 2 };
    return { x: 0, y: 0 };
  };

  const tc = toCenter();
  const fc = fromCenter();

  let p1: Endpoint | null = null;
  let p2: Endpoint | null = null;

  if (fromCls) p1 = classEndpoint(fromCls, rel.fromPort, tc);
  else if (fromIntg) p1 = integrationEndpoint(fromIntg, rel.fromPort, tc);

  if (toCls) p2 = classEndpoint(toCls, rel.toPort, fc);
  else if (toIntg) p2 = integrationEndpoint(toIntg, rel.toPort, fc);

  if (!p1 || !p2) return null;
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

export function RelationLayer({ classes, integrations, relations, implicit }: Props) {
  const language = useDiagramStore((s) => s.project.language);
  const selectedRelationId = useDiagramStore((s) => s.selectedRelationId);
  const selectRelation = useDiagramStore((s) => s.selectRelation);
  const openContextMenu = useDiagramStore((s) => s.openContextMenu);

  const items: { rel: RelationDefinition }[] = [...relations.map((r) => ({ rel: r }))];

  if (implicit) {
    for (const cls of classes) {
      if (cls.baseType) {
        const target = classes.find((c) => c.name === cls.baseType);
        if (
          target &&
          !relations.some(
            (r) => r.fromClassId === cls.id && r.toClassId === target.id && r.kind === 'inherits',
          )
        ) {
          items.push({
            rel: {
              id: `implicit-inherit-${cls.id}`,
              fromClassId: cls.id,
              toClassId: target.id,
              kind: 'inherits',
            },
          });
        }
      }
      for (const iface of cls.implementedInterfaces) {
        const target = classes.find((c) => c.name === iface);
        if (
          target &&
          !relations.some(
            (r) => r.fromClassId === cls.id && r.toClassId === target.id && r.kind === 'implements',
          )
        ) {
          items.push({
            rel: {
              id: `implicit-impl-${cls.id}-${iface}`,
              fromClassId: cls.id,
              toClassId: target.id,
              kind: 'implements',
            },
          });
        }
      }
    }
  }

  return (
    <g className="relations">
      {items.map(({ rel }) => {
        const endpoints = resolveEndpoints(rel, classes, integrations);
        if (!endpoints) return null;
        const { x1, y1, x2, y2 } = endpoints;
        const style = relationStyle(rel.kind);
        const selected = selectedRelationId === rel.id;
        const path = bezierPath(x1, y1, x2, y2);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const implicitRel = rel.id.startsWith('implicit-');
        const sw = selected ? 3.5 : 2.5;
        return (
          <g key={rel.id}>
            {!implicitRel && (
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={16}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  selectRelation(rel.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  selectRelation(rel.id);
                  openContextMenu({
                    screenX: e.clientX,
                    screenY: e.clientY,
                    worldX: mx,
                    worldY: my,
                    target: 'relation',
                    targetId: rel.id,
                  });
                }}
              />
            )}
            <path
              d={path}
              fill="none"
              stroke={style.stroke}
              strokeWidth={sw}
              strokeDasharray={style.dash || undefined}
              markerEnd={style.marker === 'inherit' ? 'url(#arrow-open)' : 'url(#arrow-filled)'}
              opacity={implicitRel ? 0.7 : 1}
              pointerEvents="none"
              style={{ stroke: style.stroke, color: style.stroke }}
            />
            <text
              x={mx}
              y={my - 6}
              textAnchor="middle"
              fill="var(--text-muted)"
              fontSize={10}
              pointerEvents="none"
            >
              {relationLabel(rel.kind, language, rel)}
            </text>
          </g>
        );
      })}
    </g>
  );
}
