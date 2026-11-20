import AsyncStorage from '@react-native-async-storage/async-storage';
import { isSameOrBeforeDateTime } from '../utils/dateTime';

type StoredInvite = { link: string; expiresAt: string | null };
export type StoredInviteState = 'none' | 'active' | 'expired';
const keyFor = (sehajPathId: string): string => `sehaj-path-invite:${sehajPathId}`;

/**
 * Read the last invite minted on this device.
 *
 * Keep an expired record until a replacement is created.  Its token is still
 * useful as a local state marker: the invite sheet can explain that the last
 * link expired instead of incorrectly presenting the first-link UI.  Callers
 * that need a usable link should use getStoredInviteLink(), which filters it.
 */
export const getStoredInvite = async (sehajPathId: string): Promise<StoredInvite | null> => {
  const raw = await AsyncStorage.getItem(keyFor(sehajPathId));
  if (!raw) {
    return null;
  }
  try {
    const stored = JSON.parse(raw) as StoredInvite;
    if (!stored.link) {
      await AsyncStorage.removeItem(keyFor(sehajPathId));
      return null;
    }
    return stored;
  } catch {
    return null;
  }
};

export const getStoredInviteLink = async (sehajPathId: string): Promise<string | null> => {
  const stored = await getStoredInvite(sehajPathId);
  if (
    stored === null ||
    (stored.expiresAt !== null && isSameOrBeforeDateTime(stored.expiresAt, new Date()))
  ) {
    return null;
  }
  return stored.link;
};

/** Reads invite state without deleting an expired cached record. */
export const getStoredInviteState = async (sehajPathId: string): Promise<StoredInviteState> => {
  const raw = await AsyncStorage.getItem(keyFor(sehajPathId));
  if (!raw) {
    return 'none';
  }
  try {
    const stored = JSON.parse(raw) as StoredInvite;
    if (!stored.link) {
      return 'none';
    }
    return stored.expiresAt !== null && isSameOrBeforeDateTime(stored.expiresAt, new Date())
      ? 'expired'
      : 'active';
  } catch {
    return 'none';
  }
};

export const storeInviteLink = async (
  sehajPathId: string,
  link: string,
  expiresAt: string | null
): Promise<void> => {
  await AsyncStorage.setItem(keyFor(sehajPathId), JSON.stringify({ link, expiresAt }));
};
