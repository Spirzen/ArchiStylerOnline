import { useEffect } from 'react';
import { useStore } from 'zustand';
import { DiagramCanvas } from './components/Diagram/DiagramCanvas';
import { ExportMenu } from './components/ExportMenu';
import { InspectorPanel } from './components/Inspector/InspectorPanel';
import { HelpModal } from './components/modals/HelpModal';
import { ImportModal } from './components/modals/ImportModal';
import { LeftPanel } from './components/Toolbar/LeftPanel';
import { loadPatterns } from './services/templateService';
import { useDiagramStore } from './store/diagramStore';

const base = import.meta.env.BASE_URL;

export default function App() {
  const theme = useDiagramStore((s) => s.theme);
  const setTheme = useDiagramStore((s) => s.setTheme);
  const init = useDiagramStore((s) => s.init);
  const hydrate = useDiagramStore((s) => s.hydrate);
  const statusMessage = useDiagramStore((s) => s.statusMessage);
  const project = useDiagramStore((s) => s.project);
  const setProjectName = useDiagramStore((s) => s.setProjectName);
  const setLanguage = useDiagramStore((s) => s.setLanguage);
  const newDiagram = useDiagramStore((s) => s.newDiagram);
  const showHelp = useDiagramStore((s) => s.showHelp);
  const showImport = useDiagramStore((s) => s.showImport);
  const setShowHelp = useDiagramStore((s) => s.setShowHelp);
  const setShowImport = useDiagramStore((s) => s.setShowImport);
  const deleteSelected = useDiagramStore((s) => s.deleteSelected);
  const undo = useDiagramStore((s) => s.undo);
  const redo = useDiagramStore((s) => s.redo);
  const duplicateSelected = useDiagramStore((s) => s.duplicateSelected);
  const selectAllNodes = useDiagramStore((s) => s.selectAllNodes);

  const canUndo = useStore(useDiagramStore.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useDiagramStore.temporal, (s) => s.futureStates.length > 0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    loadPatterns(base).then(init);
    void hydrate();
  }, [base, hydrate, init, theme]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        selectAllNodes();
        return;
      }
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }
      if (mod && ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (e.key === 'Delete') deleteSelected();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canUndo, canRedo, undo, redo, duplicateSelected, deleteSelected, selectAllNodes]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>ArchiStyler Online</h1>
        <span className="tagline">ООП · паттерны · архитектура</span>
        <input
          className="input-control"
          style={{ maxWidth: 160 }}
          value={project.name}
          onChange={(e) => setProjectName(e.target.value)}
          aria-label="Имя схемы"
        />
        <select
          className="input-control"
          value={project.language}
          onChange={(e) => setLanguage(e.target.value as 'csharp' | 'java' | 'python')}
          aria-label="Язык кода"
        >
          <option value="csharp">C#</option>
          <option value="java">Java</option>
          <option value="python">Python</option>
        </select>
        <button type="button" className="btn btn-compact" onClick={undo} disabled={!canUndo} title="Отменить (Ctrl+Z)">
          ↶
        </button>
        <button type="button" className="btn btn-compact" onClick={redo} disabled={!canRedo} title="Повторить (Ctrl+Y)">
          ↷
        </button>
        <button type="button" className="btn btn-compact" onClick={() => setShowImport(true)}>
          Импорт
        </button>
        <ExportMenu />
        <button type="button" className="btn btn-compact" onClick={newDiagram}>
          Новая схема
        </button>
        <button type="button" className="btn btn-compact" onClick={() => setShowHelp(true)}>
          Справка
        </button>
        <a
          href="https://spirzen.ru"
          className="btn btn-compact"
          target="_blank"
          rel="noopener noreferrer"
        >
          Вселенная IT
        </a>
        <button
          type="button"
          className="btn btn-compact"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Переключить тему"
        >
          {theme === 'dark' ? '☀' : '🌙'}
        </button>
      </header>

      <div className="app-main">
        <LeftPanel />
        <DiagramCanvas />
        <InspectorPanel />
      </div>

      <footer className="status-bar">{statusMessage}</footer>

      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
