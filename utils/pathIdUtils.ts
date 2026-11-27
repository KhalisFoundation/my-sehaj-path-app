import uuid from 'react-native-uuid';

/**
 * UUID v4 for API path ids. Uses `react-native-uuid` — a single pure-JS package
 * that works under Hermes with no native polyfill, unlike `crypto.randomUUID()`.
 */
export const generateUuid = (): string => uuid.v4() as string;

/**
 * Returns the UUID used by the API for a local numeric path id, creating and
 * mapping one on first use. The caller should persist the returned map with its
 * sync metadata.
 */
export const getOrCreatePathUuid = (pathId: number, pathUuids: Record<number, string>) => {
  const existingUuid = pathUuids[pathId];

  if (existingUuid) {
    return { pathUuid: existingUuid, pathUuids };
  }

  const pathUuid = generateUuid();

  return {
    pathUuid,
    pathUuids: { ...pathUuids, [pathId]: pathUuid },
  };
};
