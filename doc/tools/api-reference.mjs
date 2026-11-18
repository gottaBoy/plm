import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { open, lstat, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  attachDtoSchemas, directDtoRequests, dtoAuthorityPath, dtoDependencies, dtoModelPath,
} from './api-reference-dto.mjs';
import { attachLogicOutputFields, logicOutputRequests } from './api-reference-logic.mjs';

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
    warning: '本页由服务模型生成。权限声明不是授权结果，路径不是运行验收证据。DTO 字段仅来自明确引用的实体方法 DTO；未解析时不会回退为实体全部字段。',
    identifiers: '未提供英文词条时使用技术代码名称；本参考不翻译 ID、路由、状态存储值或未定义的业务说明。',
    routeNote: '路径是模型相对候选，不包含部署服务前缀；集合代码转为小写，关联使用子实体集合而非关系别名。major 与 API mode 的映射、多个父级路径变体、实际路由、认证、租户和授权须在运行端验证。',
    schema: '模型结构摘要', digest: '结构 SHA-256', entry: '方法条目', unavailable: '未解析',
    dtoSchemas: 'DTO 字段声明', dtoNote: 'DTO 字段表与上方实体总字段分离。允许空值和只读只显示 DTO 显式元数据；未声明不等于允许或禁止。它们不是逐操作请求必填规则。DTO/PAGE/DTOS 包装及嵌套类型保留原模型声明，不推测分页外壳或序列化结果。',
    dtoKind: 'DTO 类型', dtoSource: '权威模型', dtoField: '模型属性', readOnly: '只读声明',
    references: '类型与来源引用', reference: '嵌套类型', relatedSource: '投影来源',
    dtoUnavailable: '无法解析 DTO 字段声明', format: '格式', searchMode: '搜索模式', listMap: '列表映射',
    dtoFieldSource: '字段来源',
    logicFields: '逻辑输出字段（不是 DTO 声明）',
    logicNote: '以下键来自已核对的返回参数赋值链。字段类型、可空性及实际序列化未声明或未验收；不补入 DTO 字段统计。',
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
    warning: 'Generated from the service model. Declared access is not an authorization result, and routes are not runtime acceptance evidence. DTO fields come only from explicitly referenced entity method DTOs; unresolved references never fall back to all entity fields.',
    identifiers: 'Technical code names are used when an English term is unavailable. IDs, routes, stored state values and unspecified business descriptions are not translated.',
    routeNote: 'Paths are model-relative candidates without a deployment prefix. Collection codes are lowercased; relationships use the child entity collection, not the relationship alias. Verify major/API-mode mapping, alternate parent paths, actual routes, authentication, tenant and access at runtime.',
    schema: 'Model Structure Summary', digest: 'Structure SHA-256', entry: 'Method Entries', unavailable: 'Unresolved',
    dtoSchemas: 'DTO Field Declarations', dtoNote: 'DTO tables are separate from the full entity field list. Nullable and read-only show only explicit DTO metadata; unspecified means neither allowed nor denied. These are not per-operation request-required rules. DTO/PAGE/DTOS wrappers and nested types retain model declarations without guessing page envelopes or serialized results.',
    dtoKind: 'DTO Kind', dtoSource: 'Authority Model', dtoField: 'Model Field', readOnly: 'Declared Read-Only',
    references: 'Type and Source References', reference: 'Nested Type', relatedSource: 'Projection Source',
    dtoUnavailable: 'DTO field declaration cannot be resolved', format: 'Format', searchMode: 'Search Mode', listMap: 'List Map',
    dtoFieldSource: 'Field Source',
    logicFields: 'Logic-Defined Response Fields (Not DTO Declarations)',
    logicNote: 'These keys come from the reviewed assignments to the returned logic parameter. Types, nullable rules and actual serialization are unspecified or unverified; they are not counted as DTO fields.',
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
    sourceAction: method.getPSDEAction?.path ?? null,
  };
}

