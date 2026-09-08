import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeStore } from '../../store';
import { createLegacyPersistence, hydrateStore } from '../../store/persistence';
import {
  ACCOUNT_SNAPSHOTS_KEY,
  readAccountSnapshot,
  saveAccountSnapshot,
} from '../../store/accountSnapshots';
import { toSettingsBody } from '../../store/syncRequest';
import { JOURNAL_KEY, LEGACY_KEYS, serializeKey } from '../../store/legacyFormat';
import { READING_PREFERENCES_KEY, parseReadingPreferences } from '../../store/readingPreferences';
import { toPersisted } from '../../store/syncFormat';
import { setLarivaarAssist } from '../../store/slices/settingsSlice';

jest.mock('../../utils/crashlytics', () => ({ recordError: jest.fn() }));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('additional reading preferences', () => {
  it.each([null, undefined, '', 'broken', '[]', 'null', 'true', '{"larivaarAssist":"true"}'])(
    'keeps defaults for absent or malformed preferences: %j',
    (raw) => expect(parseReadingPreferences(raw)).toEqual({})
  );

  it('persists Assist through restart without changing legacy key formats', async () => {
    await AsyncStorage.setItem('larivaar', 'false');
    const store = makeStore();
    expect(await hydrateStore(store)).toBe(true);
    const persistence = createLegacyPersistence(store);
    persistence.start();
    store.dispatch(setLarivaarAssist(true));
    expect(await persistence.flush()).toBe(true);
    persistence.stop();
    const restarted = makeStore();
    expect(await hydrateStore(restarted)).toBe(true);
    expect(restarted.getState().settings.larivaarAssist).toBe(true);
    expect(await AsyncStorage.getItem(READING_PREFERENCES_KEY)).toBe('{"larivaarAssist":true}');
    expect(await AsyncStorage.getItem('larivaar')).toBe('false');
    expect(LEGACY_KEYS).not.toContain(READING_PREFERENCES_KEY);
    expect(await AsyncStorage.getItem(JOURNAL_KEY)).toBeNull();
    expect(toSettingsBody(restarted.getState().settings).settings.larivaarAssist).toBe(true);
  });

  it('includes Assist in account snapshots', async () => {
    const store = makeStore();
    const state = store.getState();
    const snapshot = {
      settings: { ...state.settings, larivaarAssist: true },
      paths: [],
      dates: [],
      sync: { ...toPersisted(state.sync), account: 'reader@example.com' },
    };
    expect(serializeKey(READING_PREFERENCES_KEY, snapshot)).toBe('{"larivaarAssist":true}');
    expect(await saveAccountSnapshot('reader@example.com', snapshot)).toBe(true);
    const restored = await readAccountSnapshot('reader@example.com');
    expect(restored.status).toBe('valid');
    if (restored.status === 'valid') {
      expect(restored.snapshot.settings.larivaarAssist).toBe(true);
    }
    const raw = await AsyncStorage.getItem(ACCOUNT_SNAPSHOTS_KEY);
    const oldEnvelope = JSON.parse(raw!);
    delete oldEnvelope.accounts['reader@example.com'].readingPreferences;
    await AsyncStorage.setItem(ACCOUNT_SNAPSHOTS_KEY, JSON.stringify(oldEnvelope));
    const oldSnapshot = await readAccountSnapshot('reader@example.com');
    expect(oldSnapshot.status).toBe('valid');
    if (oldSnapshot.status === 'valid') {
      expect(oldSnapshot.snapshot.settings.larivaarAssist).toBe(false);
    }
  });
});
