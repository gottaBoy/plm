import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { open, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const codePattern = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
const verbs = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const languages = ['zh-CN', 'en'];
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const text = value => String(value ?? '').replace(/[&<>|[\]`]/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '|': '&#124;', '[': '&#91;', ']': '&#93;', '`': '&#96;',
})[character]).replace(/[\r\n]+/g, ' ');
const literal = value => `\`${text(value)}\``;
const title = code => String(code).replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ').replace(/\b[a-z]/g, character => character.toUpperCase());
const labels = {
  'zh-CN': {
    name: '服务接口', fields: '实体字段', operations: '接口方法', related: '关联入口',
    code: '代码', label: '名称', type: '类型', nullable: '允许空值', create: '创建字段',
    modify: '修改字段', key: '主键', length: '长度', permission: '权限声明',
    input: '输入', output: '返回', method: '方法', path: '模型相对路径',
    parent: '父资源', relation: '关系', entities: '实体', count: '方法定义数',
    yes: '是', no: '否', unknown: '未声明', noRoot: '模型未标记 major。本参考保守省略独立根候选路径，不代表运行端一定未导出根入口。',
    noOperations: '此实体没有独立方法定义。',
    noParent: '未能从模型中的独立根入口解析父资源；不生成推测路径。',
    warning: '本页由服务模型生成。权限声明不是授权结果，路径不是运行验收证据。输入/返回引用保留模型类型，不推测 DTO 的字段子集。',
    identifiers: '未提供英文词条时使用技术代码名称；本参考不翻译 ID、路由、状态存储值或未定义的业务说明。',
    routeNote: '路径是模型相对候选，不包含部署服务前缀；集合代码转为小写，关联使用子实体集合而非关系别名。major 与 API mode 的映射、多个父级路径变体、实际路由、认证、租户和授权须在运行端验证。',
    schema: '模型结构摘要', digest: '结构 SHA-256', entry: '方法条目', unavailable: '未解析',
  },
  en: {
    name: 'Service API', fields: 'Entity Fields', operations: 'Operations', related: 'Relationship Routes',
    code: 'Code', label: 'Name', type: 'Type', nullable: 'Nullable', create: 'Create Field',
    modify: 'Modify Field', key: 'Key', length: 'Length', permission: 'Declared Access',
    input: 'Input', output: 'Return', method: 'Method', path: 'Model-Relative Path',
    parent: 'Parent Resource', relation: 'Relationship', entities: 'Entities', count: 'Method Definitions',
    yes: 'Yes', no: 'No', unknown: 'Unspecified', noRoot: 'The model does not mark this entity as major. Root candidates are conservatively omitted; this does not prove that the runtime exports no root.',
    noOperations: 'This entity has no independent method definitions.',
    noParent: 'The parent cannot be resolved from a declared independent root; no guessed route is generated.',
    warning: 'Generated from the service model. Declared access is not an authorization result, and routes are not runtime acceptance evidence. Input/return references preserve model types without guessing DTO field subsets.',
    identifiers: 'Technical code names are used when an English term is unavailable. IDs, routes, stored state values and unspecified business descriptions are not translated.',
    routeNote: 'Paths are model-relative candidates without a deployment prefix. Collection codes are lowercased; relationships use the child entity collection, not the relationship alias. Verify major/API-mode mapping, alternate parent paths, actual routes, authentication, tenant and access at runtime.',
    schema: 'Model Structure Summary', digest: 'Structure SHA-256', entry: 'Method Entries', unavailable: 'Unresolved',
  },
};

const requireCode = (value, context) => {
  assert.equal(typeof value, 'string', `${context}: missing code`);
  assert.match(value, codePattern, `${context}: unsafe code`);
  return value;
};

const optionalNumber = (value, context) => {
  if (value === undefined || value === null) return null;
  assert.ok(Number.isSafeInteger(value) && value >= 0, `${context}: invalid numeric metadata`);
  return value;
};
const optionalBoolean = (value, context) => {
  if (value === undefined || value === null) return null;
  assert.equal(typeof value, 'boolean', `${context}: invalid boolean metadata`);
  return value;
};

function methodReference(value) {
  if (!value) return { type: null, dto: null, field: null };
  return {
    type: value.type ?? null,
    dto: value.getPSDEMethodDTO?.id ?? null,
    field: value.getKeyPSDEServiceAPIField?.id ?? null,
  };
}

