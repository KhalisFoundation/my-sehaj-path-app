/**
 * Fix "now" for a test without freezing timers.
 *
 * A test that builds its data from the real clock behaves differently at
 * 23:49 than at 10:00: "thirty minutes from now" lands tomorrow, and a screen
 * that opens on "today" opens on a different day. Pinning only `Date` gives
 * every run the same morning, while real timers keep running so `waitFor` and
 * `findBy*` still work.
 *
 * Call `pinClock()` in `beforeEach` and `unpinClock()` in `afterEach`.
 */
export const PINNED_MORNING = new Date(2030, 0, 15, 10, 0, 0);

export const pinClock = (now: Date = PINNED_MORNING): void => {
  jest.useFakeTimers({
    now,
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
  });
};

export const unpinClock = (): void => {
  jest.useRealTimers();
};
