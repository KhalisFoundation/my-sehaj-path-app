import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Middleware } from '@reduxjs/toolkit';
import { recordError } from '../utils/crashlytics';
import type { RootState } from './index';
import type { PathMemberMetadata, PathMemberPreview } from './slices/memberMetadataSlice';

/**
 * Deliberately separate from `sehajSyncMeta_v1`.
 *
 * Member previews are replaceable card decoration, while sync metadata is the
 * compatibility-critical path/id/outbox document. Old binaries never read this
 * key, so they can safely run after a newer build has written it.
 */
export const MEMBER_METADATA_KEY = 'sehajMemberMeta_v1';

interface MemberMetadataEnvelope {
  version: 1;
  account: string;
  paths: Record<string, PathMemberMetadata>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPositivePathId = (value: string): boolean => /^[1-9][0-9]*$/.test(value);

const isPreview = (value: unknown): value is PathMemberPreview =>
  isObject(value) &&
  typeof value.id === 'string' &&
  value.id.length > 0 &&
  typeof value.displayLabel === 'string' &&
  typeof value.hasAvatar === 'boolean' &&
  (value.avatarUpdatedAt === undefined ||
    value.avatarUpdatedAt === null ||
    typeof value.avatarUpdatedAt === 'string');

const isPathMemberMetadata = (value: unknown): value is PathMemberMetadata =>
  isObject(value) &&
  Number.isInteger(value.memberCount) &&
  typeof value.memberCount === 'number' &&
  value.memberCount >= 0 &&
  Array.isArray(value.memberPreviews) &&
  value.memberPreviews.every(isPreview);

const normalizeAccount = (account: string): string => account.trim().toLowerCase();

const parseEnvelope = (raw: string | null): MemberMetadataEnvelope | null => {
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isObject(parsed) ||
      parsed.version !== 1 ||
      typeof parsed.account !== 'string' ||
      parsed.account.trim() === '' ||
      !isObject(parsed.paths) ||
      !Object.entries(parsed.paths).every(
        ([pathId, value]) => isPositivePathId(pathId) && isPathMemberMetadata(value)
      )
    ) {
      return null;
    }
    return parsed as unknown as MemberMetadataEnvelope;
  } catch {
    return null;
  }
};

export const readMemberMetadata = async (
  account: string | null
): Promise<Record<number, PathMemberMetadata>> => {
  if (!account) {
    return {};
  }
  try {
    const parsed = parseEnvelope(await AsyncStorage.getItem(MEMBER_METADATA_KEY));
    if (!parsed || normalizeAccount(parsed.account) !== normalizeAccount(account)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed.paths).map(([pathId, metadata]) => [Number(pathId), metadata])
    );
  } catch (error) {
    recordError(error, 'memberMetadata: read failed');
    return {};
  }
};

export const writeMemberMetadata = async (
  account: string | null,
  byPathId: Record<number, PathMemberMetadata>
): Promise<boolean> => {
  try {
    if (!account) {
      await AsyncStorage.removeItem(MEMBER_METADATA_KEY);
      return true;
    }
    const paths = Object.fromEntries(
      Object.entries(byPathId).filter(
        ([pathId, metadata]) => isPositivePathId(pathId) && isPathMemberMetadata(metadata)
      )
    );
    await AsyncStorage.setItem(
      MEMBER_METADATA_KEY,
      JSON.stringify({
        version: 1,
        account: normalizeAccount(account),
        paths,
      } satisfies MemberMetadataEnvelope)
    );
    return true;
  } catch (error) {
    // This is card decoration only. A failed cache write must never pause core
    // path sync; V2 will repopulate it on a later refresh.
    recordError(error, 'memberMetadata: write failed');
    return false;
  }
};

/**
 * Persist the independent UI cache after its Redux slice changes. It is kept
 * outside the crash-recoverable path journal on purpose: losing it only hides
 * avatars/counts until V2 refreshes, while putting an unknown key in the old
 * journal would itself break a rollback.
 */
export const createMemberMetadataPersistenceMiddleware = (): Middleware<{}, RootState> => {
  let lastSerialized: string | null | undefined;
  let requested = false;
  let writing = false;

  const schedule = (getState: () => RootState) => {
    requested = true;
    if (writing) {
      return;
    }
    writing = true;
    Promise.resolve().then(async () => {
      try {
        while (requested) {
          requested = false;
          const current = getState();
          if (!current.sync.hydrated || !current.memberMetadata.hydrated) {
            continue;
          }
          // Sync owns the active account boundary. The card cache is cleared
          // with a switch, then V2 refills it after `setAccount` succeeds.
          // Reading the account from sync here prevents that short interval
          // from accidentally deleting a freshly rebuilt cache.
          const { account } = current.sync;
          let serialized: string | null = null;
          if (account) {
            serialized = JSON.stringify({
              account: normalizeAccount(account),
              paths: current.memberMetadata.byPathId,
            });
          }
          if (serialized === lastSerialized) {
            continue;
          }
          if (await writeMemberMetadata(account, current.memberMetadata.byPathId)) {
            lastSerialized = serialized;
          }
        }
      } finally {
        writing = false;
      }
    });
  };

  return (api) => (next) => (action) => {
    const previous = api.getState();
    const result = next(action);
    const state = api.getState();
    if (!state.sync.hydrated || !state.memberMetadata.hydrated) {
      return result;
    }
    if (
      previous.memberMetadata === state.memberMetadata &&
      previous.sync.account === state.sync.account &&
      previous.sync.hydrated === state.sync.hydrated
    ) {
      return result;
    }
    schedule(api.getState);
    return result;
  };
};
