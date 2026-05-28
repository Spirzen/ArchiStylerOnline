import type { IntegrationDefinition, IntegrationKind } from '../../types/models';

const KINDS: { value: IntegrationKind; label: string }[] = [
  { value: 'rest', label: 'REST API' },
  { value: 'grpc', label: 'gRPC' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'messageQueue', label: 'Очередь сообщений' },
  { value: 'database', label: 'База данных' },
  { value: 'cache', label: 'Кэш' },
  { value: 'auth', label: 'Аутентификация' },
  { value: 'storage', label: 'Хранилище' },
  { value: 'custom', label: 'Другое' },
];

interface Props {
  intg: IntegrationDefinition;
  onUpdate: (patch: Partial<IntegrationDefinition>) => void;
}

export function IntegrationInspector({ intg, onUpdate }: Props) {
  return (
    <>
      <div className="field">
        <label>Название сервиса</label>
        <input value={intg.name} onChange={(e) => onUpdate({ name: e.target.value })} />
      </div>
      <div className="field">
        <label>Тип интеграции</label>
        <select
          className="input-control"
          value={intg.kind}
          onChange={(e) => onUpdate({ kind: e.target.value as IntegrationKind })}
        >
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Endpoint / connection string</label>
        <input
          value={intg.endpoint}
          onChange={(e) => onUpdate({ endpoint: e.target.value })}
          placeholder="https://api.example.com/v1"
        />
      </div>
      <div className="field">
        <label>Протокол</label>
        <input
          value={intg.protocol}
          onChange={(e) => onUpdate({ protocol: e.target.value })}
          placeholder="HTTPS, AMQP, TCP…"
        />
      </div>
      <div className="field">
        <label>Аутентификация</label>
        <input
          value={intg.authType}
          onChange={(e) => onUpdate({ authType: e.target.value })}
          placeholder="OAuth2, API Key, mTLS…"
        />
      </div>
      <div className="field">
        <label>Описание</label>
        <textarea
          rows={3}
          value={intg.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
        />
      </div>
      <div className="field">
        <label>Теги (через запятую)</label>
        <input
          value={intg.tags.join(', ')}
          onChange={(e) =>
            onUpdate({
              tags: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </div>
      <p className="pattern-desc">
        Соедините класс с сервисом через cyan-якорь: «Интеграция», «Вызов API» или «Зависит от». При связи можно
        автоматически добавить поле-клиент в класс.
      </p>
    </>
  );
}
