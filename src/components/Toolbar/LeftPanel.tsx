import { useDiagramStore } from '../../store/diagramStore';
import type { IntegrationKind } from '../../types/models';
import { cardHeight, CARD_WIDTH, INTEGRATION_HEIGHT, INTEGRATION_WIDTH } from '../../utils/diagramGeometry';

export function LeftPanel() {
  const patterns = useDiagramStore((s) => s.patterns);
  const selectedPatternId = useDiagramStore((s) => s.selectedPatternId);
  const setSelectedPattern = useDiagramStore((s) => s.setSelectedPattern);
  const applySelectedPattern = useDiagramStore((s) => s.applySelectedPattern);
  const addClass = useDiagramStore((s) => s.addClass);
  const addFolder = useDiagramStore((s) => s.addFolder);
  const addIntegration = useDiagramStore((s) => s.addIntegration);
  const deleteSelected = useDiagramStore((s) => s.deleteSelected);
  const project = useDiagramStore((s) => s.project);
  const selectedFolderId = useDiagramStore((s) => s.selectedFolderId);
  const updateFolder = useDiagramStore((s) => s.updateFolder);
  const selectClass = useDiagramStore((s) => s.selectClass);
  const selectIntegration = useDiagramStore((s) => s.selectIntegration);
  const centerOn = useDiagramStore((s) => s.centerOn);
  const snapEnabled = useDiagramStore((s) => s.snapEnabled);
  const setSnapEnabled = useDiagramStore((s) => s.setSnapEnabled);
  const smartGuidesEnabled = useDiagramStore((s) => s.smartGuidesEnabled);
  const setSmartGuidesEnabled = useDiagramStore((s) => s.setSmartGuidesEnabled);

  const pattern = patterns.find((p) => p.id === selectedPatternId);
  const folder = project.folders.find((f) => f.id === selectedFolderId);

  const navigateToClass = (id: string) => {
    const cls = project.classes.find((c) => c.id === id);
    if (!cls) return;
    selectClass(id);
    centerOn(cls.x, cls.y, CARD_WIDTH, cardHeight(cls.members.length));
  };

  const navigateToIntegration = (id: string) => {
    const intg = project.integrations.find((i) => i.id === id);
    if (!intg) return;
    selectIntegration(id);
    centerOn(intg.x, intg.y, INTEGRATION_WIDTH, INTEGRATION_HEIGHT);
  };

  return (
    <aside className="panel panel-left">
      <div className="section-title">Элементы</div>
      <button type="button" className="btn btn-primary" onClick={() => addClass()}>
        + Класс
      </button>
      <button type="button" className="btn" onClick={() => addIntegration('rest')}>
        + Интеграция
      </button>
      <button type="button" className="btn" onClick={() => addFolder()}>
        + Папка / слой
      </button>
      <button type="button" className="btn" onClick={deleteSelected}>
        Удалить (Del)
      </button>
      <label className="snap-toggle">
        <input type="checkbox" checked={snapEnabled} onChange={(e) => setSnapEnabled(e.target.checked)} />
        Привязка к сетке 20px
      </label>
      <label className="snap-toggle">
        <input
          type="checkbox"
          checked={smartGuidesEnabled}
          onChange={(e) => setSmartGuidesEnabled(e.target.checked)}
        />
        Умные направляющие
      </label>

      {(project.classes.length > 0 || project.integrations.length > 0) && (
        <>
          <div className="section-title">Навигатор</div>
          <ul className="nav-list">
            {project.classes.map((c) => (
              <li key={c.id}>
                <button type="button" className="nav-item" onClick={() => navigateToClass(c.id)}>
                  <span className="nav-icon class">C</span>
                  {c.name}
                </button>
              </li>
            ))}
            {project.integrations.map((i) => (
              <li key={i.id}>
                <button type="button" className="nav-item" onClick={() => navigateToIntegration(i.id)}>
                  <span className="nav-icon service">S</span>
                  {i.name}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

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

      <div className="section-title">Быстрые интеграции</div>
      <div className="btn-row">
        {(['rest', 'database', 'messageQueue', 'auth'] as IntegrationKind[]).map((k) => (
          <button key={k} type="button" className="btn btn-compact" onClick={() => addIntegration(k)}>
            + {k}
          </button>
        ))}
      </div>

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
        <strong>Выделение:</strong> рамка на холсте, Ctrl+клик, Ctrl+A. <strong>Связь:</strong> точка на краю или Shift+клик
        по карточке. <strong>Ctrl+C / Ctrl+V</strong> — копировать/вставить. ПКМ — меню.
      </p>
    </aside>
  );
}
