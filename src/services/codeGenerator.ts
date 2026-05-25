import type { ClassDefinition, MemberDefinition, ProjectModel, TargetLanguage } from '../types/models';

function fmtAccess(a: string, lang: TargetLanguage): string {
  const map: Record<string, Record<TargetLanguage, string>> = {
    public: { csharp: 'public', java: 'public' },
    private: { csharp: 'private', java: 'private' },
    protected: { csharp: 'protected', java: 'protected' },
    internal: { csharp: 'internal', java: '' },
  };
  return map[a]?.[lang] ?? 'public';
}

function mapType(t: string, lang: TargetLanguage): string {
  if (lang === 'java') {
    return t === 'string' ? 'String' : t === 'bool' ? 'boolean' : t === 'int' ? 'int' : t;
  }
  return t;
}

function stubBody(m: MemberDefinition): string {
  if (!m.generateStub) return langThrow('csharp');
  const r = m.returnType || 'void';
  if (r === 'void') return '        // TODO';
  if (r === 'bool' || r === 'boolean') return '        return false;';
  if (r === 'int') return '        return 0;';
  if (r === 'string' || r === 'String') return langThrow('string');
  return langThrow('csharp');
}

function langThrow(kind: string): string {
  if (kind === 'string') return "        return '';";
  return '        throw new NotImplementedException();';
}

function effectiveNs(cls: ClassDefinition, project: ProjectModel): string {
  return project.language === 'csharp'
    ? cls.namespace || project.defaultNamespace
    : cls.package || project.defaultPackage;
}

export function generateClassCode(cls: ClassDefinition, project: ProjectModel): string {
  return project.language === 'csharp'
    ? generateCSharp(cls, project)
    : generateJava(cls, project);
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

function buildDecl(cls: ClassDefinition, lang: TargetLanguage): string {
  const parts: string[] = [fmtAccess(cls.access, lang)];
  if (cls.isStatic && lang === 'csharp') parts.push('static');
  if (cls.isSealed && lang === 'csharp') parts.push('sealed');
  if (cls.isAbstract && !cls.isInterface) parts.push('abstract');
  if (cls.isInterface) parts.push(lang === 'csharp' ? 'interface' : 'interface');
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
  return parts.filter(Boolean).join(' ');
}

function memberCSharp(cls: ClassDefinition, m: MemberDefinition): string {
  const acc = fmtAccess(m.access, 'csharp');
  const t = mapType(m.type, 'csharp');
  const ret = mapType(m.returnType, 'csharp');
  switch (m.kind) {
    case 'field':
      return `    ${acc}${m.isStatic ? ' static' : ''}${m.isReadOnly ? ' readonly' : ''} ${t} ${m.name};`;
    case 'property':
      return `    ${acc}${m.isStatic ? ' static' : ''}${m.isVirtual ? ' virtual' : ''}${m.isAbstract ? ' abstract' : ''} ${t} ${m.name} { get; set; }`;
    case 'constructor': {
      const pars = m.parameters.map((p) => `${mapType(p.type, 'csharp')} ${p.name}`).join(', ');
      return `    ${acc}${cls.name}(${pars})\n    {\n${stubBody(m)}\n    }`;
    }
    default: {
      const pars = m.parameters.map((p) => `${mapType(p.type, 'csharp')} ${p.name}`).join(', ');
      if (m.isAbstract) return `    ${acc} abstract ${ret} ${m.name}(${pars});`;
      return `    ${acc}${m.isStatic ? ' static' : ''} ${ret} ${m.name}(${pars})\n    {\n${stubBody(m)}\n    }`;
    }
  }
}

function memberJava(cls: ClassDefinition, m: MemberDefinition): string {
  const acc = fmtAccess(m.access, 'java');
  const t = mapType(m.type, 'java');
  const ret = mapType(m.returnType, 'java');
  switch (m.kind) {
    case 'field':
      return `    ${acc}${m.isStatic ? ' static' : ''}${m.isReadOnly ? ' final' : ''} ${t} ${m.name};`;
    case 'property':
      return `    ${acc} ${t} ${m.name};\n    ${acc} ${t} get${m.name}() { return ${m.name}; }`;
    case 'constructor': {
      const pars = m.parameters.map((p) => `${mapType(p.type, 'java')} ${p.name}`).join(', ');
      return `    ${acc}${cls.name}(${pars}) {\n${stubBody(m).replace('NotImplementedException', 'UnsupportedOperationException')}\n    }`;
    }
    default: {
      const pars = m.parameters.map((p) => `${mapType(p.type, 'java')} ${p.name}`).join(', ');
      if (m.isAbstract) return `    ${acc} abstract ${ret} ${m.name}(${pars});`;
      return `    ${acc}${m.isStatic ? ' static' : ''} ${ret} ${m.name}(${pars}) {\n${stubBody(m).replace('NotImplementedException', 'UnsupportedOperationException')}\n    }`;
    }
  }
}

export function memberPreviewLines(cls: ClassDefinition, lang: TargetLanguage): string[] {
  return cls.members.slice(0, 6).map((m) => {
    const acc = fmtAccess(m.access, lang).charAt(0);
    switch (m.kind) {
      case 'field':
        return `${acc} ${mapType(m.type, lang)} ${m.name}`;
      case 'property':
        return `${acc} ${mapType(m.type, lang)} ${m.name} { get; set; }`;
      case 'constructor':
        return `${acc} ${cls.name}(...)`;
      default:
        return `${acc} ${mapType(m.returnType, lang)} ${m.name}(...)`;
    }
  });
}
