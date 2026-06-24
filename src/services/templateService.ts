import type {
  ClassDefinition,
  PatternTemplate,
  ProjectModel,
  RelationKind,
  TemplateClass,
} from '../types/models';
import {
  CARD_HEADER,
  CARD_LINE,
  CARD_MAX_LINES,
  CARD_PADDING,
  CARD_WIDTH,
} from '../utils/diagramGeometry';
import { newId } from '../utils/id';
import { normalizeClassMembers } from '../utils/memberNaming';
import { applyRelationToModel } from '../utils/relationKind';
import { snapToGrid } from '../utils/snap';

const STACK_GAP = 88;

function parseRelationKind(k: string): RelationKind {
  const map: Record<string, RelationKind> = {
    Inherits: 'inherits',
    Implements: 'implements',
    Uses: 'uses',
    Aggregates: 'aggregates',
    Composes: 'composes',
    FieldReference: 'fieldReference',
    MethodReference: 'methodReference',
    UsingImport: 'usingImport',
    inherits: 'inherits',
    implements: 'implements',
    uses: 'uses',
  };
  return map[k] ?? 'uses';
}

function estimateCardHeight(tc: TemplateClass): number {
  const lines = Math.min(tc.members?.length ?? 0, CARD_MAX_LINES);
  return CARD_HEADER + lines * CARD_LINE + CARD_PADDING;
}

interface PlacedClass {
  name: string;
  x: number;
  y: number;
  tc: TemplateClass;
}

function reflowPatternLayout(
  project: ProjectModel,
  pattern: PatternTemplate,
  nameToId: Map<string, string>,
  placed: PlacedClass[],
): void {
  const byName = (name: string) => placed.find((p) => p.name === name);

  const applyPos = (p: PlacedClass) => {
    const cls = project.classes.find((c) => c.id === nameToId.get(p.name));
    if (!cls) return;
    cls.x = p.x;
    cls.y = p.y;
  };

  for (const tr of pattern.relations) {
    const kind = parseRelationKind(tr.kind);
    if (kind !== 'inherits' && kind !== 'implements') continue;
    const child = byName(tr.from);
    const parent = byName(tr.to);
    if (!child || !parent) continue;
    if (Math.abs(child.x - parent.x) <= CARD_WIDTH) {
      const minY = parent.y + estimateCardHeight(parent.tc) + STACK_GAP;
      if (child.y < minY) {
        child.y = snapToGrid(minY);
        applyPos(child);
      }
    }
  }

  for (const tr of pattern.relations) {
    const kind = parseRelationKind(tr.kind);
    if (kind !== 'uses' && kind !== 'aggregates' && kind !== 'composes') continue;
    const from = byName(tr.from);
    const to = byName(tr.to);
    if (!from || !to) continue;
    if (Math.abs(from.x - to.x) > CARD_WIDTH * 0.6) {
      const rowY = snapToGrid(Math.max(from.y, to.y));
      from.y = rowY;
      to.y = rowY;
      applyPos(from);
      applyPos(to);
    }
  }
}

export async function loadPatterns(baseUrl: string): Promise<PatternTemplate[]> {
  const files = ['patterns.json', 'patterns-gof.json'];
  const merged: PatternTemplate[] = [];
  for (const file of files) {
    try {
      const res = await fetch(`${baseUrl}templates/${file}`);
      if (!res.ok) continue;
      const data = (await res.json()) as { patterns?: PatternTemplate[] };
      if (data.patterns?.length) merged.push(...data.patterns);
    } catch {
      /* skip */
    }
  }
  return merged;
}

