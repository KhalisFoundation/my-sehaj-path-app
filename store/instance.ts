import { store } from './index';
import { createLegacyPersistence } from './persistence';

/**
 * The single persistence coordinator for the app-wide store.
 *
 * Lives in its own module so both `App.tsx` (lifecycle) and `store/commands.ts`
 * (acknowledged saves) can reach it without importing each other.
 */
export const persistence = createLegacyPersistence(store);