export function createApiReferenceContract(model, { dtoModels = new Map(), logicModels = new Map() } = {}) {
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
      modelPath: entity.getPSDataEntity?.path ? dtoModelPath(entity.getPSDataEntity.path) : null,
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
  return attachLogicOutputFields(attachDtoSchemas(contract, dtoModels), dtoModels, logicModels);
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
  return `[中文](/api-reference/zh-CN/${path}) | [English](/api-reference/en/${path})`;
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
    const schemas = new Map((contract.dtoSchemas ?? []).map(schema => [schema.id, schema]));
    const overview = [
      `# ${l.name}: ServiceAPI`, '', languageLinks(language), '', l.warning, '', l.identifiers, '', l.routeNote, '',
      `## ${l.schema}`, '',
      `| ${l.entities} | ${l.fields} | ${l.count} | ${l.related} |`,
      '| --- | --- | --- | --- |',
      `| ${contract.counts.entities} | ${contract.counts.fields} | ${contract.counts.entityMethodDefinitions} | ${contract.counts.relationships} |`,
      '', `${l.digest}: ${literal(contractSha256)}`, '',
      `## ${l.entities}`, '', `| ${l.label} | ${l.code} | ${l.entry} |`, '| --- | --- | --- |',
    ];
    const sidebar = [`- [${l.name}](/api-reference/${language}/ServiceAPI)`];
    for (const entity of contract.entities) {
      const heading = name(entity);
      const href = pagePath(language, entity.code);
      const documentHref = href.slice(1);
      const operations = allOperations(entity);
      overview.push(`| [${text(heading)}](${documentHref}) | ${literal(entity.code)} | ${operations.length} |`);
      sidebar.push(`- [${text(heading)}](${documentHref})`);
      entries.push({ label: heading, code: entity.code, path: href,
        keywords: [entity.code, entity.collection].join(' ') });
      const lines = [
        `# ${text(heading)} (${entity.code})`, '', languageLinks(language, entity.code),
        '', l.warning, '', l.routeNote, '',
      ];
      const schemaLink = (id, name) => {
        const schema = schemas.get(id);
        return schema ? `[${text(name)}](${documentHref}?id=${schema.anchor})` : literal(name);
      };
      const methodRef = value => {
        if (!value.dto) return ref(value);
        const description = [value.type ? literal(value.type) : null,
          schemaLink(value.schemaId, value.dto), value.field ? literal(value.field) : null].filter(Boolean).join(' / ');
        return value.status === 'resolved' ? description
          : `${description} (${l.unavailable}: ${literal(value.reason || 'dto-source-not-loaded')})`;
      };
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
            `| ${operation.access ? literal(operation.access) : l.unknown} | ${methodRef(operation.input)} | ` +
            `${methodRef(operation.output)} | ${bool(operation.needResourceKey, l)} |`, '');
          if (operation.logicOutput) {
            lines.push(`#### ${l.logicFields}`, '', l.logicNote, '',
              `${l.dtoSource}: ${literal(operation.logicOutput.modelPath)}`, '',
              `| ${l.code} | ${l.type} | ${l.nullable} |`, '| --- | --- | --- |',
              ...operation.logicOutput.fields.map(field => `| ${literal(field.code)} | ${l.unknown} | ${l.unknown} |`), '');
          }
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
      if (entity.dtoSchemaIds?.length) {
        lines.push(`## ${l.dtoSchemas}`, '', l.dtoNote, '');
        for (const id of entity.dtoSchemaIds) {
          const schema = schemas.get(id);
          assert.ok(schema, `Missing referenced DTO schema: ${id}`);
          lines.push(`### ${text(schema.name)} :id=${schema.anchor}`, '',
            `${l.dtoSource}: ${literal(schema.modelPath)}`, '',
            `${l.dtoKind}: ${schema.kind ? literal(schema.kind) : l.unknown}` +
              `${schema.sourceType ? ` / ${literal(schema.sourceType)}` : ''}` +
              `${schema.sourceMethodDTO ? ` / ${literal(schema.sourceMethodDTO)}` : ''}`, '');
          if (schema.fieldSource) {
            lines.push(`${l.dtoFieldSource}: ${literal(schema.fieldSource.modelPath)} / ${literal(schema.fieldSource.dto)}` +
              `${schema.fieldSource.status === 'resolved' ? '' : ` (${l.unavailable}: ${literal(schema.fieldSource.reason)})`}`, '');
          }
          if (schema.status !== 'resolved') {
            lines.push(`${l.dtoUnavailable}: ${literal(schema.reason)}`, '');
            continue;
          }
          entries.push({
            label: `${heading} / DTO ${schema.name}`, code: schema.name,
            path: `${href}?id=${schema.anchor}`,
            keywords: [entity.code, schema.name, schema.modelPath,
              ...schema.fields.map(field => field.code)].join(' '),
          });
          lines.push(
            `| ${l.code} | ${l.label} | ${l.dtoField} | ${l.type} | stdDataType | ${l.length} | ${l.nullable} | ${l.readOnly} | ${l.references} |`,
            '| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
          for (const field of schema.fields) {
            const references = field.links.map(link => {
              const label = link.kind === 'reference' ? l.reference : l.relatedSource;
              const target = [link.dto ? schemaLink(link.schemaId, link.dto) : l.unknown,
                link.field ? literal(link.field) : null].filter(Boolean).join(' / ');
              return `${label}: ${target}${link.status === 'resolved' ? '' : ` (${l.unavailable}: ${literal(link.reason)})`}`;
            });
            if (field.jsonFormat !== null) references.push(`${l.format}: ${literal(field.jsonFormat)}`);
            if (field.searchMode !== null) references.push(`${l.searchMode}: ${literal(field.searchMode)}`);
            if (field.listMap !== null) references.push(`${l.listMap}: ${bool(field.listMap, l)}`);
            lines.push(`| ${literal(field.code)} | ${text(displayLabel(field.code, field.sourceLabel, language, englishLabels))} | ` +
              `${field.modelField ? literal(field.modelField) : '-'} | ${literal(field.type)} | ${field.stdDataType ?? '-'} | ` +
              `${field.length ?? '-'} | ${bool(field.nullable, l)} | ${bool(field.readOnly, l)} | ${references.join('; ') || '-'} |`);
          }
          lines.push('');
        }
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
    dtoCoverage: contract.dtoCoverage,
    logicOutputCoverage: contract.logicOutputCoverage,
    dtoPolicy: {
      fields: 'explicit-entity-method-dto-or-filter-dto-fields; never full-entity-fallback',
      missingMetadata: 'unspecified; no per-operation-required inference',
      nestedTypes: 'reference and related-source are distinct; cycles remain links',
      systemSources: 'explicit getSrcPSSysMethodDTO follows PSSYSTEM.getAllPSSysMethodDTOs; no dynamic attributes or script-to-DTO inference',
      runtimeSerializationVerified: false,
    },
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
      return { bytes, identity: { role, sha256: digest(bytes), bytes: bytes.length },
        metadata: Object.fromEntries(['ino', 'dev', 'size', 'mtimeMs', 'ctimeMs'].map(key => [key, after[key]])) };
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
  const helper = await readInput(fileURLToPath(new URL('./api-reference-dto.mjs', import.meta.url)), 'dto-generator');
  const logicHelper = await readInput(fileURLToPath(new URL('./api-reference-logic.mjs', import.meta.url)), 'logic-output-generator');
  const serviceModel = JSON.parse(model.bytes);
  const models = new Map();
  const inputs = new Map();
  const unavailable = new Set();
  const pending = directDtoRequests(serviceModel);
  const seen = new Set();
  const logicModels = new Map();
  const logicInputs = new Map();
  const modelRoot = resolve(directory, '../../model');
  for (let index = 0; index < pending.length; index++) {
    const request = pending[index];
    const key = `${request.modelPath}#${request.dto}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (!models.has(request.modelPath) && !unavailable.has(request.modelPath)) {
      const input = await readInput(resolve(modelRoot, dtoAuthorityPath(request.modelPath)),
        request.modelPath === 'PSSYSTEM.json' ? 'dto-system-model' : 'dto-model', false);
      if (input) {
        models.set(request.modelPath, JSON.parse(input.bytes));
        input.identity.modelPath = request.modelPath;
        inputs.set(request.modelPath, input);
      } else unavailable.add(request.modelPath);
    }
    const entityModel = models.get(request.modelPath);
    if (entityModel) pending.push(...dtoDependencies(entityModel, request.dto,
      { system: request.modelPath === 'PSSYSTEM.json' }));
  }
  for (const path of logicOutputRequests(models)) {
    const input = await readInput(resolve(modelRoot, path), 'dto-response-logic', false);
    if (input) {
      input.identity.modelPath = path;
      logicModels.set(path, JSON.parse(input.bytes));
      logicInputs.set(path, input);
    } else unavailable.add(path);
  }
  const participating = [
    [resolve(directory, '../../model/PSSYSSERVICEAPIS/ServiceAPI.json'), model],
    ...(english ? [[resolve(directory, '../../../plm-web/src/locale/en.json'), english]] : []),
    [fileURLToPath(import.meta.url), generator],
    [fileURLToPath(new URL('./api-reference-dto.mjs', import.meta.url)), helper],
    [fileURLToPath(new URL('./api-reference-logic.mjs', import.meta.url)), logicHelper],
    ...[...inputs].map(([path, input]) => [resolve(modelRoot, path), input]),
    ...[...logicInputs].map(([path, input]) => [resolve(modelRoot, path), input]),
  ];
  // Re-read every participating input after graph resolution to reject mixed snapshots.
  for (const [path, input] of participating) {
    const current = await readInput(path, input.identity.role);
    assert.deepEqual(current.metadata, input.metadata, 'Reference input metadata changed during multi-source generation');
    assert.equal(current.identity.sha256, input.identity.sha256, 'Reference input changed during multi-source generation');
  }
  if (!english) assert.equal(await readInput(resolve(directory, '../../../plm-web/src/locale/en.json'),
    'english-labels', false), null, 'Previously missing English labels appeared during generation');
  for (const path of unavailable) {
    assert.equal(await readInput(resolve(modelRoot, path), 'dto-model', false), null,
      'Previously missing DTO model appeared during generation');
  }
  return renderApiReferenceFiles(createApiReferenceContract(serviceModel, { dtoModels: models, logicModels }), {
    englishLabels: english ? JSON.parse(english.bytes) : {},
    inputHashes: [model, english, generator, helper, logicHelper,
      ...[...inputs, ...logicInputs].sort(([a], [b]) => compare(a, b)).map(([, input]) => input)].filter(Boolean)
      .map(input => input.identity),
  });
}