function methodContract(method, base, owner, index) {
  assert.ok(verbs.has(method.requestMethod), `${owner}: unsupported HTTP method`);
  let suffix = method.requestPath ?? '';
  assert.equal(typeof suffix, 'string');
  assert.ok(suffix === '' || /^\/[a-zA-Z0-9_/-]+$/.test(suffix), `${owner}: unsafe request path`);
  assert.ok(!suffix.includes('//') && !suffix.split('/').includes('..'));
  if (!suffix) assert.equal(method.noServiceCodeName, true, `${owner}: undeclared method path`);
  const key = method.needResourceKey === true ? '/{key}' : '';
  const code = method.codeName ?? method.name;
  assert.equal(typeof code, 'string');
  const identity = `${owner}:${index}:${method.uniqueTag ?? method.name}`;
  return {
    anchor: `op-${digest(identity).slice(0, 16)}`,
    code,
    sourceName: method.name,
    method: method.requestMethod,
    path: base === null ? null : `${base}${key}${suffix}`,
    access: method.dataAccessAction ?? null,
    needResourceKey: method.needResourceKey === true,
    requestParamType: method.requestParamType ?? null,
    input: methodReference(method.getPSDEServiceAPIMethodInput),
    output: methodReference(method.getPSDEServiceAPIMethodReturn),
  };
}

export function createApiReferenceContract(model) {
  assert.equal(model.codeName, 'ServiceAPI');
  assert.ok(Array.isArray(model.getPSDEServiceAPIs) && model.getPSDEServiceAPIs.length > 0);
  assert.ok(Array.isArray(model.getPSDEServiceAPIRSs));
  const entities = model.getPSDEServiceAPIs.map(entity => {
    const code = requireCode(entity.codeName, 'entity');
    const collection = requireCode(entity.codeName2, code);
    const routeCollection = collection.toLowerCase();
    const fields = (entity.getPSDEServiceAPIFields ?? []).map(field => ({
      code: requireCode(field.codeName, `${code}.field`),
      sourceLabel: field.logicName ?? field.name ?? field.codeName,
      type: optionalNumber(field.stdDataType, `${code}.${field.codeName}.type`),
      length: optionalNumber(field.stringLength ?? field.length, `${code}.${field.codeName}.length`),
      nullable: optionalBoolean(field.allowEmpty, `${code}.${field.codeName}.nullable`),
      create: optionalBoolean(field.enableCreate, `${code}.${field.codeName}.create`),
      modify: optionalBoolean(field.enableModify, `${code}.${field.codeName}.modify`),
      key: optionalBoolean(field.keyField, `${code}.${field.codeName}.key`),
    }));
    assert.equal(new Set(fields.map(field => field.code.toLowerCase())).size, fields.length,
      `${code}: duplicate fields`);
    return {
      code, collection, routeCollection, apiMode: entity.aPIMode ?? null,
      sourceLabel: entity.logicName ?? entity.name ?? code,
      major: entity.major === true,
      fields,
      operations: (entity.getPSDEServiceAPIMethods ?? []).map((method, index) =>
        methodContract(method, entity.major === true ? `/${routeCollection}` : null, code, index)),
      relationships: [],
    };
  }).sort((a, b) => compare(a.code, b.code));
  assert.equal(new Set(entities.map(entity => entity.code)).size, entities.length, 'Duplicate entities');
  const byCode = new Map(entities.map(entity => [entity.code, entity]));
  const relationships = model.getPSDEServiceAPIRSs.map((relation, index) => {
    const parent = relation.getMajorPSDEServiceAPI?.id;
    const child = relation.getMinorPSDEServiceAPI?.id;
    assert.ok(byCode.has(parent) && byCode.has(child), 'Unresolved relationship entity');
    return {
      id: relation.id ?? relation.name,
      declaredCodeName: requireCode(relation.codeName, 'relationship'),
      collection: byCode.get(child).routeCollection,
      parent, child,
      methods: relation.getPSDEServiceAPIMethods ?? [],
      index,
    };
  });
  // Only explicitly major roots seed representative parent paths.
  const bases = new Map(entities.filter(entity => entity.major).map(entity =>
    [entity.code, `/${entity.routeCollection}`]));
  const queue = [...bases.keys()];
  for (let index = 0; index < queue.length; index++) {
    for (const relation of relationships.filter(relation => relation.parent === queue[index])) {
      if (bases.has(relation.child)) continue;
      bases.set(relation.child, `${bases.get(relation.parent)}/{${relation.parent}_key}/${relation.collection}`);
      queue.push(relation.child);
    }
  }
  for (const relation of relationships) {
    const parentBase = bases.get(relation.parent);
    const base = parentBase ? `${parentBase}/{${relation.parent}_key}/${relation.collection}` : null;
    byCode.get(relation.child).relationships.push({
      id: relation.id, parent: relation.parent,
      declaredCodeName: relation.declaredCodeName,
      collection: relation.collection,
      operations: relation.methods.map((method, index) =>
        methodContract(method, base, `relationship-${relation.index}`, index)),
      resolved: base !== null,
    });
  }
  const contract = {
    schemaVersion: 1, service: model.codeName, apiType: model.aPIType ?? null,
    routePolicy: {
      roots: 'conservative-major-flag-only; not a statement of runtime API-mode behavior',
      collections: 'lowercase-declared-entity-collection; never relationship-alias',
      parentPaths: 'one-shortest-reachable-model-parent-path; not every runtime wildcard variant',
      methodPaths: 'declared-model-requestPath-and-key-flags',
      runtimeMapperVerified: false,
    },
    entities,
    counts: {
      entities: entities.length, rootEntities: entities.filter(entity => entity.major).length,
      fields: entities.reduce((sum, entity) => sum + entity.fields.length, 0),
      entityMethodDefinitions: entities.reduce((sum, entity) => sum + entity.operations.length, 0),
      relationships: relationships.length,
      relationshipMethodDefinitions: relationships.reduce((sum, relation) => sum + relation.methods.length, 0),
      unresolvedRelationships: entities.flatMap(entity => entity.relationships).filter(relation => !relation.resolved).length,
    },
  };
  return contract;
}

