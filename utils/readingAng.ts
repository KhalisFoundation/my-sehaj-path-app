/**
 * A new path uses Ang 0 as its stored "not started" progress sentinel.
 * The reader and all reader-facing UI must use the first real ang instead.
 */
export const displayReadingAng = (angNumber: number): number => (angNumber === 0 ? 1 : angNumber);
