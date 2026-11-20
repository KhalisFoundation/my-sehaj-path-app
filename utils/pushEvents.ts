/**
 * Bridges native notification press events to mounted React screens.
 *
 * Notification callbacks are registered from index.js, before the React tree
 * has necessarily mounted. Events are therefore retained until a screen that
 * can handle them subscribes. A listener returns true when it consumed an
 * event; unmatched events remain queued for a later screen/path.
 */
export type PushTapEvent = {
  id?: string;
  pathId?: string;
  type?: string;
  data: Record<string, unknown>;
};

type PushTapListener = (event: PushTapEvent) => boolean;

const listeners = new Set<PushTapListener>();
const pendingEvents: PushTapEvent[] = [];
const recentlyEmitted = new Map<string, number>();
const DEDUPE_WINDOW_MS = 2000;
const MAX_PENDING_EVENTS = 20;
let flushingPendingEvents = false;

const eventKey = (event: PushTapEvent): string => {
  const contentKey = [
    event.pathId ?? '',
    event.type ?? '',
    event.data.title ?? '',
    event.data.body ?? '',
  ].join('|');
  return contentKey !== '|||' ? contentKey : event.id ?? 'notification-without-content';
};

const pruneRecentEvents = (now: number): void => {
  recentlyEmitted.forEach((timestamp, key) => {
    if (now - timestamp > DEDUPE_WINDOW_MS) {
      recentlyEmitted.delete(key);
    }
  });
};

const deliver = (event: PushTapEvent): boolean => {
  let consumed = false;
  listeners.forEach((listener) => {
    try {
      consumed = listener(event) || consumed;
    } catch {
      // A screen listener must never break notification handling for other
      // mounted screens or prevent the event from being queued.
    }
  });
  return consumed;
};

export const emitPushTap = (event: PushTapEvent): void => {
  const now = Date.now();
  pruneRecentEvents(now);
  const key = eventKey(event);
  const previous = recentlyEmitted.get(key);
  if (previous !== undefined && now - previous <= DEDUPE_WINDOW_MS) {
    return;
  }
  recentlyEmitted.set(key, now);

  if (!deliver(event)) {
    pendingEvents.push(event);
    if (pendingEvents.length > MAX_PENDING_EVENTS) {
      pendingEvents.splice(0, pendingEvents.length - MAX_PENDING_EVENTS);
    }
  }
};

export const subscribePushTap = (listener: PushTapListener): (() => void) => {
  listeners.add(listener);

  // Replay queued events immediately. Keep events for other paths/screens.
  for (let index = pendingEvents.length - 1; index >= 0; index -= 1) {
    let consumed = false;
    try {
      consumed = listener(pendingEvents[index]);
    } catch {
      // A screen listener must not prevent the subscription from completing.
    }
    if (consumed) {
      pendingEvents.splice(index, 1);
    }
  }

  return () => {
    listeners.delete(listener);
  };
};

/**
 * Re-attempts notification taps that arrived before navigation was ready.
 *
 * A cold start can move from Splash to Home without mounting a new screen, so
 * replaying only when a screen subscribes is not sufficient for the app-wide
 * navigation listener. Callers should invoke this after a navigation state
 * transition; unmatched events remain buffered.
 */
export const flushPendingPushTaps = (): void => {
  // A listener can navigate synchronously, which invokes NavigationContainer's
  // onStateChange while this function is still delivering the event. Prevent a
  // nested flush from delivering the same tap twice.
  if (flushingPendingEvents || pendingEvents.length === 0) {
    return;
  }
  flushingPendingEvents = true;
  try {
    const queued = pendingEvents.splice(0, pendingEvents.length);
    const remaining: PushTapEvent[] = [];
    queued.forEach((event) => {
      let consumed = false;
      try {
        consumed = deliver(event);
      } catch {
        // Keep the event queued if a listener fails during a retry.
      }
      if (!consumed) {
        remaining.push(event);
      }
    });
    // Preserve events emitted while flushing, then retain the unmatched taps.
    pendingEvents.push(...remaining);
    if (pendingEvents.length > MAX_PENDING_EVENTS) {
      pendingEvents.splice(0, pendingEvents.length - MAX_PENDING_EVENTS);
    }
  } finally {
    flushingPendingEvents = false;
  }
};