function displayLabel(code, original, language, english) {
  if (language === 'zh-CN') return original || code;
  const translated = Object.hasOwn(english, original) ? english[original] : undefined;
  return typeof translated === 'string' && translated && !/[\u3400-\u9fff]/u.test(translated)
    ? translated : title(code);
}

const bool = (value, l) => value === null ? l.unknown : value ? l.yes : l.no;
const ref = value => [value.type, value.dto, value.field].filter(Boolean).map(literal).join(' / ') || '-';
const pagePath = (language, code) => `#/api-reference/${language}/entities/${code}`;
const languageLinks = (language, entityCode) => {
  const path = entityCode ? `entities/${entityCode}` : 'ServiceAPI';
  return `[中文](#/api-reference/zh-CN/${path}) | [English](#/api-reference/en/${path})`;
};

export function renderApiReferenceFiles(contract, { englishLabels = {}, inputHashes = [] } = {}) {
  const files = new Map();
  const contractSha256 = digest(JSON.stringify(contract));
  const put = (path, value) => {
    assert.ok(path.startsWith('api-reference/') && !files.has(path));
    files.set(path, Buffer.from(value));
  };
  const allOperations = entity => [
    ...entity.operations.filter(operation => operation.path),
    ...entity.relationships.flatMap(relation => relation.operations.filter(operation => operation.path)),
  ];
  for (const language of languages) {
    const l = labels[language];
    const prefix = `api-reference/${language}`;
    const name = entity => displayLabel(entity.code, entity.sourceLabel, language, englishLabels);
    const entries = [];
    const overview = [
      `# ${l.name}: ServiceAPI`, '', languageLinks(language), '', l.warning, '', l.identifiers, '', l.routeNote, '',
      `## ${l.schema}`, '',
      `| ${l.entities} | ${l.fields} | ${l.count} | ${l.related} |`,
      '| --- | --- | --- | --- |',
      `| ${contract.counts.entities} | ${contract.counts.fields} | ${contract.counts.entityMethodDefinitions} | ${contract.counts.relationships} |`,
      '', `${l.digest}: ${literal(contractSha256)}`, '',
      `## ${l.entities}`, '', `| ${l.label} | ${l.code} | ${l.entry} |`, '| --- | --- | --- |',
    ];
    const sidebar = [`- [${l.name}](#/api-reference/${language}/ServiceAPI)`];
    for (const entity of contract.entities) {
      const heading = name(entity);
      const href = pagePath(language, entity.code);
      const operations = allOperations(entity);
      overview.push(`| [${text(heading)}](${href}) | ${literal(entity.code)} | ${operations.length} |`);
      sidebar.push(`- [${text(heading)}](${href})`);
      entries.push({ label: heading, code: entity.code, path: href,
        keywords: [entity.code, entity.collection].join(' ') });
      const lines = [
        `# ${text(heading)} (${entity.code})`, '', languageLinks(language, entity.code),
        '', l.warning, '', l.routeNote, '',
      ];
      if (!entity.major) lines.push(l.noRoot, '');
      lines.push(`## ${l.fields}`, '',
        `| ${l.code} | ${l.label} | stdDataType | ${l.length} | ${l.nullable} | ${l.create} | ${l.modify} | ${l.key} |`,
        '| --- | --- | --- | --- | --- | --- | --- | --- |');
      for (const field of entity.fields) {
        lines.push(`| ${literal(field.code)} | ${text(displayLabel(field.code, field.sourceLabel, language, englishLabels))} | ` +
          `${field.type ?? '-'} | ${field.length ?? '-'} | ${bool(field.nullable, l)} | ${bool(field.create, l)} | ` +
          `${bool(field.modify, l)} | ${bool(field.key, l)} |`);
      }
      const renderOperations = (items, parent = '') => {
        for (const operation of items) {
          lines.push(`### ${operation.method} ${text(operation.code)} :id=${operation.anchor}`, '',
            operation.path ? literal(operation.path) : (parent ? l.noParent : l.noRoot), '',
            `| ${l.permission} | ${l.input} | ${l.output} | ${l.key} |`,
            '| --- | --- | --- | --- |',
            `| ${operation.access ? literal(operation.access) : l.unknown} | ${ref(operation.input)} | ` +
            `${ref(operation.output)} | ${bool(operation.needResourceKey, l)} |`, '');
          if (operation.path) entries.push({
            label: `${heading} / ${operation.method} ${operation.code}`,
            code: operation.code, path: `${href}?id=${operation.anchor}`,
            keywords: [entity.code, entity.collection, operation.code, operation.path, operation.access, parent].filter(Boolean).join(' '),
          });
        }
      };
      lines.push(`## ${l.operations}`, '');
      if (!entity.operations.length) lines.push(l.noOperations, '');
      renderOperations(entity.operations);
      for (const relation of entity.relationships) {
        lines.push(`## ${l.related}: ${text(relation.parent)}`, '',
          `${l.relation}: ${literal(relation.id)}`, '');
        renderOperations(relation.operations, relation.parent);
      }
      put(`${prefix}/entities/${entity.code}.md`, `${lines.join('\n')}\n`);
    }
    put(`${prefix}/ServiceAPI.md`, `${overview.join('\n')}\n`);
    put(`${prefix}/_sidebar.md`, `${sidebar.join('\n')}\n`);
    put(`${prefix}/search.json`, `${JSON.stringify({ language, entries })}\n`);
  }
  put('api-reference/manifest.json', `${JSON.stringify({
    contract: 'plm-bilingual-api-reference-v1',
    source: 'model/PSSYSSERVICEAPIS/ServiceAPI.json',
    contractSha256, languages, counts: contract.counts, routePolicy: contract.routePolicy, inputHashes,
    runtimeAcceptance: false, arbitraryApiExecution: false,
    englishLabelPolicy: 'curated-label-or-technical-code; not machine-translated-business-descriptions',
    files: [...files].map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: digest(bytes) })),
  }, null, 2)}\n`);
  return files;
}

