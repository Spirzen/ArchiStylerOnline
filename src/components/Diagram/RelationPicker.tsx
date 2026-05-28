import { useEffect, useRef } from 'react';
import { useDiagramStore } from '../../store/diagramStore';
import type { RelationKind } from '../../types/models';
import { availableRelationKinds, relationLabel } from '../../utils/relationKind';

export function RelationPicker() {
  const picker = useDiagramStore((s) => s.relationPicker);
  const project = useDiagramStore((s) => s.project);
  const confirmRelation = useDiagramStore((s) => s.confirmRelation);
  const cancelLink = useDiagramStore((s) => s.cancelLink);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!picker || !ref.current) return;
    const el = ref.current;
    const parent = el.offsetParent as HTMLElement | null;
    const pw = parent?.clientWidth ?? window.innerWidth;
    const ph = parent?.clientHeight ?? window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = picker.x;
    let top = picker.y;
    if (left + w > pw - 8) left = Math.max(8, pw - w - 8);
    if (top + h > ph - 8) top = Math.max(8, ph - h - 8);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [picker]);

  if (!picker) return null;
  const from = picker.fromClassId
    ? project.classes.find((c) => c.id === picker.fromClassId)
    : null;
  const to = picker.toClassId ? project.classes.find((c) => c.id === picker.toClassId) : null;
  const fromIntg = picker.fromIntegrationId
    ? project.integrations.find((i) => i.id === picker.fromIntegrationId)
    : null;
  const toIntg = picker.toIntegrationId
    ? project.integrations.find((i) => i.id === picker.toIntegrationId)
    : null;

  const fromName = from?.name ?? fromIntg?.name;
  const toName = to?.name ?? toIntg?.name;
  if (!fromName || !toName) return null;

  const kinds = availableRelationKinds(from ?? null, to ?? null, fromIntg ?? null, toIntg ?? null);

  return (
    <div
      ref={ref}
      className="relation-picker"
      style={{ left: picker.x, top: picker.y }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
        Связь: {fromName} → {toName}
      </div>
      {kinds.map((k) => (
        <button
          key={k}
          type="button"
          className="btn btn-compact"
          onClick={() => confirmRelation(k as RelationKind)}
        >
          {relationLabel(k, project.language)}
        </button>
      ))}
      <button type="button" className="btn btn-compact" style={{ marginTop: 6 }} onClick={cancelLink}>
        Отмена
      </button>
    </div>
  );
}
