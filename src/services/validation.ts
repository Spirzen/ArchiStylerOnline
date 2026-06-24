import {
  MAX_CLASSES,
  MAX_PROJECT_BYTES,
  MAX_RELATIONS,
  SCHEMA_VERSION,
  type IntegrationDefinition,
  type IntegrationKind,
  type ProjectModel,
  type RelationKind,
} from '../types/models';
import { normalizeClassMembers } from '../utils/memberNaming';

const SAFE_NAME = /^[\w.\u0400-\u04FF]{1,80}$/;

export function sanitizeName(name: string): string {
  return name.replace(/[^\w.\u0400-\u04FF]/g, '').slice(0, 80);
}

export function validateProject(data: unknown): ProjectModel | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const schemaVersion = typeof o.schemaVersion === 'number' ? o.schemaVersion : 1;
  if (schemaVersion > SCHEMA_VERSION) return null;

  const name = typeof o.name === 'string' ? sanitizeName(o.name).slice(0, 120) : 'Diagram';
  const language =
    o.language === 'java' ? 'java' : o.language === 'python' ? 'python' : 'csharp';
  const defaultNamespace =
    typeof o.defaultNamespace === 'string' ? sanitizeName(o.defaultNamespace) : 'App';
  const defaultPackage =
    typeof o.defaultPackage === 'string' ? sanitizeName(o.defaultPackage) : 'app';
  const defaultModule =
    typeof o.defaultModule === 'string'
      ? sanitizeName(o.defaultModule)
      : defaultPackage;

  if (!Array.isArray(o.classes) || !Array.isArray(o.relations)) {
    return null;
  }
  const folders = Array.isArray(o.folders) ? o.folders : [];
  const integrations = Array.isArray(o.integrations) ? o.integrations : [];
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
    defaultModule: defaultModule || 'app',
    folders: [],
    classes: [],
    integrations: [],
    relations: [],
  };

  for (const f of folders) {
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
    const className = sanitizeName(co.name) || 'Class';
    const members = Array.isArray(co.members)
      ? normalizeClassMembers(
          co.members.slice(0, 80).map(parseMember).filter(Boolean) as ProjectModel['classes'][0]['members'],
          className,
          language,
        )
      : [];
    project.classes.push({
      id: co.id,
      name: className,
      x: clampNum(co.x, 0, 20000),
      y: clampNum(co.y, 0, 20000),
      namespace: typeof co.namespace === 'string' ? sanitizeName(co.namespace) : defaultNamespace,
      package: typeof co.package === 'string' ? sanitizeName(co.package) : defaultPackage,
      folderId: typeof co.folderId === 'string' ? co.folderId : null,
      role: parseClassRole(co.role),
      access: parseAccess(co.access),
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

  for (const item of integrations) {
    const intg = parseIntegration(item);
    if (intg) project.integrations.push(intg);
  }

  const classIds = new Set(project.classes.map((c) => c.id));
  const integrationIds = new Set(project.integrations.map((i) => i.id));

  for (const r of o.relations) {
    if (!r || typeof r !== 'object') continue;
    const ro = r as Record<string, unknown>;
    if (typeof ro.id !== 'string') continue;
    const fromClassId = typeof ro.fromClassId === 'string' ? ro.fromClassId : undefined;
    const toClassId = typeof ro.toClassId === 'string' ? ro.toClassId : undefined;
    const fromIntegrationId =
      typeof ro.fromIntegrationId === 'string' ? ro.fromIntegrationId : undefined;
    const toIntegrationId = typeof ro.toIntegrationId === 'string' ? ro.toIntegrationId : undefined;
    const hasFrom = (fromClassId && classIds.has(fromClassId)) || (fromIntegrationId && integrationIds.has(fromIntegrationId));
    const hasTo = (toClassId && classIds.has(toClassId)) || (toIntegrationId && integrationIds.has(toIntegrationId));
    if (!hasFrom || !hasTo) continue;
    project.relations.push({
      id: ro.id,
      fromClassId,
      toClassId,
      fromIntegrationId,
      toIntegrationId,
      kind: parseRelationKind(ro.kind),
      fromPort: parsePort(ro.fromPort),
      toPort: parsePort(ro.toPort),
      memberName: typeof ro.memberName === 'string' ? ro.memberName.slice(0, 80) : undefined,
      createNewMember: !!ro.createNewMember,
      label: typeof ro.label === 'string' ? ro.label.slice(0, 120) : undefined,
    });
  }

  return project;
}

function clampNum(v: unknown, min: number, max: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : 0;
  return Math.min(max, Math.max(min, n));
}

function parseAccess(a: unknown): ProjectModel['classes'][0]['access'] {
  return ['public', 'private', 'protected', 'internal'].includes(a as string)
    ? (a as ProjectModel['classes'][0]['access'])
    : 'public';
}

function parseClassRole(r: unknown): ProjectModel['classes'][0]['role'] {
  const roles = [
    'none', 'interface', 'view', 'presenter', 'viewModel', 'model', 'controller',
    'repository', 'entity', 'service', 'factory', 'strategy', 'command', 'adapter',
    'singleton', 'observer', 'decorator', 'facade', 'proxy', 'builder', 'dto', 'logger', 'handler',
  ] as const;
  return roles.includes(r as (typeof roles)[number]) ? (r as (typeof roles)[number]) : 'none';
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
    access: parseAccess(mo.access),
    isStatic: !!mo.isStatic,
    isAbstract: !!mo.isAbstract,
    isVirtual: !!mo.isVirtual,
    isReadOnly: !!mo.isReadOnly,
    generateStub: mo.generateStub !== false,
    description: typeof mo.description === 'string' ? mo.description.slice(0, 300) : undefined,
    defaultValue: typeof mo.defaultValue === 'string' ? mo.defaultValue.slice(0, 80) : undefined,
    parameters: Array.isArray(mo.parameters)
      ? mo.parameters
          .filter((p): p is { name: string; type: string } =>
            !!p && typeof p === 'object' && typeof (p as { name?: string }).name === 'string',
          )
          .slice(0, 16)
          .map((p) => ({
            name: sanitizeName((p as { name: string }).name),
            type: typeof (p as { type?: string }).type === 'string' ? (p as { type: string }).type.slice(0, 80) : 'object',
            defaultValue:
              typeof (p as { defaultValue?: string }).defaultValue === 'string'
                ? String((p as { defaultValue?: string }).defaultValue).slice(0, 80)
                : undefined,
          }))
      : [],
  };
}

function parseIntegration(item: unknown): IntegrationDefinition | null {
  if (!item || typeof item !== 'object') return null;
  const io = item as Record<string, unknown>;
  if (typeof io.id !== 'string' || typeof io.name !== 'string') return null;
  return {
    id: io.id,
    name: sanitizeName(io.name) || 'Service',
    kind: parseIntegrationKind(io.kind),
    endpoint: typeof io.endpoint === 'string' ? io.endpoint.slice(0, 200) : '',
    description: typeof io.description === 'string' ? io.description.slice(0, 500) : '',
    protocol: typeof io.protocol === 'string' ? io.protocol.slice(0, 80) : '',
    authType: typeof io.authType === 'string' ? io.authType.slice(0, 80) : '',
    x: clampNum(io.x, 0, 20000),
    y: clampNum(io.y, 0, 20000),
    folderId: typeof io.folderId === 'string' ? io.folderId : null,
    tags: Array.isArray(io.tags)
      ? io.tags.filter((t): t is string => typeof t === 'string').slice(0, 12)
      : [],
  };
}

function parseIntegrationKind(k: unknown): IntegrationKind {
  const kinds = [
    'rest', 'grpc', 'graphql', 'messageQueue', 'database', 'cache', 'auth', 'storage', 'custom',
  ] as const;
  return kinds.includes(k as IntegrationKind) ? (k as IntegrationKind) : 'rest';
}

function parseRelationKind(k: unknown): RelationKind {
  const kinds = [
    'inherits', 'implements', 'uses', 'aggregates', 'composes',
    'fieldReference', 'methodReference', 'usingImport',
    'dependsOn', 'integrates', 'callsApi', 'publishes', 'subscribes',
  ] as const;
  return kinds.includes(k as RelationKind) ? (k as RelationKind) : 'uses';
}

function parsePort(p: unknown) {
  const ports = ['north', 'east', 'south', 'west'] as const;
  return ports.includes(p as (typeof ports)[number]) ? (p as (typeof ports)[number]) : undefined;
}

export function isValidClassName(name: string): boolean {
  return SAFE_NAME.test(name) && name.length > 0;
}
