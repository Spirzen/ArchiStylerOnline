import type { AccessModifier, ClassDefinition, MemberDefinition, MemberKind, TargetLanguage } from '../../types/models';
import { newId } from '../../utils/id';

interface Props {
  cls: ClassDefinition;
  language: TargetLanguage;
  onUpdate: (members: MemberDefinition[]) => void;
}

export function MemberEditor({ cls, language, onUpdate }: Props) {
  const members = cls.members;

  const updateMember = (id: string, patch: Partial<MemberDefinition>) => {
    onUpdate(members.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const updateParam = (
    memberId: string,
    paramIndex: number,
    patch: Partial<{ name: string; type: string; defaultValue?: string }>,
  ) => {
    onUpdate(
      members.map((m) => {
        if (m.id !== memberId) return m;
        const params = m.parameters.map((p, i) => (i === paramIndex ? { ...p, ...patch } : p));
        return { ...m, parameters: params };
      }),
    );
  };

  const addParam = (memberId: string) => {
    onUpdate(
      members.map((m) =>
        m.id === memberId
          ? { ...m, parameters: [...m.parameters, { name: 'arg', type: 'object' }] }
          : m,
      ),
    );
  };

  return (
    <>
      <div className="section-title">Члены ({members.length})</div>
      {members.map((m) => (
        <details key={m.id} className="member-block" open={members.length <= 4}>
          <summary className="member-summary">
            <span className="member-kind-badge">{m.kind}</span>
            <strong>{m.name || '—'}</strong>
            <button
              type="button"
              className="btn btn-compact btn-icon"
              title="Удалить"
              onClick={(e) => {
                e.preventDefault();
                onUpdate(members.filter((x) => x.id !== m.id));
              }}
            >
              ×
            </button>
          </summary>
          <div className="member-fields">
            <div className="field-row">
              <label>Тип</label>
              <select
                className="input-control"
                value={m.kind}
                onChange={(e) => updateMember(m.id, { kind: e.target.value as MemberKind })}
              >
                <option value="field">field</option>
                <option value="property">property</option>
                <option value="method">method</option>
                <option value="constructor">constructor</option>
              </select>
            </div>
            <div className="field-row">
              <label>Имя</label>
              <input value={m.name} onChange={(e) => updateMember(m.id, { name: e.target.value })} />
            </div>
            <div className="field-row">
              <label>{m.kind === 'method' ? 'Возврат' : 'Тип'}</label>
              <input
                value={m.kind === 'method' || m.kind === 'constructor' ? m.returnType : m.type}
                onChange={(e) =>
                  updateMember(
                    m.id,
                    m.kind === 'method' || m.kind === 'constructor'
                      ? { returnType: e.target.value }
                      : { type: e.target.value },
                  )
                }
              />
            </div>
            {m.kind === 'field' && (
              <div className="field-row">
                <label>Значение по умолчанию</label>
                <input
                  value={m.defaultValue ?? ''}
                  onChange={(e) => updateMember(m.id, { defaultValue: e.target.value })}
                  placeholder={language === 'python' ? 'None' : 'null'}
                />
              </div>
            )}
            <div className="field-row">
              <label>Доступ</label>
              <select
                className="input-control"
                value={m.access}
                onChange={(e) => updateMember(m.id, { access: e.target.value as AccessModifier })}
              >
                <option value="public">public</option>
                <option value="private">private</option>
                <option value="protected">protected</option>
                {language === 'csharp' && <option value="internal">internal</option>}
              </select>
            </div>
            <div className="member-flags">
              <label>
                <input type="checkbox" checked={!!m.isStatic} onChange={(e) => updateMember(m.id, { isStatic: e.target.checked })} />
                static
              </label>
              <label>
                <input type="checkbox" checked={!!m.isAbstract} onChange={(e) => updateMember(m.id, { isAbstract: e.target.checked })} />
                abstract
              </label>
              {language === 'csharp' && m.kind === 'property' && (
                <label>
                  <input type="checkbox" checked={!!m.isVirtual} onChange={(e) => updateMember(m.id, { isVirtual: e.target.checked })} />
                  virtual
                </label>
              )}
              {(m.kind === 'field' || m.kind === 'property') && (
                <label>
                  <input type="checkbox" checked={!!m.isReadOnly} onChange={(e) => updateMember(m.id, { isReadOnly: e.target.checked })} />
                  {language === 'python' ? 'final' : 'readonly'}
                </label>
              )}
              {(m.kind === 'method' || m.kind === 'constructor') && (
                <label>
                  <input
                    type="checkbox"
                    checked={m.generateStub !== false}
                    onChange={(e) => updateMember(m.id, { generateStub: e.target.checked })}
                  />
                  заглушка
                </label>
              )}
            </div>
            <div className="field-row">
              <label>Описание</label>
              <textarea
                rows={2}
                value={m.description ?? ''}
                onChange={(e) => updateMember(m.id, { description: e.target.value })}
              />
            </div>
            {(m.kind === 'method' || m.kind === 'constructor') && (
              <>
                <div className="section-title" style={{ marginTop: 4 }}>
                  Параметры
                </div>
                {m.parameters.map((p, i) => (
                  <div key={i} className="param-row">
                    <input
                      placeholder="имя"
                      value={p.name}
                      onChange={(e) => updateParam(m.id, i, { name: e.target.value })}
                    />
                    <input
                      placeholder="тип"
                      value={p.type}
                      onChange={(e) => updateParam(m.id, i, { type: e.target.value })}
                    />
                    <input
                      placeholder="default"
                      value={p.defaultValue ?? ''}
                      onChange={(e) => updateParam(m.id, i, { defaultValue: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn-compact"
                      onClick={() =>
                        updateMember(m.id, { parameters: m.parameters.filter((_, j) => j !== i) })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button type="button" className="btn btn-compact" onClick={() => addParam(m.id)}>
                  + параметр
                </button>
              </>
            )}
          </div>
        </details>
      ))}
      <div className="member-actions">
        <button
          type="button"
          className="btn btn-compact"
          onClick={() =>
            onUpdate([
              ...members,
              {
                id: newId(),
                kind: 'method',
                name: 'execute',
                type: '',
                returnType: 'void',
                access: 'public',
                parameters: [],
                generateStub: true,
              },
            ])
          }
        >
          + Метод
        </button>
        <button
          type="button"
          className="btn btn-compact"
          onClick={() =>
            onUpdate([
              ...members,
              {
                id: newId(),
                kind: 'field',
                name: '_value',
                type: language === 'python' ? 'Any' : 'object',
                returnType: '',
                access: 'private',
                parameters: [],
              },
            ])
          }
        >
          + Поле
        </button>
        <button
          type="button"
          className="btn btn-compact"
          onClick={() =>
            onUpdate([
              ...members,
              {
                id: newId(),
                kind: 'property',
                name: 'Value',
                type: language === 'python' ? 'Any' : 'object',
                returnType: '',
                access: 'public',
                parameters: [],
              },
            ])
          }
        >
          + Свойство
        </button>
      </div>
    </>
  );
}
