import AsyncStorage from '@react-native-async-storage/async-storage';
import { recordError } from '@utils';
import {
  appendFile,
  downloadFile,
  exists,
  moveFile,
  read,
  stat,
  stopDownload,
  unlink,
} from '@dr.pogodin/react-native-fs';

const RESUME_MANIFEST_KEY = '@sehaj-path/db-download-resume-v1';
const APPEND_BUFFER_BYTES = 1024 * 1024;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [500, 1500] as const;

type ResumeManifest = {
  version: 1;
  url: string;
  validator: string;
  totalBytes: number;
};

type BeginInfo = {
  statusCode: number;
  contentLength: number;
  headers: Record<string, string>;
  rangeStart: number | null;
  totalBytes: number | null;
  validator: string;
};

export type ResumableDownloadResult = {
  statusCode: number;
  bytesWritten: number;
};

type Options = {
  fromUrl: string;
  toFile: string;
  connectionTimeout: number;
  readTimeout: number;
  idleTimeout: number;
  cancelGrace: number;
  onProgress: (bytesWritten: number, totalBytes: number) => void;
};

const resumePartPath = (toFile: string): string => `${toFile}.resume`;

const safeUnlink = async (path: string): Promise<void> => {
  try {
    if (await exists(path)) {
      await unlink(path);
    }
  } catch {
    // Best effort. A later write still reports the authoritative error.
  }
};

const clearManifest = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(RESUME_MANIFEST_KEY);
  } catch {
    // A stale manifest is validated against URL, validator and file size before use.
  }
};

const saveManifest = async (manifest: ResumeManifest): Promise<void> => {
  try {
    await AsyncStorage.setItem(RESUME_MANIFEST_KEY, JSON.stringify(manifest));
  } catch {
    // Losing the manifest only costs a restart from zero on the next attempt;
    // it must never fail the download that is currently succeeding.
  }
};

const loadManifest = async (): Promise<ResumeManifest | null> => {
  try {
    const raw = await AsyncStorage.getItem(RESUME_MANIFEST_KEY);
    if (!raw) {
      return null;
    }
    const value = JSON.parse(raw) as Partial<ResumeManifest>;
    return value.version === 1 &&
      typeof value.url === 'string' &&
      typeof value.validator === 'string' &&
      value.validator.length > 0 &&
      typeof value.totalBytes === 'number' &&
      Number.isFinite(value.totalBytes) &&
      value.totalBytes > 0
      ? (value as ResumeManifest)
      : null;
  } catch {
    return null;
  }
};

const fileSize = async (path: string): Promise<number> => {
  try {
    if (!(await exists(path))) {
      return 0;
    }
    const size = Number((await stat(path)).size);
    return Number.isFinite(size) && size > 0 ? size : 0;
  } catch {
    return 0;
  }
};

const header = (headers: Record<string, string>, name: string): string => {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1] ?? '';
};

const parseContentRange = (value: string): { start: number; end: number; total: number } | null => {
  const match = /^bytes (\d+)-(\d+)\/(\d+)$/i.exec(value.trim());
  if (!match) {
    return null;
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  return Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(total)
    ? { start, end, total }
    : null;
};

const normalizeBegin = (
  statusCode: number,
  contentLength: number,
  headers: Record<string, string>,
  previousValidator = ''
): BeginInfo => {
  const range = parseContentRange(header(headers, 'content-range'));
  return {
    statusCode,
    contentLength,
    headers,
    rangeStart: range?.start ?? null,
    totalBytes: range?.total ?? (statusCode === 200 && contentLength > 0 ? contentLength : null),
    validator: header(headers, 'etag') || header(headers, 'last-modified') || previousValidator,
  };
};

const awaitWithIdleTimeout = <T>(
  promise: Promise<T>,
  jobId: number,
  idleTimeout: number,
  cancelGrace: number,
  registerTouch: (touch: () => void) => void
): Promise<T> => {
  return new Promise((resolve, reject) => {
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelTimer: ReturnType<typeof setTimeout> | null = null;
    let stalled = false;
    let settled = false;
    const stalledError = new Error('database download stalled');

    const clearTimers = () => {
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
      }
      if (cancelTimer !== null) {
        clearTimeout(cancelTimer);
      }
    };
    const finish = (settle: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimers();
      settle();
    };
    const abandon = () => {
      if (stalled || settled) {
        return;
      }
      stalled = true;
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
      }
      try {
        stopDownload(jobId);
      } catch {
        // Native may already have completed.
      }
      cancelTimer = setTimeout(() => finish(() => reject(stalledError)), cancelGrace);
    };
    const touch = () => {
      if (stalled || settled) {
        return;
      }
      if (idleTimer !== null) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(abandon, idleTimeout);
    };

    registerTouch(touch);
    touch();
    promise.then(
      (value) => finish(() => (stalled ? reject(stalledError) : resolve(value))),
      (error) => finish(() => reject(stalled ? stalledError : error))
    );
  });
};

