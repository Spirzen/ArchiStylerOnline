import type { FolderDefinition } from '../../types/models';

interface Props {
  folder: FolderDefinition;
  selected: boolean;
  onTitlePointerDown: (e: React.PointerEvent) => void;
}

export function FolderBox({ folder, selected, onTitlePointerDown }: Props) {
  return (
    <g transform={`translate(${folder.x}, ${folder.y})`}>
      <g pointerEvents="none">
        <rect
          width={folder.width}
          height={folder.height}
          rx={10}
          fill="rgba(30, 42, 66, 0.35)"
          stroke={selected ? 'var(--accent-primary)' : 'var(--border-soft)'}
          strokeWidth={selected ? 2 : 1}
          strokeDasharray="4 4"
        />
        <rect width={folder.width} height={28} rx={10} fill="var(--bg-panel)" opacity={0.9} />
        <text x={12} y={19} fill="var(--accent-primary)" fontSize={12}>
          📁 {folder.name}
        </text>
      </g>
      <rect
        width={folder.width}
        height={28}
        rx={10}
        fill="transparent"
        style={{ cursor: 'move' }}
        onPointerDown={onTitlePointerDown}
      />
    </g>
  );
}
