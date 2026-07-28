import { store } from './index';
import { createLegacyPersistence, type LegacyPersistence } from './persistence';

/**
 * The single persistence coordinator for the app-wide store.
 *
 * Lives in its own module so both `App.tsx` (lifecycle) and `store/commands.ts`
 * (acknowledged saves) can reach it without importing each other.
 *
 * Typed as the narrow `LegacyPersistence` so production code cannot reach the
 * test-only `getStatus`.
 */
export const persistence: LegacyPersistence = createLegacyPersistence(store);
