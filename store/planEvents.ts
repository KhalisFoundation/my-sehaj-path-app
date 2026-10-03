type PlanRefreshListener = (sehajPathId: string, startsAt?: Date) => void;

const listeners = new Set<PlanRefreshListener>();

export const subscribePlanRefresh = (listener: PlanRefreshListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const notifyPlanRefresh = (sehajPathId: string, startsAt?: Date): void => {
  listeners.forEach((listener) => listener(sehajPathId, startsAt));
};