async function readInput(path, role, required = true) {
  try {
    assert.equal(await realpath(path), resolve(path), 'Reference inputs must not traverse symlinks');
    const before = await lstat(path);
    assert.ok(before.isFile() && before.nlink === 1 && before.size < 32 * 1024 * 1024);
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const bytes = await handle.readFile();
      const after = await handle.stat();
      for (const key of ['ino', 'dev', 'size', 'mtimeMs', 'ctimeMs']) assert.equal(after[key], before[key]);
      return { bytes, identity: { role, sha256: digest(bytes), bytes: bytes.length } };
    } finally { await handle.close(); }
  } catch (error) {
    if (!required && error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function buildApiReferenceFiles({ sourceDirectory }) {
  const directory = resolve(sourceDirectory);
  const model = await readInput(resolve(directory, '../../model/PSSYSSERVICEAPIS/ServiceAPI.json'), 'service-model');
  const english = await readInput(resolve(directory, '../../../plm-web/src/locale/en.json'), 'english-labels', false);
  const generator = await readInput(fileURLToPath(import.meta.url), 'generator');
  return renderApiReferenceFiles(createApiReferenceContract(JSON.parse(model.bytes)), {
    englishLabels: english ? JSON.parse(english.bytes) : {},
    inputHashes: [model, english, generator].filter(Boolean).map(input => input.identity),
  });
}
