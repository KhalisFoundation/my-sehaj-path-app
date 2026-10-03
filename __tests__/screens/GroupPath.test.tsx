import React from 'react';
import { Provider } from 'react-redux';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { GroupPath } from '../../screens/GroupPath';
import { store } from '../../store';
import { Routes } from '@constants';
import { listMembers, currentSession, startReading } from '../../store/groupApi';
import { connectLive } from '../../store/liveSession';

jest.mock('../../store/groupApi', () => ({
  listMembers: jest.fn(),
  currentSession: jest.fn(),
  startReading: jest.fn(),
}));
jest.mock('../../store/liveSession', () => ({ connectLive: jest.fn() }));
jest.mock('../../components/MemberAvatars', () => ({ MemberAvatars: () => null }));

const listMembersMock = listMembers as jest.MockedFunction<typeof listMembers>;
const currentSessionMock = currentSession as jest.MockedFunction<typeof currentSession>;
const startReadingMock = startReading as jest.MockedFunction<typeof startReading>;
const connectLiveMock = connectLive as jest.MockedFunction<typeof connectLive>;

const navigate = jest.fn();
const navigation = { navigate } as never;
const route = {
  key: 'GroupPath',
  name: 'GroupPath',
  params: { sehajPathId: 'p1', pathId: 7, pathName: 'Family path' },
} as never;

const renderScreen = () =>
  render(
    <Provider store={store}>
      <GroupPath navigation={navigation} route={route} />
    </Provider>
  );

/** Captures the callbacks the screen passes in, so a test can drive the socket. */
let handle: { close: jest.Mock; sendPosition: jest.Mock };
let listeners: Parameters<typeof connectLive>[0];

const members = (...rows: { displayLabel: string; role?: string; status?: string }[]) =>
  listMembersMock.mockResolvedValue({
    ok: true,
    data: rows.map((row, index) => ({
      id: `m${index}`,
      displayLabel: row.displayLabel,
      role: row.role ?? 'MEMBER',
      status: row.status ?? 'ACTIVE',
    })),
  } as never);

const noSession = () => currentSessionMock.mockResolvedValue({ ok: true, data: null } as never);

const liveSession = (overrides: Record<string, unknown> = {}) =>
  currentSessionMock.mockResolvedValue({
    ok: true,
    data: {
      id: 's1',
      status: 'LIVE',
      readerLabel: 'Harpreet',
      currentAng: 42,
      ...overrides,
    },
  } as never);

beforeEach(() => {
  jest.clearAllMocks();
  members({ displayLabel: 'You', role: 'ADMIN' });
  noSession();
  handle = { close: jest.fn(), sendPosition: jest.fn() };
  connectLiveMock.mockImplementation((options) => {
    listeners = options;
    return Promise.resolve(handle as never);
  });
});

