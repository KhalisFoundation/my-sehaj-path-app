import {
  getCrashlytics,
  log,
  recordError as crashlyticsRecordError,
  setCrashlyticsCollectionEnabled,
  crash,
} from '@react-native-firebase/crashlytics';

const instance = getCrashlytics();

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

const recordError = (error: unknown, context?: string): void => {
  try {
    if (context) {
      log(instance, context);
    }
    crashlyticsRecordError(instance, toError(error));
  } catch (_error) {
    // Silent failure
  }
};

const testCrash = (): void => {
  crash(instance);
};

export { allowCrashReporting, logBreadcrumb, recordError, testCrash };
