import { memberPreviewLines } from '../../services/codeGenerator';
import { useDiagramStore } from '../../store/diagramStore';
import type { ClassDefinition, ConnectionPort } from '../../types/models';
import { CARD_WIDTH, cardHeight, portPosition } from '../../utils/diagramGeometry';

const PORTS: ConnectionPort[] = ['north', 'east', 'south', 'west'];

interface Props {
  cls: ClassDefinition;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onStartLink: (classId: string, port: ConnectionPort) => void;
}

export function ClassCard({ cls, selected, onPointerDown, onPointerUp, onStartLink }: Props) {
  const language = useDiagramStore((s) => s.project.language);
  const lines = memberPreviewLines(cls, language);
  const h = cardHeight(cls.members.length);
  const subtitle = [
    cls.isInterface ? 'interface' : cls.isAbstract ? 'abstract' : 'class',
    cls.namespace || cls.package,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <g
      className={`class-card ${selected ? 'selected' : ''}`}
      transform={`translate(${cls.x}, ${cls.y})`}
      onPointerUp={onPointerUp}
      style={{ cursor: 'grab' }}
    >
      <rect
        width={CARD_WIDTH}
        height={h}
        rx={10}
        fill="var(--bg-card)"
        stroke={selected ? 'var(--accent-secondary)' : 'var(--border-soft)'}
        strokeWidth={selected ? 2 : 1}
        style={selected ? { filter: 'drop-shadow(0 0 12px rgba(110, 231, 215, 0.35))' } : undefined}
      />
      <g pointerEvents="none">
        <text x={12} y={22} fill="var(--text-primary)" fontWeight={600} fontSize={13}>
          {cls.name}
        </text>
        <text x={12} y={38} fill="var(--text-muted)" fontSize={10}>
          {subtitle}
        </text>
        <line x1={8} y1={48} x2={CARD_WIDTH - 8} y2={48} stroke="var(--border-soft)" />
        {lines.map((line, i) => (
          <text key={i} x={12} y={64 + i * 18} fill="var(--text-muted)" fontSize={10} fontFamily="monospace">
            {line}
          </text>
        ))}
      </g>
      {/* Hit area on top — receives drag/click */}
      <rect
        width={CARD_WIDTH}
        height={h}
        rx={10}
        fill="transparent"
        onPointerDown={onPointerDown}
        style={{ cursor: 'grab' }}
      />
      {PORTS.map((port) => {
        const p = portPosition(cls, port, cls.members.length);
        const lx = p.x - cls.x;
        const ly = p.y - cls.y;
        return (
          <circle
            key={port}
            cx={lx}
            cy={ly}
            r={8}
            fill="var(--accent-primary)"
            stroke="var(--bg-canvas)"
            strokeWidth={2}
            style={{ cursor: 'crosshair' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartLink(cls.id, port);
            }}
          />
        );
      })}
    </g>
  );
}
