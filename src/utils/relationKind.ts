import type {
  ClassDefinition,
  IntegrationDefinition,
  RelationDefinition,
  RelationKind,
  TargetLanguage,
} from '../types/models';
import { newId } from './id';

const LABELS: Record<RelationKind, string> = {
  inherits: 'Наследование',
  implements: 'Реализация',
  uses: 'Зависимость',
  aggregates: 'Агрегация',
  composes: 'Композиция',
  fieldReference: 'Поле',
  methodReference: 'Метод',
  usingImport: 'import',
  dependsOn: 'Зависит от',
  integrates: 'Интеграция',
  callsApi: 'Вызов API',
  publishes: 'Публикует',
  subscribes: 'Подписка',
};

export function relationLabel(
  kind: RelationKind,
  lang: TargetLanguage,
  rel?: RelationDefinition,
): string {
  const base = kind === 'usingImport' && lang === 'csharp' ? 'using' : LABELS[kind];
  if (rel?.label) return rel.label;
  if (rel?.memberName && (kind === 'fieldReference' || kind === 'methodReference')) {
    return `${base}: ${rel.memberName}`;
  }
  return base;
}

export function availableRelationKinds(
  from: ClassDefinition | null,
  to: ClassDefinition | null,
  fromIntg: IntegrationDefinition | null,
  toIntg: IntegrationDefinition | null,
): RelationKind[] {
  if (fromIntg && toIntg) {
    return ['dependsOn', 'publishes', 'subscribes'];
  }
  if (from && toIntg) {
    return ['integrates', 'callsApi', 'dependsOn', 'uses', 'publishes', 'subscribes'];
  }
  if (fromIntg && to) {
    return ['integrates', 'callsApi', 'dependsOn'];
  }
  if (!from || !to) return ['uses'];
  const list: RelationKind[] = [
    'uses',
    'aggregates',
    'composes',
    'fieldReference',
    'methodReference',
    'usingImport',
    'dependsOn',
  ];
  if (to.isInterface && !from.isInterface && !from.isEnum) {
    list.unshift('implements');
  }
  if (!from.isInterface && !from.isEnum && !to.isInterface && !to.isEnum) {
    list.unshift('inherits');
  }
  return list;
}

export function applyRelationToModel(
  rel: RelationDefinition,
  from: ClassDefinition | undefined,
  to: ClassDefinition | undefined,
  lang: TargetLanguage,
): void {
  if (!from) return;
  switch (rel.kind) {
    case 'inherits':
      if (to) from.baseType = to.name;
      break;
    case 'implements':
      if (to && !from.implementedInterfaces.includes(to.name)) {
        from.implementedInterfaces.push(to.name);
      }
      break;
    case 'usingImport': {
      if (!to) break;
      const imp = lang === 'csharp' ? (to.namespace || to.name) : (to.package || to.name);
      if (imp && !from.usings.includes(imp)) from.usings.push(imp);
      break;
    }
    case 'fieldReference':
      if (rel.createNewMember && rel.memberName && to) {
        from.members.push({
          id: newId(),
          kind: 'field',
          name: rel.memberName,
          type: to.name,
          returnType: '',
          access: 'private',
          parameters: [],
        });
      }
      break;
    case 'methodReference':
      if (rel.createNewMember && rel.memberName && to) {
        from.members.push({
          id: newId(),
          kind: 'method',
          name: rel.memberName,
          type: '',
          returnType: 'void',
          access: 'public',
          generateStub: true,
          parameters: [{ name: 'arg', type: to.name }],
        });
      }
      break;
    case 'integrates':
    case 'callsApi':
      if (to && rel.createNewMember !== false) {
        const clientName = rel.memberName || `_client${to.name}`;
        if (!from.members.some((m) => m.name === clientName)) {
          from.members.push({
            id: newId(),
            kind: 'field',
            name: clientName,
            type: to.name,
            returnType: '',
            access: 'private',
            parameters: [],
            description: rel.label ?? LABELS[rel.kind],
          });
        }
      }
      break;
    default:
      break;
  }
}

export function relationStyle(kind: RelationKind): {
  stroke: string;
  dash: string;
  marker: 'inherit' | 'implement' | 'filled';
} {
  switch (kind) {
    case 'inherits':
      return { stroke: 'var(--arrow-inherit)', dash: '', marker: 'inherit' };
    case 'implements':
      return { stroke: 'var(--arrow-implement)', dash: '6 4', marker: 'implement' };
    case 'composes':
      return { stroke: 'var(--accent-secondary)', dash: '', marker: 'filled' };
    case 'aggregates':
      return { stroke: 'var(--accent-tertiary)', dash: '6 4', marker: 'filled' };
    case 'integrates':
    case 'callsApi':
      return { stroke: 'var(--accent-tertiary)', dash: '4 3', marker: 'filled' };
    case 'dependsOn':
      return { stroke: 'var(--arrow-use)', dash: '8 4', marker: 'filled' };
    case 'publishes':
    case 'subscribes':
      return { stroke: 'var(--accent-secondary)', dash: '2 4', marker: 'filled' };
    case 'fieldReference':
      return { stroke: 'var(--accent-primary)', dash: '6 4', marker: 'filled' };
    case 'methodReference':
      return { stroke: 'var(--accent-tertiary)', dash: '6 4', marker: 'filled' };
    case 'usingImport':
      return { stroke: 'var(--accent-secondary)', dash: '6 4', marker: 'filled' };
    default:
      return { stroke: 'var(--arrow-use)', dash: '6 4', marker: 'filled' };
  }
}
