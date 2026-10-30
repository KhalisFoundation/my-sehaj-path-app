type PlanRefreshListener = (sehajPathId: string, startsAt?: Date) => void;

const listeners = new Set<PlanRefreshListener>();
const latestRefreshes = new Map<string, { startsAt?: Date; emittedAt: number }>();
const REFRESH_REPLAY_WINDOW_MS = 30_000;

/**
 * A notification can request a plan refresh just before TurnsTab mounts. Keep
 * that request briefly so the destination tab reloads immediately instead of
 * waiting for its ordinary focus/network cycle.
 */
export const subscribePlanRefresh = (
  listener: PlanRefreshListener,
  sehajPathId?: string
): (() => void) => {
  listeners.add(listener);
  if (sehajPathId !== undefined) {
    const latest = latestRefreshes.get(sehajPathId);
    if (latest !== undefined) {
      if (Date.now() - latest.emittedAt <= REFRESH_REPLAY_WINDOW_MS) {
        listener(sehajPathId, latest.startsAt);
      } else {
        latestRefreshes.delete(sehajPathId);
      }
    }
  }
  return () => listeners.delete(listener);
};

export const notifyPlanRefresh = (sehajPathId: string, startsAt?: Date): void => {
  latestRefreshes.set(sehajPathId, { startsAt, emittedAt: Date.now() });
  listeners.forEach((listener) => listener(sehajPathId, startsAt));
};