const appendPart = async (partPath: string, destinationPath: string): Promise<number> => {
  const size = await fileSize(partPath);
  for (let position = 0; position < size; position += APPEND_BUFFER_BYTES) {
    const length = Math.min(APPEND_BUFFER_BYTES, size - position);
    const chunk = await read(partPath, length, position, 'base64');
    await appendFile(destinationPath, chunk, 'base64');
  }
  return size;
};

const isImmediateRetryError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'database download stalled') {
    return false;
  }
  return /software caused connection abort|\beconnreset\b|connection reset|unexpected end of stream|premature eof|ended before expected size|socket closed|connection (?:was )?(?:aborted|lost)|broken pipe|timed out|timeout|sockettimeoutexception|-1001|-1005/i.test(
    message
  );
};

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const clearResumableDownloadState = async (toFile: string): Promise<void> => {
  await Promise.all([safeUnlink(toFile), safeUnlink(resumePartPath(toFile)), clearManifest()]);
};

const prepareResume = async (
  fromUrl: string,
  toFile: string
): Promise<{ manifest: ResumeManifest | null; completedBytes: number }> => {
  const manifest = await loadManifest();
  const completedBytes = await fileSize(toFile);
  if (
    !manifest ||
    manifest.url !== fromUrl ||
    completedBytes <= 0 ||
    completedBytes > manifest.totalBytes
  ) {
    if (completedBytes > 0 || manifest) {
      await clearResumableDownloadState(toFile);
    }
    return { manifest: null, completedBytes: 0 };
  }
  return { manifest, completedBytes };
};

