import { useDiagramStore } from '../../store/diagramStore';

export function LeftPanel() {
  const patterns = useDiagramStore((s) => s.patterns);
  const selectedPatternId = useDiagramStore((s) => s.selectedPatternId);
  const setSelectedPattern = useDiagramStore((s) => s.setSelectedPattern);
  const applySelectedPattern = useDiagramStore((s) => s.applySelectedPattern);
  const addClass = useDiagramStore((s) => s.addClass);
  const addFolder = useDiagramStore((s) => s.addFolder);
  const deleteSelected = useDiagramStore((s) => s.deleteSelected);
  const project = useDiagramStore((s) => s.project);
  const selectedFolderId = useDiagramStore((s) => s.selectedFolderId);
  const updateFolder = useDiagramStore((s) => s.updateFolder);

  const pattern = patterns.find((p) => p.id === selectedPatternId);

  const folder = project.folders.find((f) => f.id === selectedFolderId);

  return (
    <aside className="panel panel-left">
      <div className="section-title">Элементы</div>
      <button type="button" className="btn btn-primary" onClick={() => addClass()}>
        + Класс
      </button>
      <button type="button" className="btn" onClick={() => addFolder()}>
        + Папка / слой
      </button>
      <button type="button" className="btn" onClick={deleteSelected}>
        Удалить выбранное
      </button>

      <div className="section-title">Паттерны и ООП</div>
      <select
        className="input-control"
        value={selectedPatternId}
        onChange={(e) => setSelectedPattern(e.target.value)}
        aria-label="Выбор паттерна"
      >
        {patterns.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.category})
          </option>
        ))}
      </select>
      {pattern && <p className="pattern-desc">{pattern.description}</p>}
      <button type="button" className="btn btn-primary" onClick={applySelectedPattern} disabled={!selectedPatternId}>
        Добавить на схему
      </button>

      {folder && (
        <>
          <div className="section-title">Папка</div>
          <div className="field">
            <label>Имя</label>
            <input value={folder.name} onChange={(e) => updateFolder(folder.id, { name: e.target.value })} />
          </div>
          <div className="field">
            <label>Сегмент пути</label>
            <input value={folder.segment} onChange={(e) => updateFolder(folder.id, { segment: e.target.value })} />
          </div>
        </>
      )}

      <div className="section-title">Подсказка</div>
      <p className="pattern-desc">
        Тяните от cyan-точки к другому классу для связи. ЛКМ по пустому месту — панорама. Колёсико — масштаб к курсору.
      </p>
    </aside>
  );
}
