export type TargetLanguage = 'csharp' | 'java' | 'python';
export type AppTheme = 'dark' | 'light';
export type ConnectionPort = 'north' | 'east' | 'south' | 'west';

export type RelationKind =
  | 'inherits'
  | 'implements'
  | 'uses'
  | 'aggregates'
  | 'composes'
  | 'fieldReference'
  | 'methodReference'
  | 'usingImport'
  | 'dependsOn'
  | 'integrates'
  | 'callsApi'
  | 'publishes'
  | 'subscribes';

export type IntegrationKind =
  | 'rest'
  | 'grpc'
  | 'graphql'
  | 'messageQueue'
  | 'database'
  | 'cache'
  | 'auth'
  | 'storage'
  | 'custom';

export type MemberKind = 'field' | 'property' | 'method' | 'constructor';
export type AccessModifier = 'public' | 'private' | 'protected' | 'internal';

export type ClassRole =
  | 'none'
  | 'interface'
  | 'view'
  | 'presenter'
  | 'viewModel'
  | 'model'
  | 'controller'
  | 'repository'
  | 'entity'
  | 'service'
  | 'factory'
  | 'strategy'
  | 'command'
  | 'adapter'
  | 'singleton'
  | 'observer'
  | 'decorator'
  | 'facade'
  | 'proxy'
  | 'builder'
  | 'dto'
  | 'logger'
  | 'handler';

export interface ParameterDefinition {
  name: string;
  type: string;
  defaultValue?: string;
}

export interface MemberDefinition {
  id: string;
  kind: MemberKind;
  name: string;
  type: string;
  returnType: string;
  access: AccessModifier;
  isStatic?: boolean;
  isAbstract?: boolean;
  isVirtual?: boolean;
  isReadOnly?: boolean;
  generateStub?: boolean;
  description?: string;
  defaultValue?: string;
  parameters: ParameterDefinition[];
}

export interface ClassDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
  namespace: string;
  package: string;
  folderId: string | null;
  role: ClassRole;
  access: AccessModifier;
  isInterface: boolean;
  isAbstract: boolean;
  isEnum: boolean;
  isSealed: boolean;
  isStatic: boolean;
  isRecord: boolean;
  baseType: string;
  implementedInterfaces: string[];
  usings: string[];
  summary: string;
  members: MemberDefinition[];
}

export interface FolderDefinition {
  id: string;
  name: string;
  segment: string;
  x: number;
  y: number;
  width: number;
  height: number;
  parentFolderId: string | null;
}

export interface IntegrationDefinition {
  id: string;
  name: string;
  kind: IntegrationKind;
  endpoint: string;
  description: string;
  protocol: string;
  authType: string;
  x: number;
  y: number;
  folderId: string | null;
  tags: string[];
}

export interface RelationDefinition {
  id: string;
  fromClassId?: string;
  toClassId?: string;
  fromIntegrationId?: string;
  toIntegrationId?: string;
  kind: RelationKind;
  fromPort?: ConnectionPort;
  toPort?: ConnectionPort;
  memberName?: string;
  createNewMember?: boolean;
  label?: string;
}

export interface ProjectModel {
  name: string;
  language: TargetLanguage;
  defaultNamespace: string;
  defaultPackage: string;
  defaultModule: string;
  folders: FolderDefinition[];
  classes: ClassDefinition[];
  integrations: IntegrationDefinition[];
  relations: RelationDefinition[];
}

export interface PatternTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  folders?: TemplateFolder[];
  classes: TemplateClass[];
  relations: TemplateRelation[];
}

export interface TemplateFolder {
  name: string;
  segment?: string;
  parent?: string;
  offsetX: number;
  offsetY: number;
  width?: number;
  height?: number;
}

export interface TemplateClass {
  name: string;
  role?: string;
  folder?: string;
  offsetX: number;
  offsetY: number;
  isInterface?: boolean;
  isAbstract?: boolean;
  baseType?: string;
  implements?: string[];
  usings?: string[];
  members?: TemplateMember[];
}

export interface TemplateMember {
  kind: string;
  name: string;
  type?: string;
  returnType?: string;
  access?: string;
  isAbstract?: boolean;
  isStatic?: boolean;
  generateStub?: boolean;
  parameters?: { name: string; type: string }[];
}

export interface TemplateRelation {
  from: string;
  to: string;
  kind: string;
}

export const SCHEMA_VERSION = 2;
export const GRID_SIZE = 20;
export const MAX_PROJECT_BYTES = 2_000_000;
export const MAX_CLASSES = 200;
export const MAX_RELATIONS = 500;
