import type { ProjectModel, RelationDefinition } from '../types/models';

/** Новая ссылка на project и ключевые массивы — чтобы React/memo увидели изменения. */
export function cloneProjectShell(project: ProjectModel): ProjectModel {
  return {
    ...project,
    folders: [...project.folders],
    classes: [...project.classes],
    integrations: [...project.integrations],
    relations: [...project.relations],
  };
}

export function withRelations(project: ProjectModel, relations: RelationDefinition[]): ProjectModel {
  return { ...cloneProjectShell(project), relations };
}
