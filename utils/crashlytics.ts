import {
  getCrashlytics,
  log,
  recordError as crashlyticsRecordError,
  setAttributes,
  setCrashlyticsCollectionEnabled,
  crash,
} from '@react-native-firebase/crashlytics';

const instance = getCrashlytics();
const ATTRIBUTE_WRITE_TIMEOUT_MS = 5_000;

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const allowCrashReporting = async (): Promise<void> => {
  try {
    await setCrashlyticsCollectionEnabled(instance, true);
  } catch (_error) {
    // Silent failure
  }
};

const logBreadcrumb = (message: string): void => {
  try {
    log(instance, message);
  } catch (_error) {
    // Silent failure
  }
};

/** Firebase has no "remove key", so blanking is how a key stops applying. */
const blanked = (attributes: Record<string, string>): Record<string, string> =>
  Object.fromEntries(Object.keys(attributes).map((key) => [key, '']));

const withTimeout = <T>(promise: Promise<T>, milliseconds: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Crashlytics attribute write timed out')),
      milliseconds
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

/**
 * Writes one report with its keys scoped to just that report.
 *
 * Three ordering rules make this correct, and all three are easy to get wrong:
 *
 * 1. `setAttributes` is async while `recordError` is not, so the await matters —
 *    without it the report is captured before the key attaches.
 * 2. Custom keys live on the SESSION, not on a report. They persist until
 *    overwritten, so they are blanked afterwards; otherwise the next unrelated
 *    error inherits a stale `db_failure_kind` and looks like a DB failure.
 * 3. A failure to attach keys must never suppress the report itself, hence the
 *    separate try blocks.
 */
const writeReport = async (
  error: unknown,
  context?: string,
  attributes?: Record<string, string>
): Promise<void> => {
  if (attributes) {
    try {
      await withTimeout(setAttributes(instance, attributes), ATTRIBUTE_WRITE_TIMEOUT_MS);
    } catch (_error) {
      // Still report it, just without the filterable key.
    }
  }
  try {
    if (context) {
      log(instance, context);
    }
    crashlyticsRecordError(instance, toError(error));
  } catch (_error) {
    // Silent failure
  }
  if (attributes) {
    try {
      await withTimeout(setAttributes(instance, blanked(attributes)), ATTRIBUTE_WRITE_TIMEOUT_MS);
    } catch (_error) {
      // Silent failure
    }
  }
};

/**
 * Reports are serialized. Because the set/record/blank sequence spans an await,
 * two concurrent reports would otherwise interleave — one blanking the keys the
 * other had just set, or recording under the other's kind.
 */
let reportQueue: Promise<void> = Promise.resolve();

/**
 * Records a handled error, optionally tagging it for filtering.
 *
 * `context` is a breadcrumb: it shows up in the session log but does NOT split
 * Crashlytics issues, which group by stack trace. Two failures raised from the
 * same line land in one issue however different their contexts are. Pass
 * `attributes` for anything you need to filter or segment by — those become
 * custom keys, scoped to this report only.
 */
const recordError = (
  error: unknown,
  context?: string,
  attributes?: Record<string, string>
): void => {
  reportQueue = reportQueue
    .then(() => writeReport(error, context, attributes))
    .catch(() => undefined);
};

const testCrash = (): void => {
  crash(instance);
};

export { allowCrashReporting, logBreadcrumb, recordError, testCrash };
