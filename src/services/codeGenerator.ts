import type { ClassDefinition, MemberDefinition, ProjectModel, TargetLanguage } from '../types/models';
import { constructorMemberName } from '../utils/memberNaming';

function fmtAccess(a: string, lang: TargetLanguage): string {
  const map: Record<string, Record<TargetLanguage, string>> = {
    public: { csharp: 'public', java: 'public', python: '' },
    private: { csharp: 'private', java: 'private', python: '' },
    protected: { csharp: 'protected', java: 'protected', python: '' },
    internal: { csharp: 'internal', java: '', python: '' },
  };
  return map[a]?.[lang] ?? '';
}

function pythonAccessPrefix(a: string): string {
  if (a === 'private') return '__';
  if (a === 'protected') return '_';
  return '';
}

function mapType(t: string, lang: TargetLanguage): string {
  const raw = t?.trim() || '';
  if (!raw) {
    if (lang === 'python') return 'Any';
    if (lang === 'java') return 'Object';
    return 'object';
  }
  if (lang === 'java') {
    const java: Record<string, string> = {
      string: 'String',
      String: 'String',
      bool: 'boolean',
      boolean: 'boolean',
      int: 'int',
      void: 'void',
      object: 'Object',
      Object: 'Object',
    };
    return java[raw] ?? raw;
  }
  if (lang === 'python') {
    const py: Record<string, string> = {
      string: 'str',
      String: 'str',
      bool: 'bool',
      boolean: 'bool',
      int: 'int',
      void: 'None',
      object: 'Any',
      Object: 'Any',
    };
    return py[raw] ?? raw;
  }
  const cs: Record<string, string> = {
    String: 'string',
    string: 'string',
    boolean: 'bool',
    bool: 'bool',
    int: 'int',
    void: 'void',
    object: 'object',
  };
  return cs[raw] ?? raw;
}

function stubBody(m: MemberDefinition, lang: TargetLanguage): string {
  if (!m.generateStub) return lang === 'python' ? '        pass' : '        // TODO';
  const r = m.returnType || 'void';
  if (m.kind === 'constructor') return lang === 'python' ? '        pass' : '        // TODO';
  if (r === 'void' || r === 'None') return lang === 'python' ? '        pass' : '        // TODO';
  if (r === 'bool' || r === 'boolean') return lang === 'python' ? '        return False' : '        return false;';
  if (r === 'int') return lang === 'python' ? '        return 0' : '        return 0;';
  if (r === 'string' || r === 'String' || r === 'str')
    return lang === 'python' ? "        return ''" : "        return string.Empty;";
  if (lang === 'python') return '        raise NotImplementedError()';
  if (lang === 'java') return '        throw new UnsupportedOperationException();';
  return '        throw new NotImplementedException();';
}

function effectiveNs(cls: ClassDefinition, project: ProjectModel): string {
  if (project.language === 'python') {
    return cls.package || project.defaultModule || project.defaultPackage;
  }
  return project.language === 'csharp'
    ? cls.namespace || project.defaultNamespace
    : cls.package || project.defaultPackage;
}

function usesTypingAny(cls: ClassDefinition): boolean {
  const types = [
    ...cls.members.map((m) => m.type),
    ...cls.members.map((m) => m.returnType),
    ...cls.members.flatMap((m) => m.parameters.map((p) => p.type)),
  ];
  return types.some((t) => mapType(t, 'python') === 'Any');
}

function pythonImports(cls: ClassDefinition): string[] {
  const lines: string[] = [];
  const needsAbc =
    cls.isAbstract || cls.isInterface || cls.members.some((m) => m.isAbstract && m.kind !== 'field');
  if (needsAbc) lines.push('from abc import ABC, abstractmethod');
  if (usesTypingAny(cls)) lines.push('from typing import Any');
  return lines;
}

function sortMembersForDisplay(members: MemberDefinition[], lang: TargetLanguage): MemberDefinition[] {
  if (lang !== 'python') return members;
  return [...members].sort((a, b) => {
    const aCtor = a.kind === 'constructor' ? 0 : 1;
    const bCtor = b.kind === 'constructor' ? 0 : 1;
    return aCtor - bCtor;
  });
}

export function generateClassCode(cls: ClassDefinition, project: ProjectModel): string {
  switch (project.language) {
    case 'csharp':
      return generateCSharp(cls, project);
    case 'java':
      return generateJava(cls, project);
    case 'python':
      return generatePython(cls, project);
  }
}

function generateCSharp(cls: ClassDefinition, project: ProjectModel): string {
  const lines: string[] = [];
  for (const u of [...new Set(cls.usings)].sort()) lines.push(`using ${u};`);
  if (lines.length) lines.push('');
  lines.push(`namespace ${effectiveNs(cls, project)};`, '');
  if (cls.summary) lines.push(`/// <summary>${cls.summary}</summary>`);

  lines.push(`${buildDecl(cls, 'csharp')}`, '{');
  if (cls.isEnum) {
    for (const m of cls.members) lines.push(`    ${m.name},`);
  } else {
    for (const m of cls.members) lines.push(memberCSharp(cls, m));
  }
  lines.push('}');
  return lines.join('\n');
}

