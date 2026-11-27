/**
 * The path currently open in the reader, if any. Kept outside Redux because it
 * is transient UI state, but shared by every cloud-apply path that must avoid
 * changing what a person is actively reading.
 */
let activeReaderPathId: number | null = null;

export const setActiveReaderPath = (pathId: number | null): void => {
  activeReaderPathId = pathId;
};

export const getActiveReaderPath = (): number | null => activeReaderPathId;
