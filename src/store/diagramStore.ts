import { create } from 'zustand';
import { generateClassCode } from '../services/codeGenerator';
import {
  clearLocalStorage,
  downloadJson,
  loadFromLocalStorage,
  saveToLocalStorage,
} from '../services/storage';
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
import { findNodeAt, nearestPortForNode } from '../utils/hitTest';
import { cloneProjectShell, withRelations } from '../utils/projectClone';
import { newId } from '../utils/id';
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
  selectedClassId: string | null;
  selectedFolderId: string | null;
  selectedIntegrationId: string | null;
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
  setTheme: (t: AppTheme) => void;
  setStatus: (msg: string) => void;
  setSnapEnabled: (v: boolean) => void;
  setZoom: (z: number) => void;
  zoomAt: (screenX: number, screenY: number, factor: number) => void;
  setPan: (x: number, y: number) => void;
  centerOn: (worldX: number, worldY: number, width?: number, height?: number) => void;
  selectClass: (id: string | null) => void;
  selectFolder: (id: string | null) => void;
  selectIntegration: (id: string | null) => void;
  selectRelation: (id: string | null) => void;
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

function defaultProject(): ProjectModel {
  return loadFromLocalStorage() ?? createEmptyProject();
}

function applySnap(x: number, y: number, enabled: boolean): { x: number; y: number } {
  if (!enabled) return { x, y };
  return { x: snapToGrid(x), y: snapToGrid(y) };
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  project: defaultProject(),
  theme: (localStorage.getItem('as-theme') as AppTheme) || 'dark',
  zoom: 1,
  panX: 48,
  panY: 48,
  snapEnabled: localStorage.getItem('as-snap') !== 'false',
  selectedClassId: null,
  selectedFolderId: null,
  selectedIntegrationId: null,
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

  selectClass: (id) => {
    set({
      selectedClassId: id,
      selectedFolderId: null,
      selectedIntegrationId: null,
      selectedRelationId: null,
      rightTab: id ? 'class' : get().rightTab,
    });
    get().refreshCode();
  },

  selectFolder: (id) =>
    set({
      selectedFolderId: id,
      selectedClassId: null,
      selectedIntegrationId: null,
      selectedRelationId: null,
    }),

  selectIntegration: (id) => {
    set({
      selectedIntegrationId: id,
      selectedClassId: null,
      selectedFolderId: null,
      selectedRelationId: null,
      rightTab: id ? 'integration' : get().rightTab,
    });
  },

  selectRelation: (id) =>
    set({
      selectedRelationId: id,
      selectedClassId: null,
      selectedFolderId: null,
      selectedIntegrationId: null,
    }),

  setRightTab: (tab) => {
    set({ rightTab: tab });
    if (tab === 'code') get().refreshCode();
  },

  setLanguage: (lang) => {
    set((s) => ({ project: { ...s.project, language: lang } }));
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
    set({ project: { ...project }, selectedClassId: cls.id });
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
    set({ project: { ...project }, selectedIntegrationId: intg.id, rightTab: 'integration' });
    get().persist();
  },

  updateClass: (id, patch) => {
    const { project } = get();
    const idx = project.classes.findIndex((c) => c.id === id);
    if (idx < 0) return;
    project.classes[idx] = { ...project.classes[idx], ...patch };
    if (patch.name) project.classes[idx].name = sanitizeName(patch.name);
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
      selectedClassId,
      selectedFolderId,
      selectedIntegrationId,
      selectedRelationId,
    } = get();
    if (selectedRelationId) {
      set({
        project: withRelations(project, project.relations.filter((r) => r.id !== selectedRelationId)),
        selectedRelationId: null,
      });
    } else if (selectedClassId) {
      set({
        project: {
          ...cloneProjectShell(project),
          classes: project.classes.filter((c) => c.id !== selectedClassId),
          relations: project.relations.filter(
            (r) => r.fromClassId !== selectedClassId && r.toClassId !== selectedClassId,
          ),
        },
        selectedClassId: null,
        codePreview: '',
      });
    } else if (selectedIntegrationId) {
      set({
        project: {
          ...cloneProjectShell(project),
          integrations: project.integrations.filter((i) => i.id !== selectedIntegrationId),
          relations: project.relations.filter(
            (r) =>
              r.fromIntegrationId !== selectedIntegrationId &&
              r.toIntegrationId !== selectedIntegrationId,
          ),
        },
        selectedIntegrationId: null,
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
    const { selectedClassId, selectedIntegrationId, snapEnabled } = get();
    const step = snapEnabled ? 20 : 8;
    const ndx = dx * step;
    const ndy = dy * step;
    if (selectedClassId) {
      const cls = get().project.classes.find((c) => c.id === selectedClassId);
      if (cls) {
        get().moveClass(selectedClassId, cls.x + ndx, cls.y + ndy);
        get().persist();
      }
    } else if (selectedIntegrationId) {
      const intg = get().project.integrations.find((i) => i.id === selectedIntegrationId);
      if (intg) {
        get().moveIntegration(selectedIntegrationId, intg.x + ndx, intg.y + ndy);
        get().persist();
      }
    }
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
    const { project, selectedClassId, selectedIntegrationId } = get();
    const payload: ClipboardPayload = { classes: [], integrations: [] };
    if (selectedClassId) {
      const cls = project.classes.find((c) => c.id === selectedClassId);
      if (cls) payload.classes.push(structuredClone(cls));
    }
    if (selectedIntegrationId) {
      const intg = project.integrations.find((i) => i.id === selectedIntegrationId);
      if (intg) payload.integrations.push(structuredClone(intg));
    }
    if (payload.classes.length === 0 && payload.integrations.length === 0) {
      get().setStatus('Нечего копировать — выберите элемент');
      return;
    }
    set({ clipboard: payload });
    get().setStatus('Скопировано в буфер (Ctrl+V)');
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

    for (const src of clipboard.classes) {
      const cls: ClassDefinition = {
        ...structuredClone(src),
        id: newId(),
        name: `${src.name}Copy`,
        x: pos.x,
        y: pos.y,
        members: src.members.map((m) => ({ ...m, id: newId() })),
      };
      project.classes.push(cls);
      set({ selectedClassId: cls.id, selectedIntegrationId: null });
    }
    for (const src of clipboard.integrations) {
      const intg: IntegrationDefinition = {
        ...structuredClone(src),
        id: newId(),
        name: `${src.name}Copy`,
        x: pos.x + 40,
        y: pos.y + 40,
      };
      project.integrations.push(intg);
      set({ selectedIntegrationId: intg.id, selectedClassId: null });
    }
    set({ project: { ...project } });
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
    clearLocalStorage();
    const p = createEmptyProject();
    set({
      project: p,
      selectedClassId: null,
      selectedFolderId: null,
      selectedIntegrationId: null,
      selectedRelationId: null,
      codePreview: '',
    });
    get().setStatus('Новая схема');
  },

  loadProject: (p) => {
    set({
      project: p,
      selectedClassId: null,
      selectedFolderId: null,
      selectedIntegrationId: null,
      selectedRelationId: null,
    });
    get().refreshCode();
    get().persist();
    get().setStatus('Схема загружена');
  },

  exportJson: () => {
    downloadJson(get().project);
    get().setStatus('JSON экспортирован');
  },

  setShowHelp: (v) => set({ showHelp: v }),
  setShowImport: (v) => set({ showImport: v }),

  persist: () => saveToLocalStorage(get().project),

  refreshCode: () => {
    const { project, selectedClassId } = get();
    const cls = project.classes.find((c) => c.id === selectedClassId);
    set({ codePreview: cls ? generateClassCode(cls, project) : '// Выберите класс на схеме' });
  },
}));