function generateJava(cls: ClassDefinition, project: ProjectModel): string {
  const lines: string[] = [`package ${effectiveNs(cls, project)};`, ''];
  for (const u of [...new Set(cls.usings)].sort()) lines.push(`import ${u};`);
  if (cls.usings.length) lines.push('');
  if (cls.summary) lines.push(`/** ${cls.summary} */`, '');
  lines.push(`${buildDecl(cls, 'java')} {`);
  if (cls.isEnum) {
    for (const m of cls.members) lines.push(`    ${m.name},`);
  } else {
    for (const m of cls.members) lines.push(memberJava(cls, m));
  }
  lines.push('}');
  return lines.join('\n');
}

function generatePython(cls: ClassDefinition, project: ProjectModel): string {
  const lines: string[] = [];
  const mod = effectiveNs(cls, project);
  if (mod) lines.push(`# module: ${mod}`, '');

  for (const imp of pythonImports(cls)) lines.push(imp);
  if (pythonImports(cls).length) lines.push('');

  for (const u of [...new Set(cls.usings)].sort()) {
    if (u.startsWith('from ') || u.startsWith('import ')) lines.push(u);
    else lines.push(`from ${u} import *`);
  }
  if (cls.usings.length) lines.push('');

  if (cls.summary) lines.push(`"""${cls.summary}"""`, '');

  if (cls.isEnum) {
    lines.push('from enum import Enum', '', `class ${cls.name}(Enum):`);
    for (const m of cls.members) lines.push(`    ${m.name} = "${m.name}"`);
    return lines.join('\n');
  }

  const bases: string[] = [];
  const needsAbc = cls.isAbstract || cls.isInterface || cls.members.some((m) => m.isAbstract);
  if (needsAbc) bases.push('ABC');
  if (cls.baseType) bases.push(cls.baseType);
  bases.push(...cls.implementedInterfaces);
  const basePart = bases.length ? `(${bases.join(', ')})` : '';
  lines.push(`class ${cls.name}${basePart}:`);

  const members = sortMembersForDisplay(cls.members, 'python');
  if (members.length === 0) {
    lines.push('    pass');
    return lines.join('\n');
  }
  for (const m of members) lines.push(memberPython(cls, m));
  return lines.join('\n');
}

function buildDecl(cls: ClassDefinition, lang: TargetLanguage): string {
  const parts: string[] = [fmtAccess(cls.access, lang)].filter(Boolean);
  if (cls.isStatic && lang === 'csharp') parts.push('static');
  if (cls.isSealed && lang === 'csharp') parts.push('sealed');
  if (cls.isAbstract && !cls.isInterface) parts.push('abstract');
  if (cls.isInterface) parts.push('interface');
  else if (cls.isEnum) parts.push('enum');
  else if (cls.isRecord && lang === 'csharp') parts.push('record');
  else parts.push('class');
  parts.push(cls.name);

  const inh: string[] = [];
  if (cls.baseType) inh.push(cls.baseType);
  inh.push(...cls.implementedInterfaces);

  if (inh.length) {
    if (lang === 'java' && !cls.isInterface && cls.baseType && cls.implementedInterfaces.length) {
      parts.push(`extends ${cls.baseType} implements ${cls.implementedInterfaces.join(', ')}`);
    } else if (lang === 'java' && !cls.isInterface && cls.baseType) {
      parts.push(`extends ${cls.baseType}`);
    } else if (lang === 'java') {
      parts.push(`${cls.isInterface ? 'extends' : 'implements'} ${inh.join(', ')}`);
    } else {
      parts.push(`: ${inh.join(', ')}`);
    }
  }
  return parts.join(' ');
}

function formatParams(
  params: MemberDefinition['parameters'],
  lang: TargetLanguage,
  includeSelf = false,
): string {
  const mapped = params.map((p) => {
    const t = mapType(p.type, lang);
    if (lang === 'python') {
      const def = p.defaultValue ? ` = ${p.defaultValue}` : '';
      return `${p.name}: ${t}${def}`;
    }
    if (lang === 'java') return `${t} ${p.name}`;
    return `${t} ${p.name}`;
  });
  if (lang === 'python' && includeSelf) {
    return mapped.length ? `self, ${mapped.join(', ')}` : 'self';
  }
  return mapped.join(', ');
}

function memberCSharp(cls: ClassDefinition, m: MemberDefinition): string {
  const acc = fmtAccess(m.access, 'csharp');
  const t = mapType(m.type, 'csharp');
  const ret = mapType(m.returnType, 'csharp');
  const doc = m.description ? `    /// ${m.description}\n` : '';
  switch (m.kind) {
    case 'field':
      return `${doc}    ${acc}${m.isStatic ? ' static' : ''}${m.isReadOnly ? ' readonly' : ''} ${t} ${m.name}${m.defaultValue ? ` = ${m.defaultValue}` : ''};`;
    case 'property':
      return `${doc}    ${acc}${m.isStatic ? ' static' : ''}${m.isVirtual ? ' virtual' : ''}${m.isAbstract ? ' abstract' : ''} ${t} ${m.name} { get; set; }`;
    case 'constructor': {
      const pars = formatParams(m.parameters, 'csharp');
      const head = acc ? `${acc} ` : '';
      return `${doc}    ${head}${cls.name}(${pars})\n    {\n${stubBody(m, 'csharp')}\n    }`;
    }
    default: {
      const pars = formatParams(m.parameters, 'csharp');
      if (m.isAbstract) return `${doc}    ${acc} abstract ${ret} ${m.name}(${pars});`;
      return `${doc}    ${acc}${m.isStatic ? ' static' : ''} ${ret} ${m.name}(${pars})\n    {\n${stubBody(m, 'csharp')}\n    }`;
    }
  }
}

