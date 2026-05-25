import { useDiagramStore } from '../../store/diagramStore';
import type { AccessModifier, MemberKind } from '../../types/models';
import { newId } from '../../utils/id';

export function InspectorPanel() {
  const project = useDiagramStore((s) => s.project);
  const selectedClassId = useDiagramStore((s) => s.selectedClassId);
  const updateClass = useDiagramStore((s) => s.updateClass);
  const rightTab = useDiagramStore((s) => s.rightTab);
  const setRightTab = useDiagramStore((s) => s.setRightTab);
  const codePreview = useDiagramStore((s) => s.codePreview);
  const refreshCode = useDiagramStore((s) => s.refreshCode);

  const cls = project.classes.find((c) => c.id === selectedClassId);

  return (
    <aside className="panel panel-right">
      <div className="tabs">
        <button type="button" className={`tab ${rightTab === 'class' ? 'active' : ''}`} onClick={() => setRightTab('class')}>
          Класс
        </button>
        <button type="button" className={`tab ${rightTab === 'code' ? 'active' : ''}`} onClick={() => setRightTab('code')}>
          Код
        </button>
      </div>

      {rightTab === 'code' ? (
        <pre className="code-preview">{codePreview}</pre>
      ) : !cls ? (
        <p className="pattern-desc">Выберите класс на схеме, чтобы редактировать поля, наследование и члены.</p>
      ) : (
        <>
          <div className="field">
            <label>Имя класса</label>
            <input value={cls.name} onChange={(e) => updateClass(cls.id, { name: e.target.value })} />
          </div>
          <div className="field">
            <label>Базовый тип</label>
            <input value={cls.baseType} onChange={(e) => updateClass(cls.id, { baseType: e.target.value })} />
          </div>
          <div className="field">
            <label>Интерфейсы (через запятую)</label>
            <input
              value={cls.implementedInterfaces.join(', ')}
              onChange={(e) =>
                updateClass(cls.id, {
                  implementedInterfaces: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          </div>
          <div className="field" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <label>
              <input type="checkbox" checked={cls.isInterface} onChange={(e) => updateClass(cls.id, { isInterface: e.target.checked })} /> interface
            </label>
            <label>
              <input type="checkbox" checked={cls.isAbstract} onChange={(e) => updateClass(cls.id, { isAbstract: e.target.checked })} /> abstract
            </label>
            <label>
              <input type="checkbox" checked={cls.isEnum} onChange={(e) => updateClass(cls.id, { isEnum: e.target.checked })} /> enum
            </label>
          </div>
          <div className="section-title">Члены</div>
          {cls.members.map((m) => (
            <div key={m.id} className="field" style={{ borderBottom: '1px solid var(--border-soft)', paddingBottom: 6 }}>
              <select
                className="input-control"
                value={m.kind}
                onChange={(e) => {
                  const members = cls.members.map((x) =>
                    x.id === m.id ? { ...x, kind: e.target.value as MemberKind } : x,
                  );
                  updateClass(cls.id, { members });
                }}
              >
                <option value="field">field</option>
                <option value="property">property</option>
                <option value="method">method</option>
                <option value="constructor">constructor</option>
              </select>
              <input
                placeholder="имя"
                value={m.name}
                onChange={(e) => {
                  const members = cls.members.map((x) => (x.id === m.id ? { ...x, name: e.target.value } : x));
                  updateClass(cls.id, { members });
                }}
              />
              <input
                placeholder="тип / return"
                value={m.kind === 'method' ? m.returnType : m.type}
                onChange={(e) => {
                  const members = cls.members.map((x) =>
                    x.id === m.id
                      ? m.kind === 'method'
                        ? { ...x, returnType: e.target.value }
                        : { ...x, type: e.target.value }
                      : x,
                  );
                  updateClass(cls.id, { members });
                }}
              />
              <select
                className="input-control"
                value={m.access}
                onChange={(e) => {
                  const members = cls.members.map((x) =>
                    x.id === m.id ? { ...x, access: e.target.value as AccessModifier } : x,
                  );
                  updateClass(cls.id, { members });
                }}
              >
                <option value="public">public</option>
                <option value="private">private</option>
                <option value="protected">protected</option>
              </select>
              <button
                type="button"
                className="btn btn-compact"
                onClick={() => updateClass(cls.id, { members: cls.members.filter((x) => x.id !== m.id) })}
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-compact"
            onClick={() =>
              updateClass(cls.id, {
                members: [
                  ...cls.members,
                  {
                    id: newId(),
                    kind: 'method',
                    name: 'DoWork',
                    type: '',
                    returnType: 'void',
                    access: 'public',
                    parameters: [],
                    generateStub: true,
                  },
                ],
              })
            }
          >
            + Член
          </button>
          <button type="button" className="btn btn-compact" onClick={refreshCode} style={{ marginTop: 8 }}>
            Обновить превью кода
          </button>
        </>
      )}
    </aside>
  );
}
