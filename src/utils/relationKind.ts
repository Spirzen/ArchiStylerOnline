import type { ClassDefinition, RelationDefinition, RelationKind, TargetLanguage } from '../types/models';

const LABELS: Record<RelationKind, string> = {
  inherits: 'Наследование',
  implements: 'Реализация',
  uses: 'Зависимость',
  aggregates: 'Агрегация',
  composes: 'Композиция',
  fieldReference: 'Поле',
  methodReference: 'Метод',
  usingImport: 'import',
};

export function relationLabel(kind: RelationKind, lang: TargetLanguage, rel?: RelationDefinition): string {
  const base = kind === 'usingImport' && lang === 'csharp' ? 'using' : LABELS[kind];
  if (
    rel?.memberName &&
    (kind === 'fieldReference' || kind === 'methodReference')
  ) {
    return `${base}: ${rel.memberName}`;
  }
  return base;
}

export function availableRelationKinds(from: ClassDefinition, to: ClassDefinition): RelationKind[] {
  const list: RelationKind[] = [
    'uses',
    'aggregates',
    'composes',
    'fieldReference',
    'methodReference',
    'usingImport',
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
  from: ClassDefinition,
  to: ClassDefinition,
  lang: TargetLanguage,
): void {
  switch (rel.kind) {
    case 'inherits':
      from.baseType = to.name;
      break;
    case 'implements':
      if (!from.implementedInterfaces.includes(to.name)) {
        from.implementedInterfaces.push(to.name);
      }
      break;
    case 'usingImport': {
      const imp = lang === 'csharp' ? (to.namespace || to.name) : (to.package || to.name);
      if (imp && !from.usings.includes(imp)) from.usings.push(imp);
      break;
    }
    case 'fieldReference':
      if (rel.createNewMember && rel.memberName) {
        from.members.push({
          id: crypto.randomUUID(),
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
      if (rel.createNewMember && rel.memberName) {
        from.members.push({
          id: crypto.randomUUID(),
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
