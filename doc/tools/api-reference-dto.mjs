import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const code = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
const modelPathPattern = /^(?:PSSYSMODELGROUPS\/[a-zA-Z_][a-zA-Z0-9_-]*\/)?PSMODULES\/[a-zA-Z_][a-zA-Z0-9_-]*\/PSDATAENTITIES\/[a-zA-Z_][a-zA-Z0-9_-]*\.json$/;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const digest = value => createHash('sha256').update(value).digest('hex');
const scalar = (value, context) => {
  if (value === undefined || value === null) return null;
  assert.equal(typeof value, 'string', `${context}: invalid text metadata`);
  return value;
};
const identifier = (value, context) => {
  assert.equal(typeof value, 'string', `${context}: missing identifier`);
  assert.match(value, code, `${context}: unsafe identifier`);
  return value;
};
const number = (value, context) => {
  if (value === undefined || value === null) return null;
  assert.ok(Number.isSafeInteger(value) && value >= 0, `${context}: invalid numeric metadata`);
  return value;
};
const boolean = (value, context) => {
  if (value === undefined || value === null) return null;
  assert.equal(typeof value, 'boolean', `${context}: invalid boolean metadata`);
  return value;
};

export function dtoModelPath(value) {
  assert.equal(typeof value, 'string', 'Missing DTO entity model path');
  assert.match(value, modelPathPattern, 'Unsafe DTO entity model path');
  return value;
}

export function dtoAuthorityPath(value) {
  return value === 'PSSYSTEM.json' ? value : dtoModelPath(value);
}

function definition(model, name, system = false) {
  const definitions = model[system ? 'getAllPSSysMethodDTOs' : 'getAllPSDEMethodDTOs'] ?? [];
  assert.ok(Array.isArray(definitions), 'Invalid DTO definition list');
  const matching = definitions.filter(dto => (system ? dto.id ?? dto.name : dto.name) === name);
  assert.ok(matching.length <= 1, `Duplicate DTO definition: ${name}`);
  return matching[0];
}

function declaredFields(dto, system = false) {
  const key = system ? 'getPSSysMethodDTOFields'
    : dto.type === 'DEFILTER' ? 'getPSDEFilterDTOFields' : 'getPSDEMethodDTOFields';
  if (!Object.hasOwn(dto, key)) return null;
  assert.ok(Array.isArray(dto[key]), `Invalid DTO field list: ${dto.name}`);
  return dto[key];
}

function fieldLinks(field) {
  if (field.getRefPSSysMethodDTO) {
    assert.ok(!field.getRefPSDataEntity && !field.getRefPSDEMethodDTO,
      'Conflicting entity/system DTO field reference');
  }
  return ['Ref', 'Related'].flatMap(kind => {
    const target = field[`get${kind}PSDataEntity`];
    const dto = field[`get${kind}PSDEMethodDTO`];
    const relatedField = field.getRelatedPSDEMethodDTOField;
    const system = kind === 'Ref' ? field.getRefPSSysMethodDTO : null;
    if (!target && !dto && !system && !(kind === 'Related' && relatedField)) return [];
    return [{
      kind: kind === 'Ref' ? 'reference' : 'related-source',
      modelPath: system ? 'PSSYSTEM.json' : target?.path ? dtoModelPath(target.path) : null,
      dto: system ? identifier(system.id, 'Nested system DTO') : dto?.id ? identifier(dto.id, 'Nested DTO') : null,
      field: kind === 'Related' && relatedField?.id
        ? identifier(relatedField.id, 'Related DTO field') : null,
    }];
  });
}

export function directDtoRequests(model) {
  const requests = [];
  const entities = model.getPSDEServiceAPIs ?? [];
  for (const entity of entities) {
    const methods = [
      ...(entity.getPSDEServiceAPIMethods ?? []),
      ...(model.getPSDEServiceAPIRSs ?? [])
        .filter(relation => relation.getMinorPSDEServiceAPI?.id === entity.codeName)
        .flatMap(relation => relation.getPSDEServiceAPIMethods ?? []),
    ];
    for (const method of methods) for (const value of [
      method.getPSDEServiceAPIMethodInput, method.getPSDEServiceAPIMethodReturn,
    ]) {
      if (!value?.getPSDEMethodDTO?.id || !entity.getPSDataEntity?.path) continue;
      requests.push({
        modelPath: dtoModelPath(entity.getPSDataEntity.path),
        dto: identifier(value.getPSDEMethodDTO.id, 'Method DTO'),
      });
    }
  }
  return requests;
}

