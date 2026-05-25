import {
  MAX_CLASSES,
  MAX_PROJECT_BYTES,
  MAX_RELATIONS,
  SCHEMA_VERSION,
  type ProjectModel,
} from '../types/models';

const SAFE_NAME = /^[\w.\u0400-\u04FF]{1,80}$/;

export function sanitizeName(name: string): string {
  return name.replace(/[^\w.\u0400-\u04FF]/g, '').slice(0, 80);
}

export function validateProject(data: unknown): ProjectModel | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (o.schemaVersion !== undefined && o.schemaVersion !== SCHEMA_VERSION) return null;

  const name = typeof o.name === 'string' ? sanitizeName(o.name).slice(0, 120) : 'Diagram';
  const language = o.language === 'java' ? 'java' : 'csharp';
  const defaultNamespace =
    typeof o.defaultNamespace === 'string' ? sanitizeName(o.defaultNamespace) : 'App';
  const defaultPackage =
    typeof o.defaultPackage === 'string' ? sanitizeName(o.defaultPackage) : 'app';

  if (!Array.isArray(o.classes) || !Array.isArray(o.relations) || !Array.isArray(o.folders)) {
    return null;
  }
  if (o.classes.length > MAX_CLASSES || o.relations.length > MAX_RELATIONS) return null;

  try {
    const json = JSON.stringify(data);
    if (json.length > MAX_PROJECT_BYTES) return null;
  } catch {
    return null;
  }

  const project: ProjectModel = {
    name: name || 'Diagram',
    language,
    defaultNamespace: defaultNamespace || 'App',
    defaultPackage: defaultPackage || 'app',
    folders: [],
    classes: [],
    relations: [],
  };

  for (const f of o.folders) {
    if (!f || typeof f !== 'object') continue;
    const fo = f as Record<string, unknown>;
    if (typeof fo.id !== 'string' || typeof fo.name !== 'string') continue;
    project.folders.push({
      id: fo.id,
      name: sanitizeName(fo.name) || 'Folder',
      segment: typeof fo.segment === 'string' ? sanitizeName(fo.segment) : 'folder',
      x: clampNum(fo.x, 0, 20000),
      y: clampNum(fo.y, 0, 20000),
      width: clampNum(fo.width, 120, 4000),
      height: clampNum(fo.height, 80, 4000),
      parentFolderId: typeof fo.parentFolderId === 'string' ? fo.parentFolderId : null,
    });
  }

  for (const c of o.classes) {
    if (!c || typeof c !== 'object') continue;
    const co = c as Record<string, unknown>;
    if (typeof co.id !== 'string' || typeof co.name !== 'string') continue;
    const members = Array.isArray(co.members)
      ? co.members.slice(0, 80).map(parseMember).filter(Boolean)
      : [];
    project.classes.push({
      id: co.id,
      name: sanitizeName(co.name) || 'Class',
      x: clampNum(co.x, 0, 20000),
      y: clampNum(co.y, 0, 20000),
      namespace: typeof co.namespace === 'string' ? sanitizeName(co.namespace) : defaultNamespace,
      package: typeof co.package === 'string' ? sanitizeName(co.package) : defaultPackage,
      folderId: typeof co.folderId === 'string' ? co.folderId : null,
      role: 'none',
      access: 'public',
      isInterface: !!co.isInterface,
      isAbstract: !!co.isAbstract,
      isEnum: !!co.isEnum,
      isSealed: !!co.isSealed,
      isStatic: !!co.isStatic,
      isRecord: !!co.isRecord,
      baseType: typeof co.baseType === 'string' ? sanitizeName(co.baseType) : '',
      implementedInterfaces: Array.isArray(co.implementedInterfaces)
        ? co.implementedInterfaces.filter((x): x is string => typeof x === 'string').slice(0, 20)
        : [],
      usings: Array.isArray(co.usings)
        ? co.usings.filter((x): x is string => typeof x === 'string').slice(0, 40)
        : [],
      summary: typeof co.summary === 'string' ? co.summary.slice(0, 500) : '',
      members: members as ProjectModel['classes'][0]['members'],
    });
  }

  const classIds = new Set(project.classes.map((c) => c.id));
  for (const r of o.relations) {
    if (!r || typeof r !== 'object') continue;
    const ro = r as Record<string, unknown>;
    if (
      typeof ro.id !== 'string' ||
      typeof ro.fromClassId !== 'string' ||
      typeof ro.toClassId !== 'string' ||
      !classIds.has(ro.fromClassId) ||
      !classIds.has(ro.toClassId)
    ) {
      continue;
    }
    project.relations.push({
      id: ro.id,
      fromClassId: ro.fromClassId,
      toClassId: ro.toClassId,
      kind: parseRelationKind(ro.kind),
      fromPort: parsePort(ro.fromPort),
      toPort: parsePort(ro.toPort),
      memberName: typeof ro.memberName === 'string' ? ro.memberName.slice(0, 80) : undefined,
      createNewMember: !!ro.createNewMember,
    });
  }

  return project;
}

function clampNum(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.min(max, Math.max(min, n));
}

function parseMember(m: unknown) {
  if (!m || typeof m !== 'object') return null;
  const mo = m as Record<string, unknown>;
  if (typeof mo.name !== 'string') return null;
  return {
    id: typeof mo.id === 'string' ? mo.id : crypto.randomUUID(),
    kind: ['field', 'property', 'method', 'constructor'].includes(mo.kind as string)
      ? (mo.kind as 'field')
      : 'method',
    name: sanitizeName(mo.name),
    type: typeof mo.type === 'string' ? mo.type.slice(0, 80) : '',
    returnType: typeof mo.returnType === 'string' ? mo.returnType.slice(0, 80) : 'void',
    access: ['public', 'private', 'protected', 'internal'].includes(mo.access as string)
      ? (mo.access as 'public')
      : 'public',
    isStatic: !!mo.isStatic,
    isAbstract: !!mo.isAbstract,
    isVirtual: !!mo.isVirtual,
    isReadOnly: !!mo.isReadOnly,
    generateStub: !!mo.generateStub,
    parameters: Array.isArray(mo.parameters)
      ? mo.parameters
          .filter((p): p is { name: string; type: string } =>
            !!p && typeof p === 'object' && typeof (p as { name?: string }).name === 'string',
          )
          .slice(0, 16)
      : [],
  };
}

function parseRelationKind(k: unknown) {
  const kinds = [
    'inherits',
    'implements',
    'uses',
    'aggregates',
    'composes',
    'fieldReference',
    'methodReference',
    'usingImport',
  ] as const;
  return kinds.includes(k as (typeof kinds)[number]) ? (k as (typeof kinds)[number]) : 'uses';
}

function parsePort(p: unknown) {
  const ports = ['north', 'east', 'south', 'west'] as const;
  return ports.includes(p as (typeof ports)[number]) ? (p as (typeof ports)[number]) : undefined;
}

export function isValidClassName(name: string): boolean {
  return SAFE_NAME.test(name) && name.length > 0;
}
