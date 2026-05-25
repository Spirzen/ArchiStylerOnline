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
  PatternTemplate,
  ProjectModel,
  RelationDefinition,
  RelationKind,
  TargetLanguage,
} from '../types/models';
import { findInnermostFolder, portPosition } from '../utils/diagramGeometry';
import { newId } from '../utils/id';
import { applyRelationToModel } from '../utils/relationKind';
import { clampZoom, zoomAtPoint } from '../utils/viewport';

interface LinkDraft {
  fromClassId: string;
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
  selectedClassId: string | null;
  selectedFolderId: string | null;
  selectedRelationId: string | null;
  linkDraft: LinkDraft | null;
  relationPicker: { x: number; y: number; fromId: string; toId: string } | null;
  statusMessage: string;
  patterns: PatternTemplate[];
  selectedPatternId: string;
  rightTab: 'class' | 'code';
  codePreview: string;
  showHelp: boolean;
  showImport: boolean;

  init: (patterns: PatternTemplate[]) => void;
  setTheme: (t: AppTheme) => void;
  setStatus: (msg: string) => void;
  setZoom: (z: number) => void;
  zoomAt: (screenX: number, screenY: number, factor: number) => void;
  setPan: (x: number, y: number) => void;
  selectClass: (id: string | null) => void;
  selectFolder: (id: string | null) => void;
  selectRelation: (id: string | null) => void;
  setRightTab: (tab: 'class' | 'code') => void;
  setLanguage: (lang: TargetLanguage) => void;
  setProjectName: (name: string) => void;
  setSelectedPattern: (id: string) => void;
  applySelectedPattern: () => void;
  addClass: (name?: string) => void;
  addFolder: () => void;
  updateClass: (id: string, patch: Partial<ClassDefinition>) => void;
  updateFolder: (id: string, patch: Partial<FolderDefinition>) => void;
  deleteSelected: () => void;
  moveClass: (id: string, x: number, y: number) => void;
  moveFolder: (id: string, x: number, y: number) => void;
  resizeFolder: (id: string, w: number, h: number) => void;
  startLink: (classId: string, port: ConnectionPort) => void;
  updateLinkDraft: (x: number, y: number) => void;
  finishLinkOnClass: (toClassId: string, x: number, y: number) => void;
  cancelLink: () => void;
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

export const useDiagramStore = create<DiagramState>((set, get) => ({
  project: defaultProject(),
  theme: (localStorage.getItem('as-theme') as AppTheme) || 'dark',
  zoom: 1,
  panX: 48,
  panY: 48,
  selectedClassId: null,
  selectedFolderId: null,
  selectedRelationId: null,
  linkDraft: null,
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
  setZoom: (z) => set({ zoom: clampZoom(z) }),
  zoomAt: (screenX, screenY, factor) => {
    const { zoom, panX, panY } = get();
    const newZoom = clampZoom(zoom * factor);
    const pan = zoomAtPoint(panX, panY, zoom, screenX, screenY, newZoom);
    set({ zoom: newZoom, panX: pan.panX, panY: pan.panY });
  },
  setPan: (x, y) => set({ panX: x, panY: y }),

  selectClass: (id) => {
    set({
      selectedClassId: id,
      selectedFolderId: null,
      selectedRelationId: null,
      rightTab: id ? 'class' : get().rightTab,
    });
    get().refreshCode();
  },

  selectFolder: (id) =>
    set({ selectedFolderId: id, selectedClassId: null, selectedRelationId: null }),

  selectRelation: (id) =>
    set({ selectedRelationId: id, selectedClassId: null, selectedFolderId: null }),

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
    set({ project: { ...project } });
    get().setStatus(`Паттерн «${pattern.name}» добавлен на схему`);
    get().persist();
  },

  addClass: (name) => {
    const { project } = get();
    const n = project.classes.length + 1;
    const cls: ClassDefinition = {
      id: newId(),
      name: sanitizeName(name ?? `Class${n}`) || `Class${n}`,
      x: 120 + (n % 5) * 40,
      y: 120 + Math.floor(n / 5) * 160,
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

  deleteSelected: () => {
    const { project, selectedClassId, selectedFolderId, selectedRelationId } = get();
    if (selectedRelationId) {
      project.relations = project.relations.filter((r) => r.id !== selectedRelationId);
      set({ project: { ...project }, selectedRelationId: null });
    } else if (selectedClassId) {
      project.classes = project.classes.filter((c) => c.id !== selectedClassId);
      project.relations = project.relations.filter(
        (r) => r.fromClassId !== selectedClassId && r.toClassId !== selectedClassId,
      );
      set({ project: { ...project }, selectedClassId: null, codePreview: '' });
    } else if (selectedFolderId) {
      project.folders = project.folders.filter((f) => f.id !== selectedFolderId);
      project.classes.forEach((c) => {
        if (c.folderId === selectedFolderId) c.folderId = null;
      });
      set({ project: { ...project }, selectedFolderId: null });
    }
    get().persist();
  },

  moveClass: (id, x, y) => {
    const { project } = get();
    const cls = project.classes.find((c) => c.id === id);
    if (!cls) return;
    cls.x = x;
    cls.y = y;
    const folder = findInnermostFolder(x + 100, y + 40, project.folders);
    cls.folderId = folder?.id ?? null;
    set({ project: { ...project } });
  },

  moveFolder: (id, dx, dy) => {
    const { project } = get();
    const folder = project.folders.find((f) => f.id === id);
    if (!folder) return;
    const ox = folder.x;
    const oy = folder.y;
    folder.x += dx;
    folder.y += dy;
    for (const c of project.classes) {
      if (c.folderId === id) {
        c.x += dx;
        c.y += dy;
      }
    }
    set({ project: { ...project } });
    void ox;
    void oy;
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

  startLink: (classId, port) => {
    const cls = get().project.classes.find((c) => c.id === classId);
    if (!cls) return;
    const pos = portPosition(cls, port, cls.members.length);
    set({
      linkDraft: { fromClassId: classId, fromPort: port, x: pos.x, y: pos.y },
      selectedRelationId: null,
    });
  },

  updateLinkDraft: (x, y) => {
    const draft = get().linkDraft;
    if (!draft) return;
    set({ linkDraft: { ...draft, x, y } });
  },

  finishLinkOnClass: (toClassId, x, y) => {
    const { linkDraft, project } = get();
    if (!linkDraft || linkDraft.fromClassId === toClassId) {
      set({ linkDraft: null });
      return;
    }
    set({
      linkDraft: null,
      relationPicker: { x, y, fromId: linkDraft.fromClassId, toId: toClassId },
    });
    void project;
  },

  cancelLink: () => set({ linkDraft: null, relationPicker: null }),

  confirmRelation: (kind) => {
    const { relationPicker, project } = get();
    if (!relationPicker) return;
    const from = project.classes.find((c) => c.id === relationPicker.fromId)!;
    const to = project.classes.find((c) => c.id === relationPicker.toId)!;
    const rel: RelationDefinition = {
      id: newId(),
      fromClassId: from.id,
      toClassId: to.id,
      kind,
    };
    applyRelationToModel(rel, from, to, project.language);
    project.relations.push(rel);
    set({ project: { ...project }, relationPicker: null });
    get().setStatus(`Связь: ${kind}`);
    get().persist();
  },

  removeRelation: (id) => {
    const { project } = get();
    project.relations = project.relations.filter((r) => r.id !== id);
    set({ project: { ...project }, selectedRelationId: null });
    get().persist();
  },

  newDiagram: () => {
    clearLocalStorage();
    const p = createEmptyProject();
    set({
      project: p,
      selectedClassId: null,
      selectedFolderId: null,
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
