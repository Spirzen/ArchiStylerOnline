import type { ConnectionPort, IntegrationDefinition } from '../../types/models';
import { INTEGRATION_HEIGHT, INTEGRATION_WIDTH, integrationPortPosition } from '../../utils/diagramGeometry';

const PORTS: ConnectionPort[] = ['north', 'east', 'south', 'west'];

const KIND_LABELS: Record<string, string> = {
  rest: 'REST API',
  grpc: 'gRPC',
  graphql: 'GraphQL',
  messageQueue: 'Очередь',
  database: 'БД',
  cache: 'Кэш',
  auth: 'Auth',
  storage: 'Storage',
  custom: 'Сервис',
};

interface Props {
  integration: IntegrationDefinition;
  selected: boolean;
  linkTarget: boolean;
  onBodyPointerDown: (e: React.PointerEvent) => void;
  onPortPointerDown: (e: React.PointerEvent, port: ConnectionPort) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export function IntegrationCard({
  integration,
  selected,
  linkTarget,
  onBodyPointerDown,
  onPortPointerDown,
  onContextMenu,
}: Props) {
  const w = INTEGRATION_WIDTH;
  const h = INTEGRATION_HEIGHT;
  const kindLabel = KIND_LABELS[integration.kind] ?? integration.kind;

  return (
    <g
      className={`integration-card ${selected ? 'is-selected' : ''} ${linkTarget ? 'is-link-target' : ''}`}
      transform={`translate(${integration.x}, ${integration.y})`}
      onContextMenu={onContextMenu}
    >
      {selected && (
        <rect
          className="selection-halo"
          x={-4}
          y={-4}
          width={w + 8}
          height={h + 8}
          rx={12}
          fill="none"
          stroke="var(--accent-tertiary)"
          strokeWidth={2}
          strokeDasharray="6 3"
          pointerEvents="none"
        />
      )}
      {linkTarget && (
        <rect
          x={-6}
          y={-6}
          width={w + 12}
          height={h + 12}
          rx={14}
          fill="rgba(180, 167, 248, 0.15)"
          stroke="var(--accent-tertiary)"
          strokeWidth={2}
          pointerEvents="none"
        />
      )}
      <rect
        className="integration-card-body"
        width={w}
        height={h}
        rx={10}
        fill="var(--bg-integration)"
        stroke={selected ? 'var(--accent-tertiary)' : 'var(--border-soft)'}
        strokeWidth={selected ? 2.5 : 1}
        strokeDasharray="4 2"
      />
      {selected && (
        <g pointerEvents="none">
          <circle cx={w - 10} cy={10} r={8} fill="var(--accent-tertiary)" />
          <text x={w - 10} y={14} textAnchor="middle" fill="var(--bg-deep)" fontSize={11} fontWeight={700}>
            ✓
          </text>
        </g>
      )}
      <g pointerEvents="none">
        <text x={12} y={22} fill="var(--accent-tertiary)" fontWeight={600} fontSize={11}>
          {kindLabel}
        </text>
        <text x={12} y={40} fill="var(--text-primary)" fontWeight={600} fontSize={13}>
          {integration.name}
        </text>
        {integration.endpoint && (
          <text x={12} y={56} fill="var(--text-muted)" fontSize={9} fontFamily="monospace">
            {integration.endpoint.length > 28
              ? `${integration.endpoint.slice(0, 26)}…`
              : integration.endpoint}
          </text>
        )}
      </g>
      <rect
        width={w}
        height={h}
        rx={10}
        fill="transparent"
        className="class-card-hit"
        onPointerDown={onBodyPointerDown}
      />
      {PORTS.map((port) => {
        const p = integrationPortPosition(integration, port);
        const lx = p.x - integration.x;
        const ly = p.y - integration.y;
        return (
          <g key={port} className="link-port" onPointerDown={(e) => onPortPointerDown(e, port)}>
            <circle className="link-port-hit" cx={lx} cy={ly} r={16} fill="transparent" />
            <circle className="link-port-dot link-port-dot--service" cx={lx} cy={ly} r={6} />
          </g>
        );
      })}
    </g>
  );
}
