import { create } from 'zustand';
import { temporal } from 'zundo';
import { generateClassCode } from '../services/codeGenerator';
import { clearProjectStorage, downloadJson, loadProject, saveProject } from '../services/storage';
import { applyPattern, createEmptyProject } from '../services/templateService';
import { sanitizeName } from '../services/validation';
import type {
  AppTheme,
  ClassDefinition,
  ConnectionPort,
  FolderDefinition,
  IntegrationDefinition,
  IntegrationKind,
  PatternTemplate,
  ProjectModel,
  RelationDefinition,
  RelationKind,
  TargetLanguage,
} from '../types/models';
import {
  CARD_WIDTH,
  findInnermostFolder,
  INTEGRATION_HEIGHT,
  INTEGRATION_WIDTH,
  integrationPortPosition,
  portPosition,
} from '../utils/diagramGeometry';
import { findNodeAt, findNodesInRect, nearestPortForNode, type WorldRect } from '../utils/hitTest';
import { cloneProjectShell, withRelations } from '../utils/projectClone';
import { newId } from '../utils/id';
import { normalizeClassMembers } from '../utils/memberNaming';
import { applyRelationToModel } from '../utils/relationKind';
import { snapToGrid } from '../utils/snap';
import { clampZoom, zoomAtPoint } from '../utils/viewport';

interface ClipboardPayload {
  classes: ClassDefinition[];
  integrations: IntegrationDefinition[];
}

export interface ContextMenuState {
  screenX: number;
  screenY: number;
  worldX: number;
  worldY: number;
  target: 'canvas' | 'class' | 'integration' | 'relation';
  targetId?: string;
}

interface LinkDraft {
  fromClassId?: string;
  fromIntegrationId?: string;
  fromPort: ConnectionPort;
  x: number;
  y: number;
}

interface DiagramState {
  project: ProjectModel;
  theme: AppTheme;
  zoom: number;
  panX: number;
  panY: number;
  snapEnabled: boolean;
  smartGuidesEnabled: boolean;
  storageReady: boolean;
  selectedClassId: string | null;
  selectedClassIds: string[];
  selectedFolderId: string | null;
  selectedIntegrationId: string | null;
  selectedIntegrationIds: string[];
  selectedRelationId: string | null;
  linkDraft: LinkDraft | null;
  linkHoverTargetId: string | null;
  linkAwaitingTarget: boolean;
  clipboard: ClipboardPayload | null;
  contextMenu: ContextMenuState | null;
  relationPicker: {
    x: number;
    y: number;
    fromClassId?: string;
    toClassId?: string;
    fromIntegrationId?: string;
    toIntegrationId?: string;
    fromPort?: ConnectionPort;
    toPort?: ConnectionPort;
  } | null;
  statusMessage: string;
  patterns: PatternTemplate[];
  selectedPatternId: string;
  rightTab: 'class' | 'code' | 'integration';
  codePreview: string;
  showHelp: boolean;
  showImport: boolean;

  init: (patterns: PatternTemplate[]) => void;
  hydrate: () => Promise<void>;
  setTheme: (t: AppTheme) => void;
  setStatus: (msg: string) => void;
  setSnapEnabled: (v: boolean) => void;
  setSmartGuidesEnabled: (v: boolean) => void;
  undo: () => void;
  redo: () => void;
  duplicateSelected: () => void;
  setZoom: (z: number) => void;
  zoomAt: (screenX: number, screenY: number, factor: number) => void;
  setPan: (x: number, y: number) => void;
  centerOn: (worldX: number, worldY: number, width?: number, height?: number) => void;
  clearSelection: () => void;
  selectClass: (id: string | null, additive?: boolean) => void;
  selectFolder: (id: string | null) => void;
  selectIntegration: (id: string | null, additive?: boolean) => void;
  selectRelation: (id: string | null) => void;
  selectInRect: (rect: WorldRect) => void;
  selectAllNodes: () => void;
  setRightTab: (tab: 'class' | 'code' | 'integration') => void;
  setLanguage: (lang: TargetLanguage) => void;
  setProjectName: (name: string) => void;
  setSelectedPattern: (id: string) => void;
  applySelectedPattern: () => void;
  addClass: (name?: string) => void;
  addFolder: () => void;
  addIntegration: (kind?: IntegrationKind) => void;
  updateClass: (id: string, patch: Partial<ClassDefinition>) => void;
  updateFolder: (id: string, patch: Partial<FolderDefinition>) => void;
  updateIntegration: (id: string, patch: Partial<IntegrationDefinition>) => void;
  deleteSelected: () => void;
  moveClass: (id: string, x: number, y: number) => void;
  moveGroupDelta: (dx: number, dy: number) => void;
  moveFolder: (id: string, dx: number, dy: number) => void;
  moveIntegration: (id: string, x: number, y: number) => void;
  nudgeSelected: (dx: number, dy: number) => void;
  resizeFolder: (id: string, w: number, h: number) => void;
  startLinkFromClass: (classId: string, port: ConnectionPort) => void;
  startLinkFromIntegration: (integrationId: string, port: ConnectionPort) => void;
  updateLinkDraft: (x: number, y: number) => void;
  completeLinkAt: (worldX: number, worldY: number, screenX: number, screenY: number) => void;
  setLinkHoverTarget: (id: string | null) => void;
  startLinkFromSelected: () => void;
  cancelLink: () => void;
  copySelection: () => void;
  pasteClipboard: (worldX?: number, worldY?: number) => void;
  openContextMenu: (menu: ContextMenuState) => void;
  closeContextMenu: () => void;
  confirmRelation: (kind: RelationKind) => void;
  removeRelation: (id: string) => void;
  newDiagram: () => void;
  loadProject: (p: ProjectModel) => void;
  exportJson: () => void;
  setShowHelp: (v: boolean) => void;
  setShowImport: (v: boolean) => void;
  persist: () => void;
  refreshCode: () => void;
}

