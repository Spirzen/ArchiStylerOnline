import type { ClassDefinition, MemberDefinition, ProjectModel, TargetLanguage } from '../types/models';

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
  if (lang === 'java') {
    return t === 'string' ? 'String' : t === 'bool' ? 'boolean' : t === 'int' ? 'int' : t;
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
    };
    return py[t] ?? t;
  }
  return t;
}

function stubBody(m: MemberDefinition, lang: TargetLanguage): string {
  if (!m.generateStub) return lang === 'python' ? '        pass' : '        // TODO';
  const r = m.returnType || 'void';
  if (r === 'void' || r === 'None') return lang === 'python' ? '        pass' : '        // TODO';
  if (r === 'bool' || r === 'boolean') return lang === 'python' ? '        return False' : '        return false;';
  if (r === 'int') return lang === 'python' ? '        return 0' : '        return 0;';
  if (r === 'string' || r === 'String' || r === 'str')
    return lang === 'python' ? "        return ''" : "        return '';";
  if (lang === 'python') return '        raise NotImplementedError()';
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

  const decl = buildDecl(cls, 'csharp');
  lines.push(`${decl}`, '{');
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
  if (cls.usings.length) {
    for (const u of [...new Set(cls.usings)].sort()) lines.push(`from ${u} import *`);
    lines.push('');
  }
  if (cls.summary) lines.push(`"""${cls.summary}"""`, '');
  if (cls.isEnum) {
    lines.push('from enum import Enum', '', `class ${cls.name}(Enum):`);
    for (const m of cls.members) lines.push(`    ${m.name} = "${m.name}"`);
    return lines.join('\n');
  }
  const bases: string[] = [];
  if (cls.baseType) bases.push(cls.baseType);
  bases.push(...cls.implementedInterfaces);
  const basePart = bases.length ? `(${bases.join(', ')})` : '';
  const decorators: string[] = [];
  if (cls.isAbstract && !cls.isInterface) decorators.push('@abstractmethod  # use ABC for abstract class');
  if (decorators.length) lines.push(...decorators);
  lines.push(`class ${cls.name}${basePart}:`);
  if (cls.members.length === 0) {
    lines.push('    pass');
    return lines.join('\n');
  }
  for (const m of cls.members) lines.push(memberPython(cls, m));
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
      const pars = m.parameters.map((p) => `${mapType(p.type, 'csharp')} ${p.name}`).join(', ');
      return `${doc}    ${acc}${cls.name}(${pars})\n    {\n${stubBody(m, 'csharp')}\n    }`;
    }
    default: {
      const pars = m.parameters.map((p) => `${mapType(p.type, 'csharp')} ${p.name}`).join(', ');
      if (m.isAbstract) return `${doc}    ${acc} abstract ${ret} ${m.name}(${pars});`;
      return `${doc}    ${acc}${m.isStatic ? ' static' : ''} ${ret} ${m.name}(${pars})\n    {\n${stubBody(m, 'csharp')}\n    }`;
    }
  }
}

function memberJava(cls: ClassDefinition, m: MemberDefinition): string {
  const acc = fmtAccess(m.access, 'java');
  const t = mapType(m.type, 'java');
  const ret = mapType(m.returnType, 'java');
  const doc = m.description ? `    /** ${m.description} */\n` : '';
  switch (m.kind) {
    case 'field':
      return `${doc}    ${acc}${m.isStatic ? ' static' : ''}${m.isReadOnly ? ' final' : ''} ${t} ${m.name};`;
    case 'property':
      return `${doc}    ${acc} ${t} ${m.name};\n    ${acc} ${t} get${m.name}() { return ${m.name}; }`;
    case 'constructor': {
      const pars = m.parameters.map((p) => `${mapType(p.type, 'java')} ${p.name}`).join(', ');
      return `${doc}    ${acc}${cls.name}(${pars}) {\n${stubBody(m, 'java').replace('NotImplementedException', 'UnsupportedOperationException')}\n    }`;
    }
    default: {
      const pars = m.parameters.map((p) => `${mapType(p.type, 'java')} ${p.name}`).join(', ');
      if (m.isAbstract) return `${doc}    ${acc} abstract ${ret} ${m.name}(${pars});`;
      return `${doc}    ${acc}${m.isStatic ? ' static' : ''} ${ret} ${m.name}(${pars}) {\n${stubBody(m, 'java').replace('NotImplementedException', 'UnsupportedOperationException')}\n    }`;
    }
  }
}

function memberPython(_cls: ClassDefinition, m: MemberDefinition): string {
  const prefix = pythonAccessPrefix(m.access);
  const t = mapType(m.type, 'python');
  const ret = mapType(m.returnType, 'python');
  const doc = m.description ? `        """${m.description}"""\n` : '';
  const staticDec = m.isStatic ? '    @staticmethod\n' : '';
  const absDec = m.isAbstract ? '    @abstractmethod\n' : '';
  switch (m.kind) {
    case 'field':
      return `    ${prefix}${m.name}${m.defaultValue ? `: ${t} = ${m.defaultValue}` : `: ${t}`}`;
    case 'property':
      return `${doc}    @property\n    def ${m.name}(self) -> ${t}:\n        return self._${m.name}\n\n    @${m.name}.setter\n    def ${m.name}(self, value: ${t}) -> None:\n        self._${m.name} = value`;
    case 'constructor': {
      const pars = m.parameters.map((p) => `${p.name}: ${mapType(p.type, 'python')}`).join(', ');
      const sig = pars ? `self, ${pars}` : 'self';
      return `${doc}    def __init__(${sig}):\n${stubBody(m, 'python')}`;
    }
    default: {
      const pars = m.parameters.map((p) => `${p.name}: ${mapType(p.type, 'python')}`).join(', ');
      const sig = pars ? `self, ${pars}` : 'self';
      const retAnn = ret !== 'None' ? ` -> ${ret}` : ' -> None';
      if (m.isAbstract) return `${absDec}    def ${m.name}(${sig})${retAnn}:\n        raise NotImplementedError()`;
      return `${staticDec}${absDec}${doc}    def ${m.name}(${sig})${retAnn}:\n${stubBody(m, 'python')}`;
    }
  }
}

export function memberPreviewLines(cls: ClassDefinition, lang: TargetLanguage): string[] {
  return cls.members.slice(0, 6).map((m) => {
    const acc =
      lang === 'python'
        ? pythonAccessPrefix(m.access) || '+'
        : fmtAccess(m.access, lang).charAt(0) || '+';
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