describe('the GroupPath screen', () => {
  it('opens a live connection even when nobody is reading', async () => {
    const { findByText } = renderScreen();
    await findByText('Start reading');

    // The point is to learn the moment somebody starts — which is exactly when
    // there is no session to poll for.
    expect(connectLiveMock).toHaveBeenCalledWith(expect.objectContaining({ sehajPathId: 'p1' }));
  });

  it('closes the socket when the screen goes away', async () => {
    const { findByText, unmount } = renderScreen();
    await findByText('Start reading');
    unmount();

    await waitFor(() => expect(handle.close).toHaveBeenCalled());
  });

  it('shows who is reading and offers to follow, rather than to start', async () => {
    liveSession();
    const { findByText, queryByText } = renderScreen();

    expect(await findByText('Harpreet')).toBeTruthy();
    expect(await findByText('Follow along')).toBeTruthy();
    // Only one session per path may be live; offering "Start" would be a
    // button whose only outcome is a 409.
    expect(queryByText('Start reading')).toBeNull();
  });

  it('follows the reader as positions arrive, without a reload', async () => {
    liveSession();
    const { findByText } = renderScreen();
    await findByText('Ang 42');

    listeners.onPosition({
      currentAng: 55,
      currentVerseId: 550,
      scrollPosition: 0,
      sequence: 2,
    });

    expect(await findByText('Ang 55')).toBeTruthy();
  });

  it('starts a follower where the reader already is', async () => {
    liveSession();
    const { findByText } = renderScreen();
    await findByText('Harpreet');

    listeners.onJoined({
      sessionId: 's1',
      readerLabel: 'ਸਿਮਰਨ',
      currentAng: 90,
      currentVerseId: 900,
      scrollPosition: 0,
      sequence: 5,
    });

    expect(await findByText('Ang 90')).toBeTruthy();
    expect(await findByText('ਸਿਮਰਨ')).toBeTruthy();
  });

  it('takes the turn and opens the reading screen', async () => {
    startReadingMock.mockResolvedValue({
      ok: true,
      data: { id: 's9', status: 'LIVE', currentAng: 1 },
    } as never);

    const { findByText } = renderScreen();
    fireEvent.press(await findByText('Start reading'));

    await waitFor(() => expect(startReadingMock).toHaveBeenCalledWith('p1'));
    // The role travels with the navigation: this screen is the only place that
    // knows whether this device holds the turn, and the reading screen must not
    // have to guess.
    expect(navigate).toHaveBeenCalledWith(Routes.Path, {
      pathId: 7,
      live: {
        sehajPathId: 'p1',
        driving: true,
        sessionId: 's9',
        startAng: undefined,
        startedAt: undefined,
        slotEndsAt: undefined,
      },
    });
  });

  it('opens the reading screen as a follower, never as a driver', async () => {
    liveSession();
    const { findByText } = renderScreen();
    fireEvent.press(await findByText('Follow along'));

    // Exactly one device drives. A follower arriving with driving:true would
    // report a position and move the whole group.
    expect(navigate).toHaveBeenCalledWith(Routes.Path, {
      pathId: 7,
      live: { sehajPathId: 'p1', driving: false },
    });
  });

  it('refreshes rather than failing when somebody else took the turn first', async () => {
    startReadingMock.mockResolvedValue({
      ok: false,
      kind: 'refused',
      status: 409,
      message: 'Someone else is reading.',
    } as never);

    const { findByText } = renderScreen();
    fireEvent.press(await findByText('Start reading'));

    expect(await findByText('Someone else is reading.')).toBeTruthy();
    // Reloaded so the screen can offer to follow instead.
    await waitFor(() => expect(currentSessionMock).toHaveBeenCalledTimes(2));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not start twice when the button is tapped twice', async () => {
    let release: (value: unknown) => void = () => {};
    startReadingMock.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      }) as never
    );

    const { findByText, getByText } = renderScreen();
    fireEvent.press(await findByText('Start reading'));
    fireEvent.press(getByText('Starting…'));

    expect(startReadingMock).toHaveBeenCalledTimes(1);
    release({ ok: false, kind: 'unreachable', message: 'No connection.' });
    await waitFor(() => expect(getByText('No connection.')).toBeTruthy());
  });

  it('says the reader may be stale when the connection drops', async () => {
    liveSession();
    const { findByText } = renderScreen();
    await findByText('Harpreet');

    listeners.onEnded('dropped');
    // A drop does not eject anybody — it means what is on screen may be behind.
    expect(await findByText(/Reconnecting/)).toBeTruthy();
  });

  it('says plainly when the live connection was refused', async () => {
    const { findByText } = renderScreen();
    await findByText('Start reading');

    listeners.onEnded('refused');
    expect(await findByText(/not connected to this path’s live reading/)).toBeTruthy();
  });

  it('stays quiet about a healthy connection', async () => {
    const { findByText, queryByText } = renderScreen();
    await findByText('Start reading');

    listeners.onJoined(null);
    await waitFor(() => expect(queryByText(/Reconnecting/)).toBeNull());
    expect(queryByText(/not connected/)).toBeNull();
  });

  it('leads to the invite sheet', async () => {
    const { findByLabelText } = renderScreen();
    fireEvent.press(await findByLabelText('Invite a member'));

    expect(navigate).toHaveBeenCalledWith(Routes.InviteMember, {
      sehajPathId: 'p1',
      pathName: 'Family path',
    });
  });

  it('leads to booking a slot', async () => {
    const { findByText } = renderScreen();
    fireEvent.press(await findByText('Book a slot'));

    expect(navigate).toHaveBeenCalledWith(Routes.ChooseSlot, {
      sehajPathId: 'p1',
      pathId: 7,
    });
  });

  it('counts only people actually reading together', async () => {
    members(
      { displayLabel: 'You', role: 'ADMIN' },
      { displayLabel: 'Harpreet' },
      { displayLabel: 'Manveer', status: 'REQUESTED' }
    );
    const { findByText } = renderScreen();
    expect(await findByText('2 reading together')).toBeTruthy();
  });
});