function javaGetterName(name: string, type: string): string {
  if (type === 'boolean' && name.startsWith('is') && name.length > 2) return name;
  if (type === 'boolean') return `is${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  return `get${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

function memberJava(cls: ClassDefinition, m: MemberDefinition): string {
  const acc = fmtAccess(m.access, 'java');
  const t = mapType(m.type, 'java');
  const ret = mapType(m.returnType, 'java');
  const doc = m.description ? `    /** ${m.description} */\n` : '';
  switch (m.kind) {
    case 'field':
      return `${doc}    ${acc}${m.isStatic ? ' static' : ''}${m.isReadOnly ? ' final' : ''} ${t} ${m.name}${m.defaultValue ? ` = ${m.defaultValue}` : ''};`;
    case 'property': {
      const fieldName = m.name.charAt(0).toLowerCase() + m.name.slice(1);
      const getter = javaGetterName(m.name, t);
      const setter = `set${m.name.charAt(0).toUpperCase()}${m.name.slice(1)}`;
      return (
        `${doc}    ${acc} ${t} ${fieldName};\n` +
        `    ${acc} ${t} ${getter}() { return ${fieldName}; }\n` +
        `    ${acc} void ${setter}(${t} value) { this.${fieldName} = value; }`
      );
    }
    case 'constructor': {
      const pars = formatParams(m.parameters, 'java');
      return `${doc}    ${acc}${cls.name}(${pars}) {\n${stubBody(m, 'java')}\n    }`;
    }
    default: {
      const pars = formatParams(m.parameters, 'java');
      if (m.isAbstract) return `${doc}    ${acc} abstract ${ret} ${m.name}(${pars});`;
      return `${doc}    ${acc}${m.isStatic ? ' static' : ''} ${ret} ${m.name}(${pars})\n    {\n${stubBody(m, 'java')}\n    }`;
    }
  }
}

function memberPython(cls: ClassDefinition, m: MemberDefinition): string {
  const prefix = pythonAccessPrefix(m.access);
  const t = mapType(m.type, 'python');
  const ret = mapType(m.returnType, 'python');
  const doc = m.description ? `        """${m.description}"""\n` : '';

  switch (m.kind) {
    case 'field': {
      const ann = m.defaultValue !== undefined && m.defaultValue !== '' ? `: ${t} = ${m.defaultValue}` : `: ${t}`;
      return `    ${prefix}${m.name}${ann}`;
    }
    case 'property': {
      const backing = `_${m.name}`;
      return (
        `${doc}    @property\n` +
        `    def ${m.name}(self) -> ${t}:\n` +
        `        return self.${backing}\n\n` +
        `    @${m.name}.setter\n` +
        `    def ${m.name}(self, value: ${t}) -> None:\n` +
        `        self.${backing} = value`
      );
    }
    case 'constructor': {
      const sig = formatParams(m.parameters, 'python', true);
      return `${doc}    def ${constructorMemberName(cls.name, 'python')}(${sig}):\n${stubBody(m, 'python')}`;
    }
    default: {
      const staticDec = m.isStatic ? '    @staticmethod\n' : '';
      const absDec = m.isAbstract ? '    @abstractmethod\n' : '';
      const pars = formatParams(m.parameters, 'python', !m.isStatic);
      const retAnn = ret !== 'None' ? ` -> ${ret}` : ' -> None';
      const body = m.isAbstract ? '        raise NotImplementedError()' : stubBody(m, 'python');
      return `${staticDec}${absDec}${doc}    def ${m.name}(${pars})${retAnn}:\n${body}`;
    }
  }
}

export function memberPreviewLines(cls: ClassDefinition, lang: TargetLanguage): string[] {
  return cls.members.slice(0, 6).map((m) => {
    const acc =
      lang === 'python'
        ? pythonAccessPrefix(m.access) || '+'
        : (fmtAccess(m.access, lang).charAt(0) || '+');
    switch (m.kind) {
      case 'field':
        return `${acc} ${mapType(m.type, lang)} ${m.name}`;
      case 'property':
        return lang === 'python'
          ? `${acc} @property ${m.name}`
          : `${acc} ${mapType(m.type, lang)} ${m.name} { get; set; }`;
      case 'constructor':
        return lang === 'python' ? `${acc} __init__(...)` : `${acc} ${cls.name}(...)`;
      default:
        return `${acc} ${mapType(m.returnType, lang)} ${m.name}(...)`;
    }
  });
}
