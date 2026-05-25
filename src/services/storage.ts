import { SCHEMA_VERSION, type ProjectModel } from '../types/models';
import { validateProject } from './validation';

const STORAGE_KEY = 'archistyler-online-v1';

export function saveToLocalStorage(project: ProjectModel): void {
  try {
    const payload = { schemaVersion: SCHEMA_VERSION, ...project, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function loadFromLocalStorage(): ProjectModel | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return validateProject(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearLocalStorage(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportProjectJson(project: ProjectModel): string {
  return JSON.stringify({ schemaVersion: SCHEMA_VERSION, ...project }, null, 2);
}

export function importProjectJson(text: string): ProjectModel | null {
  try {
    const data = JSON.parse(text);
    return validateProject(data);
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
