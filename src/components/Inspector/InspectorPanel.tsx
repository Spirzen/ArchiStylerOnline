import { useDiagramStore } from '../../store/diagramStore';
import type { AccessModifier, ClassRole } from '../../types/models';
import { IntegrationInspector } from './IntegrationInspector';
import { MemberEditor } from './MemberEditor';

const ROLES: { value: ClassRole; label: string }[] = [
  { value: 'none', label: '—' },
  { value: 'service', label: 'Service' },
  { value: 'repository', label: 'Repository' },
  { value: 'controller', label: 'Controller' },
  { value: 'model', label: 'Model' },
  { value: 'view', label: 'View' },
  { value: 'viewModel', label: 'ViewModel' },
  { value: 'presenter', label: 'Presenter' },
  { value: 'entity', label: 'Entity' },
  { value: 'dto', label: 'DTO' },
  { value: 'factory', label: 'Factory' },
  { value: 'handler', label: 'Handler' },
];

export function InspectorPanel() {
  const project = useDiagramStore((s) => s.project);
  const selectedClassId = useDiagramStore((s) => s.selectedClassId);
  const selectedClassIds = useDiagramStore((s) => s.selectedClassIds);
  const selectedIntegrationId = useDiagramStore((s) => s.selectedIntegrationId);
  const selectedIntegrationIds = useDiagramStore((s) => s.selectedIntegrationIds);
  const updateClass = useDiagramStore((s) => s.updateClass);
  const updateIntegration = useDiagramStore((s) => s.updateIntegration);
  const rightTab = useDiagramStore((s) => s.rightTab);
  const setRightTab = useDiagramStore((s) => s.setRightTab);
  const codePreview = useDiagramStore((s) => s.codePreview);
  const refreshCode = useDiagramStore((s) => s.refreshCode);

  const cls = project.classes.find((c) => c.id === selectedClassId);
  const intg = project.integrations.find((i) => i.id === selectedIntegrationId);
  const multiCount = selectedClassIds.length + selectedIntegrationIds.length;
  const lang = project.language;

  const nsLabel = lang === 'csharp' ? 'Namespace' : lang === 'java' ? 'Package' : 'Module';

  return (
    <aside className="panel panel-right">
      <div className="tabs">
        <button
          type="button"
          className={`tab ${rightTab === 'class' ? 'active' : ''}`}
          onClick={() => setRightTab('class')}
        >
          Класс
        </button>
        <button
          type="button"
          className={`tab ${rightTab === 'integration' ? 'active' : ''}`}
          onClick={() => setRightTab('integration')}
        >
          Сервис
        </button>
        <button
          type="button"
          className={`tab ${rightTab === 'code' ? 'active' : ''}`}
          onClick={() => setRightTab('code')}
        >
          Код
        </button>
      </div>

      {rightTab === 'code' ? (
        <pre className="code-preview">{codePreview}</pre>
      ) : rightTab === 'integration' ? (
        !intg ? (
          <p className="pattern-desc">
            Выберите внешний сервис на схеме или добавьте «+ Интеграция» слева, чтобы настроить endpoint, протокол и
            зависимости.
          </p>
        ) : (
          <IntegrationInspector intg={intg} onUpdate={(patch) => updateIntegration(intg.id, patch)} />
        )
      ) : multiCount > 1 ? (
        <p className="pattern-desc">
          Выбрано элементов: <strong>{multiCount}</strong>. Перетащите группу целиком, удалите через Del или
          дублируйте через Ctrl+D. Инспектор показывает последний выбранный элемент при одиночном выделении.
        </p>
      ) : !cls ? (
        <p className="pattern-desc">
          Выберите класс на схеме для детальной настройки полей, методов, свойств, наследования и импортов.
        </p>
      ) : (
        <div className="inspector-scroll">
          <div className="field">
            <label>Имя класса</label>
            <input value={cls.name} onChange={(e) => updateClass(cls.id, { name: e.target.value })} />
          </div>
          <div className="field">
            <label>{nsLabel}</label>
            <input
              value={lang === 'csharp' ? cls.namespace : cls.package}
              onChange={(e) =>
                updateClass(
                  cls.id,
                  lang === 'csharp' ? { namespace: e.target.value } : { package: e.target.value },
                )
              }
            />
          </div>
          <div className="field">
            <label>Роль в архитектуре</label>
            <select
              className="input-control"
              value={cls.role}
              onChange={(e) => updateClass(cls.id, { role: e.target.value as ClassRole })}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Базовый тип</label>
            <input value={cls.baseType} onChange={(e) => updateClass(cls.id, { baseType: e.target.value })} />
          </div>
          <div className="field">
            <label>{lang === 'python' ? 'Наследует / mixins' : 'Интерфейсы (через запятую)'}</label>
            <input
              value={cls.implementedInterfaces.join(', ')}
              onChange={(e) =>
                updateClass(cls.id, {
                  implementedInterfaces: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
            />
          </div>
          <div className="field">
            <label>{lang === 'csharp' ? 'using' : lang === 'java' ? 'import' : 'from … import'}</label>
            <input
              value={cls.usings.join(', ')}
              onChange={(e) =>
                updateClass(cls.id, {
                  usings: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="typing, abc, requests"
            />
          </div>
          <div className="field">
            <label>Описание / docstring</label>
            <textarea
              rows={2}
              value={cls.summary}
              onChange={(e) => updateClass(cls.id, { summary: e.target.value })}
            />
          </div>
          <div className="field flags-row">
            <label>
              <input type="checkbox" checked={cls.isInterface} onChange={(e) => updateClass(cls.id, { isInterface: e.target.checked })} />
              interface
            </label>
            <label>
              <input type="checkbox" checked={cls.isAbstract} onChange={(e) => updateClass(cls.id, { isAbstract: e.target.checked })} />
              abstract
            </label>
            <label>
              <input type="checkbox" checked={cls.isEnum} onChange={(e) => updateClass(cls.id, { isEnum: e.target.checked })} />
              enum
            </label>
            {lang === 'csharp' && (
              <>
                <label>
                  <input type="checkbox" checked={cls.isSealed} onChange={(e) => updateClass(cls.id, { isSealed: e.target.checked })} />
                  sealed
                </label>
                <label>
                  <input type="checkbox" checked={cls.isRecord} onChange={(e) => updateClass(cls.id, { isRecord: e.target.checked })} />
                  record
                </label>
              </>
            )}
          </div>
          <div className="field">
            <label>Доступ класса</label>
            <select
              className="input-control"
              value={cls.access}
              onChange={(e) => updateClass(cls.id, { access: e.target.value as AccessModifier })}
            >
              <option value="public">public</option>
              <option value="private">private</option>
              <option value="protected">protected</option>
              {lang === 'csharp' && <option value="internal">internal</option>}
            </select>
          </div>
          <MemberEditor
            cls={cls}
            language={lang}
            onUpdate={(members) => updateClass(cls.id, { members })}
          />
          <button type="button" className="btn btn-compact" onClick={refreshCode} style={{ marginTop: 8 }}>
            Обновить превью кода
          </button>
        </div>
      )}
    </aside>
  );
}
