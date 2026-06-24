import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';
import { SCHEMA_VERSION, type ProjectModel } from '../types/models';
import { validateProject } from './validation';

const STORAGE_KEY = 'archistyler-online-v1';
const LEGACY_LS_KEY = 'archistyler-online-v1';

function serializeProject(project: ProjectModel): string {
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...project, savedAt: Date.now() });
}

export async function saveProject(project: ProjectModel): Promise<void> {
  try {
    await idbSet(STORAGE_KEY, serializeProject(project));
  } catch {
    /* quota */
  }
}

export async function loadProject(): Promise<ProjectModel | null> {
  try {
    const idbRaw = await idbGet<string>(STORAGE_KEY);
    if (idbRaw) {
      const parsed = validateProject(JSON.parse(idbRaw));
      if (parsed) return parsed;
    }
  } catch {
    /* fall through */
  }

  try {
    const lsRaw = localStorage.getItem(LEGACY_LS_KEY);
    if (!lsRaw) return null;
    const parsed = validateProject(JSON.parse(lsRaw));
    if (parsed) {
      await saveProject(parsed);
      localStorage.removeItem(LEGACY_LS_KEY);
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearProjectStorage(): Promise<void> {
  try {
    await idbDel(STORAGE_KEY);
  } catch {
    /* ok */
  }
  localStorage.removeItem(LEGACY_LS_KEY);
}

/** @deprecated use saveProject */
export function saveToLocalStorage(project: ProjectModel): void {
  void saveProject(project);
}

/** @deprecated use loadProject */
export function loadFromLocalStorage(): ProjectModel | null {
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    if (!raw) return null;
    return validateProject(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** @deprecated use clearProjectStorage */
export function clearLocalStorage(): void {
  void clearProjectStorage();
}

export function exportProjectJson(project: ProjectModel): string {
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...project }, null, 2);
}

export function importProjectJson(text: string): ProjectModel | null {
  try {
    return validateProject(JSON.parse(text));
  } catch {
    return null;
  }
}

export function downloadJson(project: ProjectModel, filename?: string): void {
  const blob = new Blob([exportProjectJson(project)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename ?? project.name}.archistyler.json`;
  a.click();
  URL.revokeObjectURL(url);
}
