import { useState } from 'react';
import { importProjectJson } from '../../services/storage';
import { useDiagramStore } from '../../store/diagramStore';

interface Props {
  onClose: () => void;
}

export function ImportModal({ onClose }: Props) {
  const loadProject = useDiagramStore((s) => s.loadProject);
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const handleImport = () => {
    const p = importProjectJson(text);
    if (!p) {
      setError('Неверный или слишком большой JSON');
      return;
    }
    loadProject(p);
    onClose();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.size > 2_000_000) {
      setError('Файл слишком большой (макс. 2 МБ)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? ''));
      setError('');
    };
    reader.readAsText(file);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <h2>Импорт схемы</h2>
        <input type="file" accept=".json,application/json" onChange={handleFile} />
        <textarea
          rows={10}
          style={{ width: '100%', marginTop: 8 }}
          placeholder="Вставьте JSON или выберите файл..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        {error && <p style={{ color: '#f87171' }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button type="button" className="btn btn-primary" onClick={handleImport}>
            Загрузить
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
}
