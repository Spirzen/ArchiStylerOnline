import { memberPreviewLines } from '../../services/codeGenerator';
import { useDiagramStore } from '../../store/diagramStore';
import type { ClassDefinition, ConnectionPort } from '../../types/models';
import { CARD_WIDTH, cardHeight, portPosition } from '../../utils/diagramGeometry';

const PORTS: ConnectionPort[] = ['north', 'east', 'south', 'west'];

interface Props {
  cls: ClassDefinition;
  selected: boolean;
  linkTarget: boolean;
  onBodyPointerDown: (e: React.PointerEvent) => void;
  onPortPointerDown: (e: React.PointerEvent, port: ConnectionPort) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function ClassCard({
  cls,
  selected,
  linkTarget,
  onBodyPointerDown,
  onPortPointerDown,
  onContextMenu,
}: Props) {
  const language = useDiagramStore((s) => s.project.language);
  const lines = memberPreviewLines(cls, language);
  const h = cardHeight(cls.members.length);
  const mod = language === 'csharp' ? cls.namespace : cls.package;
  const subtitle = [
    cls.isInterface ? 'interface' : cls.isAbstract ? 'abstract' : cls.isEnum ? 'enum' : 'class',
    mod,
    cls.role !== 'none' ? cls.role : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <g
      className={`class-card ${selected ? 'is-selected' : ''} ${linkTarget ? 'is-link-target' : ''}`}
      transform={`translate(${cls.x}, ${cls.y})`}
      onContextMenu={onContextMenu}
    >
      {selected && (
        <rect
          className="selection-halo"
          x={-4}
          y={-4}
          width={CARD_WIDTH + 8}
          height={h + 8}
          rx={12}
          fill="none"
          stroke="var(--accent-secondary)"
          strokeWidth={2}
          strokeDasharray="6 3"
          pointerEvents="none"
        />
      )}
      {linkTarget && (
        <rect
          x={-6}
          y={-6}
          width={CARD_WIDTH + 12}
          height={h + 12}
          rx={14}
          fill="rgba(110, 231, 215, 0.12)"
          stroke="var(--accent-primary)"
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
      <rect
        className="class-card-body"
        width={CARD_WIDTH}
        height={h}
        rx={10}
        fill="var(--bg-card)"
        stroke={selected ? 'var(--accent-secondary)' : 'var(--border-soft)'}
        strokeWidth={selected ? 2.5 : 1}
      />
      {selected && (
        <g pointerEvents="none">
          <circle cx={CARD_WIDTH - 10} cy={10} r={8} fill="var(--accent-secondary)" />
          <text x={CARD_WIDTH - 10} y={14} textAnchor="middle" fill="var(--bg-deep)" fontSize={11} fontWeight={700}>
            ✓
          </text>
        </g>
      )}
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
      <rect
        width={CARD_WIDTH}
        height={h}
        rx={10}
        fill="transparent"
        className="class-card-hit"
        onPointerDown={onBodyPointerDown}
      />
      {PORTS.map((port) => {
        const p = portPosition(cls, port, cls.members.length);
        const lx = p.x - cls.x;
        const ly = p.y - cls.y;
        return (
          <g key={port} className="link-port" onPointerDown={(e) => onPortPointerDown(e, port)}>
            <circle className="link-port-hit" cx={lx} cy={ly} r={16} fill="transparent" />
            <circle className="link-port-dot" cx={lx} cy={ly} r={6} />
            <title>Потяните к другому элементу</title>
          </g>
        );
      })}
    </g>
  );
}
