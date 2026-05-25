import { useDiagramStore } from '../../store/diagramStore';
import type { RelationKind } from '../../types/models';
import { availableRelationKinds, relationLabel } from '../../utils/relationKind';

export function RelationPicker() {
  const picker = useDiagramStore((s) => s.relationPicker);
  const project = useDiagramStore((s) => s.project);
  const confirmRelation = useDiagramStore((s) => s.confirmRelation);
  const cancelLink = useDiagramStore((s) => s.cancelLink);

  if (!picker) return null;
  const from = project.classes.find((c) => c.id === picker.fromId);
  const to = project.classes.find((c) => c.id === picker.toId);
  if (!from || !to) return null;

  const kinds = availableRelationKinds(from, to);

  return (
    <div
      className="relation-picker"
      style={{ left: picker.x, top: picker.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
        {from.name} → {to.name}
      </div>
      {kinds.map((k) => (
        <button key={k} type="button" className="btn btn-compact" onClick={() => confirmRelation(k as RelationKind)}>
          {relationLabel(k, project.language)}
        </button>
      ))}
      <button type="button" className="btn btn-compact" style={{ marginTop: 6 }} onClick={cancelLink}>
        Отмена
      </button>
    </div>
  );
}
