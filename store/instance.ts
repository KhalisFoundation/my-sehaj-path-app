import { store } from './index';
import { createOutboxCoordinator, type OutboxCoordinator } from './outboxCoordinator';
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

/**
 * The single outbox coordinator (Step 7) for the app-wide store. Started/stopped
 * by `App.tsx` alongside `persistence`; its triggers are fired from the sync
 * lifecycle helpers (`store/syncLifecycle.ts`).
 */
export const outbox: OutboxCoordinator = createOutboxCoordinator(store);
