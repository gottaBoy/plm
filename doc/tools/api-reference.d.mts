export function createApiReferenceContract(
  model: Record<string, any>,
  options?: {
    dtoModels?: Map<string, Record<string, any>>;
    logicModels?: Map<string, Record<string, any>>;
    dtoRuntimeSources?: Map<string, Buffer | string>;
  },
): Record<string, any>;
export function renderApiReferenceFiles(
  contract: Record<string, any>,
  options?: { englishLabels?: Record<string, string>; inputHashes?: Array<Record<string, unknown>> },
): Map<string, Buffer>;
export function buildApiReferenceFiles(options: { sourceDirectory: string }): Promise<Map<string, Buffer>>;