export function dtoDependencies(model, name, { system = false } = {}) {
  const dto = definition(model, name, system);
  if (!dto) return [];
  const source = dto.getSrcPSSysMethodDTO?.id;
  return [
    ...(declaredFields(dto, system) === null && source ? [{
      modelPath: 'PSSYSTEM.json', dto: identifier(source, 'Source system DTO'),
    }] : []),
    ...(declaredFields(dto, system) ?? []).flatMap(field => fieldLinks(field)),
  ]
    .filter(link => link.modelPath && link.dto);
}

export function attachDtoSchemas(contract, models = new Map()) {
  assert.ok(models instanceof Map, 'DTO models must be a Map');
  for (const path of models.keys()) dtoAuthorityPath(path);
  const schemas = new Map();
  const reference = (path, name) => {
    identifier(name, 'DTO reference');
    if (!path) return { schemaId: null, status: 'unresolved', reason: 'entity-model-not-declared' };
    dtoAuthorityPath(path);
    const id = `${path}#${name}`;
    if (!schemas.has(id)) {
      const schema = {
        id, name, modelPath: path, anchor: `dto-${digest(id).slice(0, 16)}`,
        status: 'unresolved', reason: null, kind: null, sourceType: null, sourceMethodDTO: null, fields: [],
      };
      // Install before resolving nested links so cycles remain references.
      schemas.set(id, schema);
      const model = models.get(path);
      const dto = model && definition(model, name, path === 'PSSYSTEM.json');
      if (!model) schema.reason = 'entity-model-unavailable';
      else if (!dto) schema.reason = 'dto-not-declared';
      else {
        schema.kind = scalar(dto.type, `${name}.type`);
        schema.sourceType = scalar(dto.sourceType, `${name}.sourceType`);
        schema.sourceMethodDTO = dto.getSrcPSSysMethodDTO?.id
          ? identifier(dto.getSrcPSSysMethodDTO.id, `${name}.sourceMethodDTO`) : null;
        let fields = declaredFields(dto, path === 'PSSYSTEM.json');
        if (fields === null && schema.sourceMethodDTO) {
          const sourceModel = models.get('PSSYSTEM.json');
          const sourceDto = sourceModel && definition(sourceModel, schema.sourceMethodDTO, true);
          const sourceFields = sourceDto ? declaredFields(sourceDto, true) : null;
          schema.fieldSource = {
            modelPath: 'PSSYSTEM.json', dto: schema.sourceMethodDTO,
            status: sourceFields === null ? 'unresolved' : 'resolved',
            reason: !sourceModel ? 'system-dto-model-unavailable'
              : !sourceDto ? 'system-dto-not-declared'
                : sourceFields === null ? 'system-dto-fields-not-declared' : null,
          };
          if (sourceFields !== null) fields = sourceFields;
        }
        if (fields === null) schema.reason = 'dto-fields-not-declared';
        else {
          schema.status = 'resolved';
          schema.fields = fields.map(field => {
            const fieldName = identifier(field.name, `${name}.field`);
            assert.ok(['SIMPLE', 'SIMPLES', 'DTO', 'DTOS'].includes(field.type),
              `${name}.${fieldName}: unsupported DTO field type`);
            const links = fieldLinks(field).map(link => {
              const resolved = link.modelPath && link.dto
                ? reference(link.modelPath, link.dto)
                : { schemaId: null, status: 'unresolved', reason: 'incomplete-dto-reference' };
              return { ...link, ...resolved };
            });
            return {
              code: fieldName,
              sourceLabel: scalar(field.logicName ?? field.name, `${name}.${fieldName}.label`),
              modelField: field.getPSDEField?.codeName
                ? identifier(field.getPSDEField.codeName, `${name}.${fieldName}.modelField`) : null,
              type: field.type,
              stdDataType: number(field.stdDataType, `${name}.${fieldName}.stdDataType`),
              length: number(field.stringLength, `${name}.${fieldName}.length`),
              nullable: boolean(field.allowEmpty, `${name}.${fieldName}.nullable`),
              readOnly: boolean(field.readOnly, `${name}.${fieldName}.readOnly`),
              listMap: boolean(field.listMap, `${name}.${fieldName}.listMap`),
              jsonFormat: scalar(field.jsonFormat, `${name}.${fieldName}.jsonFormat`),
              sourceType: scalar(field.sourceType, `${name}.${fieldName}.sourceType`),
              searchMode: field.getPSDEFSearchMode?.id
                ? identifier(field.getPSDEFSearchMode.id, `${name}.${fieldName}.searchMode`) : null,
              links,
            };
          });
          assert.equal(new Set(schema.fields.map(field => field.code.toLowerCase())).size,
            schema.fields.length, `${name}: duplicate DTO fields`);
        }
      }
    }
    const schema = schemas.get(id);
    return { schemaId: id, status: schema.status, reason: schema.reason };
  };
  const methodRefs = [];
  const directSchemas = new Set();
  for (const entity of contract.entities) {
    const ids = new Set();
    for (const method of [
      ...entity.operations, ...entity.relationships.flatMap(relation => relation.operations),
    ]) for (const value of [method.input, method.output]) {
      if (!value.dto) continue;
      Object.assign(value, reference(entity.modelPath, value.dto));
      methodRefs.push(value);
      if (value.schemaId) { ids.add(value.schemaId); directSchemas.add(value.schemaId); }
    }
    const queue = [...ids];
    for (let index = 0; index < queue.length; index++) {
      for (const link of (schemas.get(queue[index])?.fields ?? []).flatMap(field => field.links)) {
        if (!link.schemaId || ids.has(link.schemaId)) continue;
        ids.add(link.schemaId);
        queue.push(link.schemaId);
      }
    }
    entity.dtoSchemaIds = [...ids].sort(compare);
  }
  // Nested cycles may have captured a pending status; refresh once the graph is complete.
  for (const schema of schemas.values()) for (const field of schema.fields) for (const link of field.links) {
    if (!link.schemaId) continue;
    const target = schemas.get(link.schemaId);
    link.status = target.status;
    link.reason = target.reason;
    if (link.field && target.status === 'resolved' &&
        !target.fields.some(candidate => candidate.code === link.field)) {
      link.status = 'unresolved';
      link.reason = 'related-field-not-declared';
    }
  }
  contract.dtoSchemas = [...schemas.values()].sort((a, b) => compare(a.id, b.id));
  const nested = contract.dtoSchemas.flatMap(schema => schema.fields.flatMap(field => field.links));
  contract.dtoCoverage = {
    methodReferences: methodRefs.length,
    resolvedMethodReferences: methodRefs.filter(ref => ref.status === 'resolved').length,
    unresolvedMethodReferences: methodRefs.filter(ref => ref.status !== 'resolved').length,
    directSchemas: directSchemas.size,
    schemas: schemas.size,
    resolvedSchemas: contract.dtoSchemas.filter(schema => schema.status === 'resolved').length,
    fields: contract.dtoSchemas.reduce((sum, schema) => sum + schema.fields.length, 0),
    filterSchemas: contract.dtoSchemas.filter(schema => schema.kind === 'DEFILTER').length,
    nestedReferences: nested.length,
    unresolvedNestedReferences: nested.filter(link => link.status !== 'resolved').length,
    unresolved: [
      ...contract.dtoSchemas.filter(schema => schema.status !== 'resolved').map(schema => ({
        modelPath: schema.modelPath, dto: schema.name, reason: schema.reason,
      })),
      ...nested.filter(link => link.status !== 'resolved').map(link => ({
        modelPath: link.modelPath, dto: link.dto, field: link.field, reason: link.reason,
      })),
    ],
  };
  return contract;
}