export const downloadFileWithResumeAndRetry = async (
  options: Options
): Promise<ResumableDownloadResult> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const prepared = await prepareResume(options.fromUrl, options.toFile);
    if (prepared.manifest && prepared.completedBytes === prepared.manifest.totalBytes) {
      options.onProgress(prepared.completedBytes, prepared.manifest.totalBytes);
      return { statusCode: 200, bytesWritten: prepared.completedBytes };
    }

    const isResume = Boolean(prepared.manifest && prepared.completedBytes > 0);
    const target = isResume ? resumePartPath(options.toFile) : options.toFile;
    if (isResume) {
      await safeUnlink(target);
    }

    // A property holder keeps TypeScript from assuming the callback can never
    // mutate this value before the native promise settles.
    const transfer = { beginInfo: null as BeginInfo | null };
    let manifestSave: Promise<void> = Promise.resolve();
    let touchIdleTimer: (() => void) | null = null;
    const requestHeaders: Record<string, string> = {};
    if (isResume && prepared.manifest) {
      requestHeaders.Range = `bytes=${prepared.completedBytes}-`;
      requestHeaders['If-Range'] = prepared.manifest.validator;
    }

    const { jobId, promise } = downloadFile({
      fromUrl: options.fromUrl,
      toFile: target,
      headers: requestHeaders,
      background: false,
      discretionary: false,
      cacheable: false,
      connectionTimeout: options.connectionTimeout,
      readTimeout: options.readTimeout,
      progressInterval: 250,
      begin: ({ statusCode, contentLength, headers }) => {
        transfer.beginInfo = normalizeBegin(
          statusCode,
          contentLength,
          (headers ?? {}) as Record<string, string>,
          prepared.manifest?.validator
        );
        if (
          transfer.beginInfo.totalBytes &&
          transfer.beginInfo.validator &&
          // A 200 to a range request means If-Range rejected the old entity.
          // Keep the old manifest paired with the old partial until the new
          // response file has actually replaced it below.
          !(isResume && statusCode === 200)
        ) {
          manifestSave = saveManifest({
            version: 1,
            url: options.fromUrl,
            validator: transfer.beginInfo.validator,
            totalBytes: transfer.beginInfo.totalBytes,
          });
        }
      },
      progress: ({ bytesWritten, contentLength }) => {
        touchIdleTimer?.();
        const totalBytes =
          transfer.beginInfo?.totalBytes ??
          prepared.manifest?.totalBytes ??
          contentLength + prepared.completedBytes;
        options.onProgress(prepared.completedBytes + bytesWritten, totalBytes);
      },
    });

    try {
      const result = await awaitWithIdleTimeout(
        promise,
        jobId,
        options.idleTimeout,
        options.cancelGrace,
        (touch) => {
          touchIdleTimer = touch;
        }
      ).finally(() => {
        touchIdleTimer = null;
      });
      await manifestSave;
      const { beginInfo } = transfer;

      const retryableStatus =
        result.statusCode === 408 || result.statusCode === 429 || result.statusCode >= 500;
      if (retryableStatus && attempt < MAX_ATTEMPTS) {
        if (isResume) {
          await safeUnlink(target);
        }
        await wait(RETRY_DELAYS_MS[attempt - 1]);
        continue;
      }

      if (!isResume) {
        if (result.statusCode === 200 && beginInfo?.totalBytes) {
          const actualSize = await fileSize(options.toFile);
          if (actualSize !== beginInfo.totalBytes) {
            throw new Error('database download ended before expected size');
          }
          options.onProgress(actualSize, beginInfo.totalBytes);
          return { statusCode: result.statusCode, bytesWritten: actualSize };
        }
        return { statusCode: result.statusCode, bytesWritten: result.bytesWritten };
      }

      if (
        beginInfo?.statusCode === 206 &&
        beginInfo.rangeStart === prepared.completedBytes &&
        beginInfo.validator === prepared.manifest?.validator
      ) {
        await appendPart(target, options.toFile);
        await safeUnlink(target);
        const assembledSize = await fileSize(options.toFile);
        if (beginInfo.totalBytes && assembledSize !== beginInfo.totalBytes) {
          throw new Error('database download ended before expected size');
        }
        options.onProgress(assembledSize, beginInfo.totalBytes ?? assembledSize);
        return { statusCode: 200, bytesWritten: assembledSize };
      }

      if (beginInfo?.statusCode === 200) {
        // If-Range rejected the old validator: the response is a new full file.
        await safeUnlink(options.toFile);
        await moveFile(target, options.toFile);
        const replacementSize = await fileSize(options.toFile);
        if (beginInfo.totalBytes && beginInfo.validator) {
          await saveManifest({
            version: 1,
            url: options.fromUrl,
            validator: beginInfo.validator,
            totalBytes: beginInfo.totalBytes,
          });
        }
        return { statusCode: 200, bytesWritten: replacementSize };
      }

      return { statusCode: result.statusCode, bytesWritten: result.bytesWritten };
    } catch (error) {
      await manifestSave;
      const { beginInfo } = transfer;
      try {
        if (
          isResume &&
          beginInfo?.statusCode === 206 &&
          beginInfo.rangeStart === prepared.completedBytes &&
          beginInfo.validator === prepared.manifest?.validator
        ) {
          // The validator still matches, so this range belongs to the same
          // entity as the bytes already on disk and is safe to splice on.
          await appendPart(target, options.toFile);
          await safeUnlink(target);
        } else if (isResume && beginInfo?.statusCode === 200) {
          // The entity changed. Keep the prefix of the new full response, never
          // splice it onto bytes belonging to the old validator.
          await safeUnlink(options.toFile);
          if ((await fileSize(target)) > 0) {
            await moveFile(target, options.toFile);
            if (beginInfo.totalBytes && beginInfo.validator) {
              await saveManifest({
                version: 1,
                url: options.fromUrl,
                validator: beginInfo.validator,
                totalBytes: beginInfo.totalBytes,
              });
            }
          }
        }
      } catch (salvageError) {
        // Salvage is best-effort — it only tries to keep bytes that are already
        // on disk. Rethrowing here did real damage: it replaced the original
        // download error, skipped the retry decision below (so a retryable
        // network drop aborted the whole loop), and handed the caller's
        // `classifyDownloadFailure` the wrong exception — reporting a dropped
        // connection as, say, an out-of-space failure.
        //
        // Report it, reclaim the part file so a failed splice cannot strand
        // ~180 MB, and let the original error carry on. `prepareResume` measures
        // the real file size next time, so a half-finished append simply resumes
        // from wherever it actually reached.
        recordError(salvageError, 'db: could not salvage the partial download');
        await safeUnlink(target);
      }

      lastError = error;
      if (attempt >= MAX_ATTEMPTS || !isImmediateRetryError(error)) {
        throw error;
      }
      await wait(RETRY_DELAYS_MS[attempt - 1]);
    }
  }

  throw lastError;
};
