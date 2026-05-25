import { relationLabel, relationStyle } from '../../utils/relationKind';
import { useDiagramStore } from '../../store/diagramStore';
import type { ClassDefinition, RelationDefinition } from '../../types/models';
import { bezierPath, nearestPort, portPosition } from '../../utils/diagramGeometry';

interface Props {
  classes: ClassDefinition[];
  relations: RelationDefinition[];
  implicit?: boolean;
}

function getEndpoints(
  from: ClassDefinition,
  to: ClassDefinition,
  rel?: RelationDefinition,
): { x1: number; y1: number; x2: number; y2: number } {
  const p1 = rel?.fromPort
    ? portPosition(from, rel.fromPort, from.members.length)
    : portPosition(from, nearestPort(from, to.x, to.y, from.members.length), from.members.length);
  const p2 = rel?.toPort
    ? portPosition(to, rel.toPort, to.members.length)
    : portPosition(to, nearestPort(to, from.x, from.y, to.members.length), to.members.length);
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
}

export function RelationLayer({ classes, relations, implicit }: Props) {
  const language = useDiagramStore((s) => s.project.language);
  const selectedRelationId = useDiagramStore((s) => s.selectedRelationId);
  const selectRelation = useDiagramStore((s) => s.selectRelation);
  const removeRelation = useDiagramStore((s) => s.removeRelation);

  const classMap = new Map(classes.map((c) => [c.id, c]));
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
    <g className="relations" pointerEvents={implicit ? 'none' : 'auto'}>
      <defs>
        <marker id="arrow-filled" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <path d="M0,0 L10,3 L0,6 Z" fill="context-stroke" />
        </marker>
        <marker id="arrow-open" markerWidth="12" markerHeight="12" refX="10" refY="4" orient="auto">
          <path d="M0,0 L12,4 L0,8 Z" fill="none" stroke="context-stroke" strokeWidth="1.5" />
        </marker>
      </defs>
      {items.map(({ rel }) => {
        const from = classMap.get(rel.fromClassId);
        const to = classMap.get(rel.toClassId);
        if (!from || !to) return null;
        const { x1, y1, x2, y2 } = getEndpoints(from, to, rel);
        const style = relationStyle(rel.kind);
        const selected = selectedRelationId === rel.id;
        const path = bezierPath(x1, y1, x2, y2);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const implicitRel = rel.id.startsWith('implicit-');
        return (
          <g key={rel.id} pointerEvents={implicitRel ? 'none' : 'auto'}>
            {!implicitRel && (
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={14}
                style={{ cursor: 'pointer' }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  selectRelation(rel.id);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  removeRelation(rel.id);
                }}
              />
            )}
            <path
              d={path}
              fill="none"
              stroke={style.stroke}
              strokeWidth={selected ? 3.5 : 2.5}
              strokeDasharray={style.dash || undefined}
              markerEnd={style.marker === 'inherit' ? 'url(#arrow-open)' : 'url(#arrow-filled)'}
              opacity={implicitRel ? 0.65 : 1}
              pointerEvents="none"
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
