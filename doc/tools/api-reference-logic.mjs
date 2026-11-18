import { createHash } from 'node:crypto';

const hash = value => createHash('sha256').update(value).digest('hex');
const entityPath = 'PSMODULES/ProdMgmt/PSDATAENTITIES/idea.json';
const actionPath = 'PSMODULES/ProdMgmt/PSDATAENTITIES/idea/PSDEACTIONS/get_customer_score.json';
const logicPath = 'PSMODULES/ProdMgmt/PSDATAENTITIES/idea/PSDELOGICS/get_customer_score.json';
const resultDTO = 'idea_def_group_common_dto';
const codeSha256 = '89dcb6d441125af74b9a0c41648586c8a7099544a8456e5825390440b2dec180';

// These are reviewed assignments, not inferred DTO members or inferred value types.
const fields = Object.freeze(['customer_score', 'customer_score_precent']);

function sourceAction(model) {
  const matches = (model?.getAllPSDEActions ?? []).filter(action =>
    action.dynaModelFilePath === actionPath);
  return matches.length === 1 ? matches[0] : undefined;
}

export function logicOutputRequests(models) {
  const action = sourceAction(models.get(entityPath));
  return action?.actionType === 'DELOGIC' &&
    action.getPSDEActionReturn?.getPSDEMethodDTO?.id === resultDTO &&
    action.getPSDELogic?.path === logicPath ? [logicPath] : [];
}

function observedOutput(action, logic) {
  if (!action || action.actionType !== 'DELOGIC' ||
      action.getPSDEActionReturn?.type !== 'DTO' ||
      action.getPSDEActionReturn?.getPSDEMethodDTO?.id !== resultDTO ||
      action.getPSDELogic?.path !== logicPath) return null;
  if (!logic || logic.dynaModelFilePath !== logicPath) return null;
  const nodes = logic.getPSDELogicNodes;
  if (!Array.isArray(nodes) || nodes.length !== 5) return null;
  const chain = [
    ['Begin', 'BEGIN', 'PREPAREPARAM1'],
    ['PREPAREPARAM1', 'PREPAREPARAM', 'DEDATASET1'],
    ['DEDATASET1', 'DEDATASET', 'RAWSFCODE1'],
    ['RAWSFCODE1', 'RAWSFCODE', 'END1'],
    ['END1', 'END', undefined],
  ];
  for (const [name, type, next] of chain) {
    const matches = nodes.filter(node => node.codeName === name && node.logicNodeType === type);
    if (matches.length !== 1) return null;
    const links = matches[0].getPSDELogicLinks ?? [];
    if (next ? links.length !== 1 || links[0].getDstPSDELogicNode?.id !== next : links.length !== 0) return null;
  }
  const raw = nodes.find(node => node.codeName === 'RAWSFCODE1');
  const end = nodes.find(node => node.codeName === 'END1');
  const params = (logic.getPSDELogicParams ?? []).filter(param => param.codeName === 'result');
  if (logic.getStartPSDELogicNode?.id !== 'Begin' || raw.codeType !== 'Groovy' ||
      typeof raw.code !== 'string' || hash(raw.code) !== codeSha256 ||
      end.returnType !== 'LOGICPARAM' || end.getReturnParam?.id !== 'result' ||
      params.length !== 1 || params[0].entityParam !== true ||
      params[0].getParamPSDataEntity?.path !== entityPath) return null;
  return {
    status: 'source-observed-not-schema', modelPath: logicPath, actionPath,
    returnParam: 'result', codeSha256,
    fields: fields.map(code => ({ code, type: null, nullable: null, dtoDeclaration: false })),
    dtoDeclarationComplete: false, runtimeSerializationVerified: false,
  };
}

export function attachLogicOutputFields(contract, models, logicModels = new Map()) {
  const action = sourceAction(models.get(entityPath));
  const observed = observedOutput(action, logicModels.get(logicPath));
  let references = 0;
  for (const entity of contract.entities) {
    if (entity.modelPath !== entityPath) continue;
    for (const operation of [
      ...entity.operations, ...entity.relationships.flatMap(relation => relation.operations),
    ]) {
      if (operation.sourceAction !== actionPath || operation.output.type !== 'DTO' ||
          operation.output.dto !== resultDTO) continue;
      if (observed) {
        operation.logicOutput = observed;
        references++;
      }
    }
  }
  contract.logicOutputCoverage = {
    methodReferences: references, observedFields: observed && references ? fields.length : 0,
    fieldsAreDTODeclarations: false, runtimeSerializationVerified: false,
  };
  return contract;
}