export function applyPattern(
  project: ProjectModel,
  pattern: PatternTemplate,
  originX = 80,
  originY = 80,
): void {
  const nameToId = new Map<string, string>();
  const folderNameToId = new Map<string, string>();
  const placed: PlacedClass[] = [];

  for (const tf of pattern.folders ?? []) {
    const folderId = newId();
    folderNameToId.set(tf.name, folderId);
    project.folders.push({
      id: folderId,
      name: tf.name,
      segment: tf.segment ?? tf.name,
      x: originX + tf.offsetX,
      y: originY + tf.offsetY,
      width: tf.width && tf.width > 0 ? tf.width : 320,
      height: tf.height && tf.height > 0 ? tf.height : 240,
      parentFolderId: tf.parent ? (folderNameToId.get(tf.parent) ?? null) : null,
    });
  }

  for (const tc of pattern.classes) {
    let classX = snapToGrid(originX + tc.offsetX);
    let classY = snapToGrid(originY + tc.offsetY);
    let folderId: string | null = null;
    if (tc.folder && folderNameToId.has(tc.folder)) {
      folderId = folderNameToId.get(tc.folder)!;
      const folder = project.folders.find((f) => f.id === folderId)!;
      classX = snapToGrid(folder.x + 20 + tc.offsetX);
      classY = snapToGrid(folder.y + 44 + tc.offsetY);
    }
    const cls = templateClassToDefinition(tc, classX, classY, folderId, project);
    project.classes.push(cls);
    nameToId.set(tc.name, cls.id);
    placed.push({ name: tc.name, x: classX, y: classY, tc });
  }

  reflowPatternLayout(project, pattern, nameToId, placed);

  for (const tr of pattern.relations) {
    const fromId = nameToId.get(tr.from);
    const toId = nameToId.get(tr.to);
    if (!fromId || !toId) continue;
    const from = project.classes.find((c) => c.id === fromId)!;
    const to = project.classes.find((c) => c.id === toId)!;
    const rel = {
      id: newId(),
      fromClassId: fromId,
      toClassId: toId,
      kind: parseRelationKind(tr.kind),
    };
    applyRelationToModel(rel, from, to, project.language);
    project.relations.push(rel);
  }
}

function templateClassToDefinition(
  tc: TemplateClass,
  x: number,
  y: number,
  folderId: string | null,
  project: ProjectModel,
): ClassDefinition {
  const ns = project.defaultNamespace;
  const pkg = project.defaultPackage;
  const cls: ClassDefinition = {
    id: newId(),
    name: tc.name,
    x,
    y,
    namespace: ns,
    package: pkg,
    folderId,
    role: 'none',
    access: 'public',
    isInterface: !!tc.isInterface,
    isAbstract: !!tc.isAbstract,
    isEnum: false,
    isSealed: false,
    isStatic: false,
    isRecord: false,
    baseType: tc.baseType ?? '',
    implementedInterfaces: [...(tc.implements ?? [])],
    usings: [...(tc.usings ?? [])],
    summary: '',
    members: [],
  };
  for (const tm of tc.members ?? []) {
    cls.members.push({
      id: newId(),
      kind: (['field', 'property', 'method', 'constructor'].includes(
        (tm.kind ?? '').toLowerCase(),
      )
        ? tm.kind!.toLowerCase()
        : 'method') as ClassDefinition['members'][0]['kind'],
      name: tm.name,
      type: tm.type ?? '',
      returnType: tm.returnType ?? 'void',
      access: (['public', 'private', 'protected'].includes((tm.access ?? '').toLowerCase())
        ? tm.access!.toLowerCase()
        : 'public') as ClassDefinition['members'][0]['access'],
      isAbstract: tm.isAbstract,
      isStatic: tm.isStatic,
      generateStub: tm.generateStub,
      parameters: (tm.parameters ?? []).map((p) => ({ name: p.name, type: p.type })),
    });
  }
  cls.members = normalizeClassMembers(cls.members, cls.name, project.language);
  return cls;
}

export function createEmptyProject(name = 'Новая схема'): ProjectModel {
  return {
    name,
    language: 'csharp',
    defaultNamespace: 'App.Architecture',
    defaultPackage: 'app.architecture',
    defaultModule: 'app.architecture',
    folders: [],
    classes: [],
    integrations: [],
    relations: [],
  };
}