function applySnap(x: number, y: number, enabled: boolean): { x: number; y: number } {
  if (!enabled) return { x, y };
  return { x: snapToGrid(x), y: snapToGrid(y) };
}

function projectFingerprint(project: ProjectModel): string {
  return JSON.stringify(project);
}

export const useDiagramStore = create<DiagramState>()(
  temporal(
    (set, get) => ({
  project: createEmptyProject(),
  theme: (localStorage.getItem('as-theme') as AppTheme) || 'dark',
  zoom: 1,
  panX: 48,
  panY: 48,
  snapEnabled: localStorage.getItem('as-snap') !== 'false',
  smartGuidesEnabled: localStorage.getItem('as-smart-guides') !== 'false',
  storageReady: false,
  selectedClassId: null,
  selectedClassIds: [],
  selectedFolderId: null,
  selectedIntegrationId: null,
  selectedIntegrationIds: [],
  selectedRelationId: null,
  linkDraft: null,
  linkHoverTargetId: null,
  linkAwaitingTarget: false,
  clipboard: null,
  contextMenu: null,
  relationPicker: null,
  statusMessage: 'Готово — проектируйте архитектуру в браузере',
  patterns: [],
  selectedPatternId: '',
  rightTab: 'class',
  codePreview: '',
  showHelp: false,
  showImport: false,

  init: (patterns) => {
    set({ patterns, selectedPatternId: patterns[0]?.id ?? '' });
  },

  hydrate: async () => {
    const saved = await loadProject();
    if (saved) {
      set({ project: saved, storageReady: true });
      get().refreshCode();
    } else {
      set({ storageReady: true });
    }
    queueMicrotask(() => useDiagramStore.temporal.getState().clear());
  },

  undo: () => {
    useDiagramStore.temporal.getState().undo();
    get().refreshCode();
    get().persist();
    get().setStatus('Отменено');
  },

  redo: () => {
    useDiagramStore.temporal.getState().redo();
    get().refreshCode();
    get().persist();
    get().setStatus('Повторено');
  },

  setTheme: (t) => {
    localStorage.setItem('as-theme', t);
    document.documentElement.dataset.theme = t;
    set({ theme: t });
  },

  setStatus: (msg) => set({ statusMessage: msg }),
  setSnapEnabled: (v) => {
    localStorage.setItem('as-snap', v ? 'true' : 'false');
    set({ snapEnabled: v });
  },

  setSmartGuidesEnabled: (v) => {
    localStorage.setItem('as-smart-guides', v ? 'true' : 'false');
    set({ smartGuidesEnabled: v });
  },

  setZoom: (z) => set({ zoom: clampZoom(z) }),
  zoomAt: (screenX, screenY, factor) => {
    const { zoom, panX, panY } = get();
    const newZoom = clampZoom(zoom * factor);
    const pan = zoomAtPoint(panX, panY, zoom, screenX, screenY, newZoom);
    set({ zoom: newZoom, panX: pan.panX, panY: pan.panY });
  },
  setPan: (x, y) => set({ panX: x, panY: y }),

  centerOn: (worldX, worldY, width = 220, height = 180) => {
    const wrap = document.querySelector('.canvas-wrap');
    const rect = wrap?.getBoundingClientRect();
    if (!rect) return;
    const { zoom } = get();
    const cx = worldX + width / 2;
    const cy = worldY + height / 2;
    set({
      panX: rect.width / 2 - cx * zoom,
      panY: rect.height / 2 - cy * zoom,
    });
  },

  selectClass: (id, additive = false) => {
    if (!id) {
      get().clearSelection();
      return;
    }
    const { selectedClassIds, selectedIntegrationIds } = get();
    let classIds: string[];
    let intgIds = selectedIntegrationIds;
    if (additive) {
      classIds = selectedClassIds.includes(id)
        ? selectedClassIds.filter((i) => i !== id)
        : [...selectedClassIds, id];
    } else {
      classIds = [id];
      intgIds = [];
    }
    set({
      selectedClassIds: classIds,
      selectedIntegrationIds: intgIds,
      selectedClassId: id,
      selectedIntegrationId: intgIds[intgIds.length - 1] ?? null,
      selectedFolderId: null,
      selectedRelationId: null,
      rightTab: 'class',
    });
    get().refreshCode();
  },

  clearSelection: () =>
    set({
      selectedClassIds: [],
      selectedIntegrationIds: [],
      selectedClassId: null,
      selectedIntegrationId: null,
      selectedFolderId: null,
      selectedRelationId: null,
      codePreview: '// Выберите класс на схеме',
    }),

  selectInRect: (rect) => {
    const nodes = findNodesInRect(rect, get().project);
    const classIds = nodes.filter((n) => n.type === 'class').map((n) => n.id);
    const intgIds = nodes.filter((n) => n.type === 'integration').map((n) => n.id);
    const total = classIds.length + intgIds.length;
    set({
      selectedClassIds: classIds,
      selectedIntegrationIds: intgIds,
      selectedClassId: classIds[classIds.length - 1] ?? null,
      selectedIntegrationId: intgIds[intgIds.length - 1] ?? null,
      selectedFolderId: null,
      selectedRelationId: null,
      rightTab: classIds.length ? 'class' : intgIds.length ? 'integration' : get().rightTab,
    });
    get().refreshCode();
    get().setStatus(total ? `Выбрано элементов: ${total}` : 'Выделение снято');
  },

  selectAllNodes: () => {
    const { project } = get();
    const classIds = project.classes.map((c) => c.id);
    const intgIds = project.integrations.map((i) => i.id);
    set({
      selectedClassIds: classIds,
      selectedIntegrationIds: intgIds,
      selectedClassId: classIds[classIds.length - 1] ?? null,
      selectedIntegrationId: intgIds[intgIds.length - 1] ?? null,
      selectedFolderId: null,
      selectedRelationId: null,
    });
    get().refreshCode();
    get().setStatus(`Выбрано: ${classIds.length + intgIds.length}`);
  },

  selectFolder: (id) =>
    set({
      selectedFolderId: id,
      selectedClassIds: [],
      selectedIntegrationIds: [],
      selectedClassId: null,
      selectedIntegrationId: null,
      selectedRelationId: null,
    }),

  selectIntegration: (id, additive = false) => {
    if (!id) {
      get().clearSelection();
      return;
    }
    const { selectedClassIds, selectedIntegrationIds } = get();
    let intgIds: string[];
    let classIds = selectedClassIds;
    if (additive) {
      intgIds = selectedIntegrationIds.includes(id)
        ? selectedIntegrationIds.filter((i) => i !== id)
        : [...selectedIntegrationIds, id];
    } else {
      intgIds = [id];
      classIds = [];
    }
    set({
      selectedIntegrationIds: intgIds,
      selectedClassIds: classIds,
      selectedIntegrationId: id,
      selectedClassId: classIds[classIds.length - 1] ?? null,
      selectedFolderId: null,
      selectedRelationId: null,
      rightTab: 'integration',
    });
  },

  selectRelation: (id) =>
    set({
      selectedRelationId: id,
      selectedClassIds: [],
      selectedIntegrationIds: [],
      selectedClassId: null,
      selectedFolderId: null,
      selectedIntegrationId: null,
    }),

  setRightTab: (tab) => {
    set({ rightTab: tab });
    if (tab === 'code') get().refreshCode();
  },

  setLanguage: (lang) => {
    set((s) => {
      const project = { ...s.project, language: lang };
      project.classes = project.classes.map((c) => ({
        ...c,
        members: normalizeClassMembers(c.members, c.name, lang),
      }));
      return { project };
    });
    get().refreshCode();
    get().persist();
  },

  setProjectName: (name) => {
    set((s) => ({ project: { ...s.project, name: sanitizeName(name) || 'Diagram' } }));
    get().persist();
  },

  setSelectedPattern: (id) => set({ selectedPatternId: id }),

  applySelectedPattern: () => {
    const { patterns, selectedPatternId, project } = get();
    const pattern = patterns.find((p) => p.id === selectedPatternId);
    if (!pattern) return;
    const offset = project.classes.length * 40;
    applyPattern(project, pattern, 80 + offset, 80 + offset);
    set({ project: cloneProjectShell(project) });
    get().setStatus(`Паттерн «${pattern.name}» добавлен на схему`);
    get().persist();
  },

  addClass: (name) => {
    const { project, snapEnabled } = get();
    const n = project.classes.length + 1;
    const pos = applySnap(120 + (n % 5) * 40, 120 + Math.floor(n / 5) * 160, snapEnabled);
    const cls: ClassDefinition = {
      id: newId(),
      name: sanitizeName(name ?? `Class${n}`) || `Class${n}`,
      x: pos.x,
      y: pos.y,
      namespace: project.defaultNamespace,
      package: project.defaultPackage,
      folderId: null,
      role: 'none',
      access: 'public',
      isInterface: false,
      isAbstract: false,
      isEnum: false,
      isSealed: false,
      isStatic: false,
      isRecord: false,
      baseType: '',
      implementedInterfaces: [],
      usings: [],
      summary: '',
      members: [],
    };
    project.classes.push(cls);
    set({ project: { ...project }, selectedClassId: cls.id, selectedClassIds: [cls.id], selectedIntegrationIds: [] });
    get().refreshCode();
    get().persist();
  },

  addFolder: () => {
    const { project } = get();
    const folder: FolderDefinition = {
      id: newId(),
      name: `Слой ${project.folders.length + 1}`,
      segment: 'layer',
      x: 60,
      y: 60,
      width: 360,
      height: 280,
      parentFolderId: null,
    };
    project.folders.push(folder);
    set({ project: { ...project }, selectedFolderId: folder.id });
    get().persist();
  },

  addIntegration: (kind = 'rest') => {
    const { project, snapEnabled } = get();
    const n = project.integrations.length + 1;
    const pos = applySnap(400 + (n % 4) * 220, 80 + Math.floor(n / 4) * 100, snapEnabled);
    const intg: IntegrationDefinition = {
      id: newId(),
      name: `Service${n}`,
      kind,
      endpoint: 'https://api.example.com/v1',
      description: '',
      protocol: kind === 'rest' ? 'HTTPS' : '',
      authType: '',
      x: pos.x,
      y: pos.y,
      folderId: null,
      tags: [],
    };
    project.integrations.push(intg);
    set({
      project: { ...project },
      selectedIntegrationId: intg.id,
      selectedIntegrationIds: [intg.id],
      selectedClassIds: [],
      rightTab: 'integration',
    });
    get().persist();
  },

  updateClass: (id, patch) => {
    const { project } = get();
    const idx = project.classes.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const prev = project.classes[idx];
    const next = { ...prev, ...patch };
    if (patch.name) next.name = sanitizeName(patch.name);
    if (patch.name !== undefined || patch.members !== undefined) {
      next.members = normalizeClassMembers(next.members, next.name, project.language);
    }
    project.classes[idx] = next;
    set({ project: { ...project } });
    get().refreshCode();
    get().persist();
  },

  updateFolder: (id, patch) => {
    const { project } = get();
    const idx = project.folders.findIndex((f) => f.id === id);
    if (idx < 0) return;
    project.folders[idx] = { ...project.folders[idx], ...patch };
    set({ project: { ...project } });
    get().persist();
  },

  updateIntegration: (id, patch) => {
    const { project } = get();
    const idx = project.integrations.findIndex((i) => i.id === id);
    if (idx < 0) return;
    project.integrations[idx] = { ...project.integrations[idx], ...patch };
    if (patch.name) project.integrations[idx].name = sanitizeName(patch.name);
    set({ project: { ...project } });
    get().persist();
  },

  deleteSelected: () => {
    const {
      project,
      selectedClassIds,
      selectedIntegrationIds,
      selectedFolderId,
      selectedRelationId,
    } = get();
    if (selectedRelationId) {
      set({
        project: withRelations(project, project.relations.filter((r) => r.id !== selectedRelationId)),
        selectedRelationId: null,
      });
    } else if (selectedClassIds.length > 0 || selectedIntegrationIds.length > 0) {
      const classSet = new Set(selectedClassIds);
      const intgSet = new Set(selectedIntegrationIds);
      set({
        project: {
          ...cloneProjectShell(project),
          classes: project.classes.filter((c) => !classSet.has(c.id)),
          integrations: project.integrations.filter((i) => !intgSet.has(i.id)),
          relations: project.relations.filter(
            (r) =>
              !(r.fromClassId && classSet.has(r.fromClassId)) &&
              !(r.toClassId && classSet.has(r.toClassId)) &&
              !(r.fromIntegrationId && intgSet.has(r.fromIntegrationId)) &&
              !(r.toIntegrationId && intgSet.has(r.toIntegrationId)),
          ),
        },
        selectedClassIds: [],
        selectedIntegrationIds: [],
        selectedClassId: null,
        selectedIntegrationId: null,
        codePreview: '',
      });
    } else if (selectedFolderId) {
      project.folders = project.folders.filter((f) => f.id !== selectedFolderId);
      project.classes.forEach((c) => {
        if (c.folderId === selectedFolderId) c.folderId = null;
      });
      project.integrations.forEach((i) => {
        if (i.folderId === selectedFolderId) i.folderId = null;
      });
      set({ project: { ...project }, selectedFolderId: null });
    }
    get().persist();
  },

  moveClass: (id, x, y) => {
    const { project, snapEnabled } = get();
    const cls = project.classes.find((c) => c.id === id);
    if (!cls) return;
    const pos = applySnap(x, y, snapEnabled);
    cls.x = pos.x;
    cls.y = pos.y;
    const folder = findInnermostFolder(pos.x + CARD_WIDTH / 2, pos.y + 40, project.folders);
    cls.folderId = folder?.id ?? null;
    set({ project: { ...project } });
  },

  moveGroupDelta: (dx, dy) => {
    const { project, selectedClassIds, selectedIntegrationIds } = get();
    if (selectedClassIds.length === 0 && selectedIntegrationIds.length === 0) return;
    for (const id of selectedClassIds) {
      const cls = project.classes.find((c) => c.id === id);
      if (!cls) continue;
      cls.x += dx;
      cls.y += dy;
      const folder = findInnermostFolder(cls.x + CARD_WIDTH / 2, cls.y + 40, project.folders);
      cls.folderId = folder?.id ?? null;
    }
    for (const id of selectedIntegrationIds) {
      const intg = project.integrations.find((i) => i.id === id);
      if (!intg) continue;
      intg.x += dx;
      intg.y += dy;
      const folder = findInnermostFolder(
        intg.x + INTEGRATION_WIDTH / 2,
        intg.y + INTEGRATION_HEIGHT / 2,
        project.folders,
      );
      intg.folderId = folder?.id ?? null;
    }
    set({ project: { ...project } });
  },

  moveFolder: (id, dx, dy) => {
    const { project, snapEnabled } = get();
    const folder = project.folders.find((f) => f.id === id);
    if (!folder) return;
    const ndx = snapEnabled ? snapToGrid(dx) : dx;
    const ndy = snapEnabled ? snapToGrid(dy) : dy;
    folder.x += ndx;
    folder.y += ndy;
    for (const c of project.classes) {
      if (c.folderId === id) {
        c.x += ndx;
        c.y += ndy;
      }
    }
    for (const i of project.integrations) {
      if (i.folderId === id) {
        i.x += ndx;
        i.y += ndy;
      }
    }
    set({ project: { ...project } });
  },

  moveIntegration: (id, x, y) => {
    const { project, snapEnabled } = get();
    const intg = project.integrations.find((i) => i.id === id);
    if (!intg) return;
    const pos = applySnap(x, y, snapEnabled);
    intg.x = pos.x;
    intg.y = pos.y;
    const folder = findInnermostFolder(
      pos.x + INTEGRATION_WIDTH / 2,
      pos.y + INTEGRATION_HEIGHT / 2,
      project.folders,
    );
    intg.folderId = folder?.id ?? null;
    set({ project: { ...project } });
  },

  nudgeSelected: (dx, dy) => {
    const { selectedClassIds, selectedIntegrationIds, snapEnabled } = get();
    if (selectedClassIds.length === 0 && selectedIntegrationIds.length === 0) return;
    const step = snapEnabled ? 20 : 8;
    get().moveGroupDelta(dx * step, dy * step);
    get().persist();
  },

  resizeFolder: (id, w, h) => {
    const { project } = get();
    const folder = project.folders.find((f) => f.id === id);
    if (!folder) return;
    folder.width = Math.max(200, w);
    folder.height = Math.max(120, h);
    set({ project: { ...project } });
    get().persist();
  },

  startLinkFromClass: (classId, port) => {
    const cls = get().project.classes.find((c) => c.id === classId);
    if (!cls) return;
    const pos = portPosition(cls, port, cls.members.length);
    set({
      linkDraft: { fromClassId: classId, fromPort: port, x: pos.x, y: pos.y },
      linkHoverTargetId: null,
      linkAwaitingTarget: false,
      selectedRelationId: null,
      statusMessage: 'Потяните линию к целевому классу или сервису и отпустите',
    });
  },

  startLinkFromIntegration: (integrationId, port) => {
    const intg = get().project.integrations.find((i) => i.id === integrationId);
    if (!intg) return;
    const pos = integrationPortPosition(intg, port);
    set({
      linkDraft: { fromIntegrationId: integrationId, fromPort: port, x: pos.x, y: pos.y },
      linkHoverTargetId: null,
      linkAwaitingTarget: false,
      selectedRelationId: null,
      statusMessage: 'Потяните линию к целевому элементу и отпустите',
    });
  },

  updateLinkDraft: (x, y) => {
    const draft = get().linkDraft;
    if (!draft) return;
    const hit = findNodeAt(x, y, get().project);
    const fromId = draft.fromClassId ?? draft.fromIntegrationId;
    const hoverId = hit && hit.id !== fromId ? hit.id : null;
    set({ linkDraft: { ...draft, x, y }, linkHoverTargetId: hoverId });
  },

  setLinkHoverTarget: (id) => set({ linkHoverTargetId: id }),

  completeLinkAt: (worldX, worldY, screenX, screenY) => {
    const { linkDraft, project } = get();
    if (!linkDraft) return;

    const target = findNodeAt(worldX, worldY, project);
    const fromId = linkDraft.fromClassId ?? linkDraft.fromIntegrationId;

    if (!target || target.id === fromId) {
      set({
        linkDraft: null,
        linkHoverTargetId: null,
        linkAwaitingTarget: false,
        statusMessage: target ? 'Нельзя связать элемент с самим собой' : 'Связь отменена',
      });
      return;
    }

    const toPort = nearestPortForNode(target, worldX, worldY);
    const picker = {
      x: screenX,
      y: screenY,
      fromClassId: linkDraft.fromClassId,
      fromIntegrationId: linkDraft.fromIntegrationId,
      toClassId: target.type === 'class' ? target.id : undefined,
      toIntegrationId: target.type === 'integration' ? target.id : undefined,
      fromPort: linkDraft.fromPort,
      toPort,
    };

    set({
      linkDraft: null,
      linkHoverTargetId: null,
      linkAwaitingTarget: false,
      relationPicker: picker,
      statusMessage: 'Выберите тип связи',
    });
  },

  startLinkFromSelected: () => {
    const { selectedClassId, selectedIntegrationId, project } = get();
    if (selectedClassId) {
      const cls = project.classes.find((c) => c.id === selectedClassId);
      if (!cls) return;
      const pos = portPosition(cls, 'east', cls.members.length);
      set({
        linkDraft: { fromClassId: cls.id, fromPort: 'east', x: pos.x, y: pos.y },
        linkAwaitingTarget: true,
        statusMessage: 'Кликните по целевому классу или сервису',
      });
      return;
    }
    if (selectedIntegrationId) {
      const intg = project.integrations.find((i) => i.id === selectedIntegrationId);
      if (!intg) return;
      const pos = integrationPortPosition(intg, 'east');
      set({
        linkDraft: { fromIntegrationId: intg.id, fromPort: 'east', x: pos.x, y: pos.y },
        linkAwaitingTarget: true,
        statusMessage: 'Кликните по целевому элементу',
      });
    }
  },

  cancelLink: () =>
    set({
      linkDraft: null,
      linkHoverTargetId: null,
      linkAwaitingTarget: false,
      relationPicker: null,
    }),

  copySelection: () => {
    const { project, selectedClassIds, selectedIntegrationIds } = get();
    const payload: ClipboardPayload = { classes: [], integrations: [] };
    for (const id of selectedClassIds) {
      const cls = project.classes.find((c) => c.id === id);
      if (cls) payload.classes.push(structuredClone(cls));
    }
    for (const id of selectedIntegrationIds) {
      const intg = project.integrations.find((i) => i.id === id);
      if (intg) payload.integrations.push(structuredClone(intg));
    }
    if (payload.classes.length === 0 && payload.integrations.length === 0) {
      get().setStatus('Нечего копировать — выберите элемент');
      return;
    }
    set({ clipboard: payload });
    get().setStatus(`Скопировано: ${payload.classes.length + payload.integrations.length} (Ctrl+V)`);
  },

  duplicateSelected: () => {
    const { project, selectedClassIds, selectedIntegrationIds, snapEnabled } = get();
    if (selectedClassIds.length === 0 && selectedIntegrationIds.length === 0) return;
    const offset = 48;
    const next = cloneProjectShell(project);
    const newClassIds: string[] = [];
    const newIntgIds: string[] = [];
    const idMap = new Map<string, string>();

    for (const id of selectedClassIds) {
      const src = project.classes.find((c) => c.id === id);
      if (!src) continue;
      const pos = applySnap(src.x + offset, src.y + offset, snapEnabled);
      const cls: ClassDefinition = {
        ...structuredClone(src),
        id: newId(),
        name: `${src.name}Copy`,
        x: pos.x,
        y: pos.y,
        members: src.members.map((m) => ({ ...m, id: newId() })),
      };
      idMap.set(id, cls.id);
      next.classes.push(cls);
      newClassIds.push(cls.id);
    }
    for (const id of selectedIntegrationIds) {
      const src = project.integrations.find((i) => i.id === id);
      if (!src) continue;
      const pos = applySnap(src.x + offset, src.y + offset, snapEnabled);
      const intg: IntegrationDefinition = {
        ...structuredClone(src),
        id: newId(),
        name: `${src.name}Copy`,
        x: pos.x,
        y: pos.y,
      };
      idMap.set(id, intg.id);
      next.integrations.push(intg);
      newIntgIds.push(intg.id);
    }
    const classSel = new Set(selectedClassIds);
    const intgSel = new Set(selectedIntegrationIds);
    for (const r of project.relations) {
      const fromClass = r.fromClassId && classSel.has(r.fromClassId);
      const toClass = r.toClassId && classSel.has(r.toClassId);
      const fromIntg = r.fromIntegrationId && intgSel.has(r.fromIntegrationId);
      const toIntg = r.toIntegrationId && intgSel.has(r.toIntegrationId);
      const fromOk = fromClass || fromIntg;
      const toOk = toClass || toIntg;
      if (!fromOk || !toOk) continue;
      next.relations.push({
        ...r,
        id: newId(),
        fromClassId: r.fromClassId ? idMap.get(r.fromClassId) : undefined,
        toClassId: r.toClassId ? idMap.get(r.toClassId) : undefined,
        fromIntegrationId: r.fromIntegrationId ? idMap.get(r.fromIntegrationId) : undefined,
        toIntegrationId: r.toIntegrationId ? idMap.get(r.toIntegrationId) : undefined,
      });
    }
    set({
      project: next,
      selectedClassIds: newClassIds,
      selectedIntegrationIds: newIntgIds,
      selectedClassId: newClassIds[newClassIds.length - 1] ?? null,
      selectedIntegrationId: newIntgIds[newIntgIds.length - 1] ?? null,
    });
    get().refreshCode();
    get().persist();
    get().setStatus(`Дубликаты: ${newClassIds.length + newIntgIds.length}`);
  },

  pasteClipboard: (worldX, worldY) => {
    const { clipboard, project, snapEnabled } = get();
    if (!clipboard || (clipboard.classes.length === 0 && clipboard.integrations.length === 0)) {
      get().setStatus('Буфер пуст — сначала Ctrl+C');
      return;
    }
    const offset = 48;
    let baseX = worldX ?? 120;
    let baseY = worldY ?? 120;
    if (worldX === undefined && clipboard.classes[0]) {
      baseX = clipboard.classes[0].x + offset;
      baseY = clipboard.classes[0].y + offset;
    } else if (worldX === undefined && clipboard.integrations[0]) {
      baseX = clipboard.integrations[0].x + offset;
      baseY = clipboard.integrations[0].y + offset;
    }
    const pos = applySnap(baseX, baseY, snapEnabled);
    const newClassIds: string[] = [];
    const newIntgIds: string[] = [];
    let cx = pos.x;
    let cy = pos.y;

    for (const src of clipboard.classes) {
      const cls: ClassDefinition = {
        ...structuredClone(src),
        id: newId(),
        name: `${src.name}Copy`,
        x: cx,
        y: cy,
        members: src.members.map((m) => ({ ...m, id: newId() })),
      };
      project.classes.push(cls);
      newClassIds.push(cls.id);
      cx += 24;
      cy += 24;
    }
    for (const src of clipboard.integrations) {
      const intg: IntegrationDefinition = {
        ...structuredClone(src),
        id: newId(),
        name: `${src.name}Copy`,
        x: cx,
        y: cy,
      };
      project.integrations.push(intg);
      newIntgIds.push(intg.id);
      cx += 24;
      cy += 24;
    }
    set({
      project: { ...project },
      selectedClassIds: newClassIds,
      selectedIntegrationIds: newIntgIds,
      selectedClassId: newClassIds[newClassIds.length - 1] ?? null,
      selectedIntegrationId: newIntgIds[newIntgIds.length - 1] ?? null,
    });
    get().persist();
    get().setStatus('Вставлено');
  },

  openContextMenu: (menu) => set({ contextMenu: menu }),
  closeContextMenu: () => set({ contextMenu: null }),

  confirmRelation: (kind) => {
    const { relationPicker, project } = get();
    if (!relationPicker) return;
    const from = relationPicker.fromClassId
      ? project.classes.find((c) => c.id === relationPicker.fromClassId)
      : undefined;
    const to = relationPicker.toClassId
      ? project.classes.find((c) => c.id === relationPicker.toClassId)
      : undefined;
    const rel: RelationDefinition = {
      id: newId(),
      fromClassId: relationPicker.fromClassId,
      toClassId: relationPicker.toClassId,
      fromIntegrationId: relationPicker.fromIntegrationId,
      toIntegrationId: relationPicker.toIntegrationId,
      fromPort: relationPicker.fromPort,
      toPort: relationPicker.toPort,
      kind,
    };
    if (from) applyRelationToModel(rel, from, to, project.language);
    const next = cloneProjectShell(project);
    set({
      project: withRelations(next, [...next.relations, rel]),
      relationPicker: null,
    });
    get().setStatus(`Связь: ${kind}`);
    get().persist();
    get().refreshCode();
  },

  removeRelation: (id) => {
    const { project } = get();
    set({
      project: withRelations(project, project.relations.filter((r) => r.id !== id)),
      selectedRelationId: null,
    });
    get().persist();
  },

  newDiagram: () => {
    void clearProjectStorage();
    const p = createEmptyProject();
    set({
      project: p,
      selectedClassId: null,
      selectedClassIds: [],
      selectedFolderId: null,
      selectedIntegrationId: null,
      selectedIntegrationIds: [],
      selectedRelationId: null,
      codePreview: '',
    });
    queueMicrotask(() => useDiagramStore.temporal.getState().clear());
    get().setStatus('Новая схема');
  },

  loadProject: (p) => {
    set({
      project: p,
      selectedClassId: null,
      selectedClassIds: [],
      selectedFolderId: null,
      selectedIntegrationId: null,
      selectedIntegrationIds: [],
      selectedRelationId: null,
    });
    get().refreshCode();
    get().persist();
    queueMicrotask(() => useDiagramStore.temporal.getState().clear());
    get().setStatus('Схема загружена');
  },

  exportJson: () => {
    downloadJson(get().project);
    get().setStatus('JSON экспортирован');
  },

  setShowHelp: (v) => set({ showHelp: v }),
  setShowImport: (v) => set({ showImport: v }),

  persist: () => {
    void saveProject(get().project);
  },

  refreshCode: () => {
    const { project, selectedClassId } = get();
    const cls = project.classes.find((c) => c.id === selectedClassId);
    set({ codePreview: cls ? generateClassCode(cls, project) : '// Выберите класс на схеме' });
  },
    }),
    {
      partialize: (state) => ({ project: state.project }),
      limit: 100,
      equality: (a, b) => projectFingerprint(a.project) === projectFingerprint(b.project),
      handleSet: (handleSet) => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        return ((...args: Parameters<typeof handleSet>) => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => handleSet(...args), 300);
        }) as typeof handleSet;
      },
    },
  ),
);
