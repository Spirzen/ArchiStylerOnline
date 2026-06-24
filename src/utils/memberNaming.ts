import type { MemberDefinition, TargetLanguage } from '../types/models';
import { newId } from './id';

/** Имя члена-конструктора в модели (для отображения и хранения). */
export function constructorMemberName(className: string, lang: TargetLanguage): string {
  return lang === 'python' ? '__init__' : className;
}

export function normalizeConstructorMember(
  member: MemberDefinition,
  className: string,
  lang: TargetLanguage,
): MemberDefinition {
  if (member.kind !== 'constructor') return member;
  return {
    ...member,
    name: constructorMemberName(className, lang),
    returnType: '',
    isStatic: false,
    isAbstract: false,
    isVirtual: false,
  };
}

export function normalizeClassMembers(
  members: MemberDefinition[],
  className: string,
  lang: TargetLanguage,
): MemberDefinition[] {
  return members.map((m) => normalizeConstructorMember(m, className, lang));
}

export function createConstructorMember(
  className: string,
  lang: TargetLanguage,
  access: MemberDefinition['access'] = 'public',
): MemberDefinition {
  return {
    id: newId(),
    kind: 'constructor',
    name: constructorMemberName(className, lang),
    type: '',
    returnType: '',
    access,
    parameters: [],
    generateStub: true,
  };
}

export function defaultMethodName(lang: TargetLanguage): string {
  if (lang === 'python') return 'run';
  return 'execute';
}

export function defaultFieldName(lang: TargetLanguage): string {
  return lang === 'python' ? '_value' : '_value';
}

export function defaultObjectType(lang: TargetLanguage): string {
  if (lang === 'python') return 'Any';
  if (lang === 'java') return 'Object';
  return 'object';
}
