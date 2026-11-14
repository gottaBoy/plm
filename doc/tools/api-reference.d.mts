export function createApiReferenceContract(model: Record<string, any>): Record<string, any>;
export function renderApiReferenceFiles(
  contract: Record<string, any>,
  options?: { englishLabels?: Record<string, string>; inputHashes?: Array<Record<string, unknown>> },
): Map<string, Buffer>;
export function buildApiReferenceFiles(options: { sourceDirectory: string }): Promise<Map<string, Buffer>>;
