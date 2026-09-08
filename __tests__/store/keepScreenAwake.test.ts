import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeStore } from '../../store';
import { createLegacyPersistence, hydrateStore } from '../../store/persistence';
import { KEEP_SCREEN_AWAKE_KEY, LEGACY_KEYS } from '../../store/legacyFormat';
import { setKeepScreenAwake } from '../../store/slices/settingsSlice';
import {
  ACCOUNT_SNAPSHOTS_KEY,
  readAccountSnapshot,
  saveAccountSnapshot,
} from '../../store/accountSnapshots';
import { toPersisted } from '../../store/syncFormat';
import { toSettingsBody } from '../../store/syncRequest';

jest.mock('../../utils/crashlytics', () => ({ recordError: jest.fn() }));

beforeEach(async () => {
  await AsyncStorage.clear();
});

it.each([null, 'false', 'TRUE', '1', 'broken', '"true"'])(
  'does not opt in for absent or invalid storage %j',
  async (raw) => {
    if (raw !== null) {
      await AsyncStorage.setItem(KEEP_SCREEN_AWAKE_KEY, raw);
    }
    const store = makeStore();
    expect(await hydrateStore(store)).toBe(true);
    expect(store.getState().settings.keepScreenAwake).toBe(false);
  }
);

it('persists opting in and out across relaunch without changing legacy formats', async () => {
  await AsyncStorage.setItem('larivaar', 'false');
  const store = makeStore();
  expect(await hydrateStore(store)).toBe(true);
  const persistence = createLegacyPersistence(store);
  persistence.start();
  for (const value of [true, false]) {
    store.dispatch(setKeepScreenAwake(value));
    expect(await persistence.flush()).toBe(true);
    const restarted = makeStore();
    expect(await hydrateStore(restarted)).toBe(true);
    expect(restarted.getState().settings.keepScreenAwake).toBe(value);
    expect(toSettingsBody(restarted.getState().settings).settings.keepScreenAwake).toBe(value);
    expect(await AsyncStorage.getItem(KEEP_SCREEN_AWAKE_KEY)).toBe(String(value));
  }
  expect(LEGACY_KEYS).not.toContain(KEEP_SCREEN_AWAKE_KEY);
  expect(await AsyncStorage.getItem('larivaar')).toBe('false');
  persistence.stop();
});

it('restores account preferences while old or malformed snapshots remain opted out', async () => {
  const state = makeStore().getState();
  expect(
    await saveAccountSnapshot('reader@example.com', {
      settings: { ...state.settings, keepScreenAwake: true },
      paths: [],
      dates: [],
      sync: { ...toPersisted(state.sync), account: 'reader@example.com' },
    })
  ).toBe(true);
  const restored = await readAccountSnapshot('reader@example.com');
  expect(restored.status).toBe('valid');
  if (restored.status === 'valid') {
    expect(restored.snapshot.settings.keepScreenAwake).toBe(true);
  }
  const envelope = JSON.parse((await AsyncStorage.getItem(ACCOUNT_SNAPSHOTS_KEY))!);
  for (const value of [undefined, 'true']) {
    envelope.accounts['reader@example.com'].keepScreenAwake = value;
    await AsyncStorage.setItem(ACCOUNT_SNAPSHOTS_KEY, JSON.stringify(envelope));
    const old = await readAccountSnapshot('reader@example.com');
    expect(old.status).toBe('valid');
    if (old.status === 'valid') {
      expect(old.snapshot.settings.keepScreenAwake).toBe(false);
    }
  }
});
