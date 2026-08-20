import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Constants, ErrorConstants } from '@constants';
import { SyncPopup } from '../../components/SyncPopup';
import {
  discardLocalDataAndSync,
  runConfirmedAccountSync,
  switchAccountData,
} from '../../store/confirmedSync';
import { onForeground } from '../../store/syncLifecycle';
import { approveSync, declineSync } from '../../store/slices/syncSlice';

const mockDispatch = jest.fn();
const mockShowError = jest.fn();
const mockRecordError = jest.fn();
const mountedRenderers = new Set<ReactTestRenderer.ReactTestRenderer>();
const originalCreate = ReactTestRenderer.create.bind(ReactTestRenderer);
// Signed in, data not yet associated → the popup is visible.
const mockState: {
  auth: { status: string; email: string; firstname: string };
  paths: { paths: unknown[]; dates: unknown[] };
  sync: {
    syncPopupAnswered: boolean;
    account: string | null;
    lastSyncedAt: number;
    meta: Record<string, { onServer: boolean; deletedAt: number | null }>;
    recoveryNeeded: boolean;
    pathOps?: Record<string, unknown>;
    scrollDirty?: Record<string, unknown>;
    pendingSettingsUpdatedAt?: number | null;
  };
  network: { isOnline: boolean };
} = {
  auth: { status: 'signedIn', email: 'u@e.com', firstname: 'U' },
  paths: { paths: [], dates: [] },
  network: { isOnline: true },
  sync: {
    syncPopupAnswered: false,
    account: null,
    lastSyncedAt: 0,
    meta: {},
    recoveryNeeded: false,
  },
};

jest.mock('../../store/hooks', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (s: typeof mockState) => unknown) => selector(mockState),
}));
jest.mock('../../store/confirmedSync', () => ({
  runConfirmedAccountSync: jest.fn(),
  discardLocalDataAndSync: jest.fn(),
  switchAccountData: jest.fn(),
}));
jest.mock('../../store/syncLifecycle', () => ({ onForeground: jest.fn() }));
// `getState` is real work here, not ceremony: `associate` reads it to tell a
// genuinely failed restore from an attempt that was rejected because the account
// was already associated.
jest.mock('../../store', () => ({ store: { getState: () => mockState } }));
jest.mock('../../store/persistence', () => ({ hasQuarantinedRecords: () => false }));
jest.mock('@auth', () => ({ logout: jest.fn() }));
jest.mock('@utils', () => ({
  showErrorAlert: (...args: unknown[]) => mockShowError(...args),
  recordError: (...args: unknown[]) => mockRecordError(...args),
  trackEvent: jest.fn(),
}));
jest.mock('../../components/Dialog', () => {
  const ReactForMock = jest.requireActual<typeof React>('react');
  return {
    Dialog: (props: { children?: React.ReactNode }) =>
      ReactForMock.createElement('Dialog', props, props.children),
  };
});

const mockRun = runConfirmedAccountSync as jest.Mock;
const mockDiscard = discardLocalDataAndSync as jest.Mock;
const mockSwitchAccount = switchAccountData as jest.Mock;
const mockOnForeground = onForeground as jest.Mock;

const pressSyncNow = async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<SyncPopup />);
  });
  const button = renderer.root.findAll(
    (node) => node.props.accessibilityLabel === Constants.SYNC_LOCAL_ACTION
  )[0];
  await act(async () => {
    await button.props.onPress();
  });
};

beforeEach(() => {
  // SyncPopup schedules restore retries. Keeping timers fake for every test
  // prevents a retry from firing after this test has finished; the retry test
  // advances this clock explicitly.
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockDiscard.mockResolvedValue(true);
  mockSwitchAccount.mockResolvedValue(true);
  mockOnForeground.mockResolvedValue(undefined);
  mockState.auth.email = 'u@e.com';
  mockState.sync.account = null;
  mockState.sync.lastSyncedAt = 0;
  mockState.sync.meta = {};
  mockState.sync.syncPopupAnswered = false;
  mockState.sync.recoveryNeeded = false;
  mockState.sync.pathOps = {};
  mockState.sync.scrollDirty = {};
  mockState.sync.pendingSettingsUpdatedAt = null;
  mockState.network.isOnline = true;
  // Case 3 is "unowned progress exists". Without local data the device has
  // nothing to ask about and associates silently instead.
  mockState.paths.paths = [{ pathId: 1 }];
  mockState.paths.dates = [];
});

beforeAll(() => {
  jest.spyOn(ReactTestRenderer, 'create').mockImplementation((element, options) => {
    const renderer = originalCreate(element, options);
    mountedRenderers.add(renderer);
    return renderer;
  });
});

afterEach(() => {
  act(() => {
    mountedRenderers.forEach((renderer) => renderer.unmount());
  });
  mountedRenderers.clear();
  jest.clearAllTimers();
  jest.useRealTimers();
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe('SyncPopup — Sync now', () => {
  it('closes the popup only after a successful sync', async () => {
    mockRun.mockResolvedValue(true);

    await pressSyncNow();

    expect(mockRun).toHaveBeenCalledWith(expect.anything(), 'u@e.com');
    expect(mockDispatch).toHaveBeenCalledWith(approveSync('u@e.com')); // marks answered → closes
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('keeps the popup open and alerts when the sync fails (so the user can retry)', async () => {
    mockRun.mockResolvedValue(false);

    await pressSyncNow();

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(mockShowError).toHaveBeenCalledWith(ErrorConstants.FAILED_TO_SYNC);
    // approveSync must NOT run — the popup stays visible for a retry.
    expect(mockDispatch).not.toHaveBeenCalledWith(approveSync('u@e.com'));
  });
});

describe('SyncPopup — unowned progress', () => {
  const renderUnowned = async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup />);
    });
    return renderer;
  };

  /** Unique action labels — `findAll` also matches nested host nodes. */
  const labels = (renderer: ReactTestRenderer.ReactTestRenderer) => [
    ...new Set(
      renderer.root
        .findAll((node) => typeof node.props.accessibilityLabel === 'string')
        .map((node) => node.props.accessibilityLabel as string)
    ),
  ];

  it('offers exactly two actions and no logout', async () => {
    const renderer = await renderUnowned();

    // The progress either joins the account or it does not; there is no third
    // answer. "Not now" used to sit here but only declined the prompt — it
    // associated nothing and pulled nothing, so the user stayed signed in with
    // the account's own progress invisible, and was never asked again.
    expect(labels(renderer)).toEqual([Constants.SYNC_LOCAL_ACTION, Constants.DISCARD_LOCAL_LINK]);
    expect(labels(renderer)).not.toContain(Constants.NOT_NOW);
    // Signing out resolves nothing for progress that belongs to nobody yet.
    expect(labels(renderer)).not.toContain(Constants.LOGOUT);
  });

  it('lets a user continue reading offline and asks again after reconnecting', async () => {
    mockState.network.isOnline = false;
    const renderer = await renderUnowned();

    expect(labels(renderer)).toEqual([Constants.CONTINUE_OFFLINE]);
    expect(mockRun).not.toHaveBeenCalled();

    await act(async () => {
      renderer.root
        .find((node) => node.props.accessibilityLabel === Constants.CONTINUE_OFFLINE)
        .props.onPress();
    });
    expect(renderer.root.find((node) => node.type === ('Dialog' as never)).props.visible).toBe(
      false
    );

    mockState.network.isOnline = true;
    await act(async () => {
      renderer.update(<SyncPopup mode="unowned" />);
    });
    expect(labels(renderer)).toContain(Constants.SYNC_LOCAL_ACTION);
  });

  it('associates silently when the device has nothing to ask about', async () => {
    mockState.paths.paths = [];
    mockState.paths.dates = [];
    mockRun.mockResolvedValue(true);

    const renderer = await renderUnowned();

    // No prompt, but the account IS associated — otherwise the outbox stays
    // disabled and nothing created afterwards would ever sync.
    expect(renderer.root.find((node) => node.type === ('Dialog' as never)).props.visible).toBe(
      false
    );
    expect(mockRun).toHaveBeenCalledWith(expect.anything(), 'u@e.com');
  });

  it('does not ask about local progress while the account is still connecting', async () => {
    // Device report: signed in with a new account and no reading, created a
    // path, and was asked what to do with "local progress" — on an account that
    // was in the middle of connecting silently.
    mockState.paths.paths = [];
    mockState.paths.dates = [];
    let finish: (value: boolean) => void = () => undefined;
    mockRun.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup />);
    });

    // The user creates a path while the silent association is still running.
    mockState.paths.paths = [{ pathId: 1 }];
    await act(async () => {
      renderer.update(<SyncPopup />);
    });

    // The point is that it does not ASK. It used to assert "no dialog at all",
    // which was the same thing back when a silent restore rendered nothing; the
    // restore now shows its own loading state, so the assertion has to name the
    // prompt it must not be.
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === Constants.SYNC_LOCAL_ACTION)
    ).toHaveLength(0);
    expect(
      renderer.root.findAll(
        (node) => node.props.accessibilityLabel === Constants.DISCARD_LOCAL_LINK
      )
    ).toHaveLength(0);
    await act(async () => {
      finish(true);
    });
  });

  it('retries a failed silent association when the network returns', async () => {
    // The attempt used to be keyed by email alone and marked before the request,
    // so one failure meant the device was never connected again that session.
    mockState.paths.paths = [];
    mockState.paths.dates = [];
    mockState.network.isOnline = false;
    mockRun.mockResolvedValue(false);

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup />);
    });
    const attemptsWhileOffline = mockRun.mock.calls.length;

    mockState.network.isOnline = true;
    mockRun.mockResolvedValue(true);
    // A differing prop object so `React.memo` re-renders the SAME instance —
    // the retry latch lives in a ref, so remounting would not test it.
    await act(async () => {
      renderer.update(<SyncPopup mode="unowned" />);
    });

    expect(mockRun.mock.calls.length).toBeGreaterThan(attemptsWhileOffline);
  });

  it("refreshes after connecting, so another phone's reading appears at once", async () => {
    // Home's focus effect does not re-fire when the user was already on Home as
    // they signed in, so without this the list sits stale until the screen
    // happens to be re-focused.
    mockState.paths.paths = [];
    mockState.paths.dates = [];
    mockRun.mockResolvedValue(true);

    await act(async () => {
      ReactTestRenderer.create(<SyncPopup />);
    });

    expect(mockOnForeground).toHaveBeenCalled();
  });

  it('still prompts when only an orphan date record remains', async () => {
    // `paths.dates` is a separate collection, so this device is not empty.
    mockState.paths.paths = [];
    mockState.paths.dates = [{ pathid: 1 }];

    const renderer = await renderUnowned();

    expect(renderer.root.find((node) => node.type === ('Dialog' as never)).props.visible).toBe(
      true
    );
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('puts Discard behind its own confirmation and never deletes on the first tap', async () => {
    const renderer = await renderUnowned();
    const discard = renderer.root.find(
      (node) => node.props.accessibilityLabel === Constants.DISCARD_LOCAL_LINK
    );

    await act(async () => {
      await discard.props.onPress();
    });

    expect(mockDiscard).not.toHaveBeenCalled(); // nothing removed yet
    // The confirmation replaces the choice entirely: Discard / Cancel only.
    expect(labels(renderer)).toEqual([Constants.CANCEL, Constants.DISCARD_CONFIRM_ACTION]);
    const confirm = renderer.root.find(
      (node) => node.props.accessibilityLabel === Constants.DISCARD_CONFIRM_ACTION
    );

    await act(async () => {
      await confirm.props.onPress();
    });
    expect(mockDiscard).toHaveBeenCalledWith(expect.anything(), 'u@e.com');
  });

  it('locks Cancel and the back gesture while the discard is running', async () => {
    // Deleting this device's progress is irreversible, so nothing may leave the
    // dialog mid-wipe — not the button, and not the Android back gesture, which
    // reaches `onRequestClose` directly rather than through the button.
    let finishDiscard!: (ok: boolean) => void;
    mockDiscard.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finishDiscard = resolve;
      })
    );

    const renderer = await renderUnowned();
    await act(async () => {
      await renderer.root
        .find((node) => node.props.accessibilityLabel === Constants.DISCARD_LOCAL_LINK)
        .props.onPress();
    });

    const dialog = renderer.root.find((node) => typeof node.props.onRequestClose === 'function');
    await act(async () => {
      renderer.root
        .find((node) => node.props.accessibilityLabel === Constants.DISCARD_CONFIRM_ACTION)
        .props.onPress();
    });

    expect(
      renderer.root.find((node) => node.props.accessibilityLabel === Constants.CANCEL).props
        .disabled
    ).toBe(true);

    // The back gesture must not dismiss it either.
    await act(async () => {
      dialog.props.onRequestClose();
    });
    expect(
      renderer.root.find(
        (node) => node.props.accessibilityLabel === Constants.DISCARD_CONFIRM_ACTION
      )
    ).toBeTruthy();

    await act(async () => {
      finishDiscard(true);
    });
  });

  it('cancelling the discard confirmation changes nothing', async () => {
    const renderer = await renderUnowned();
    await act(async () => {
      await renderer.root
        .find((node) => node.props.accessibilityLabel === Constants.DISCARD_LOCAL_LINK)
        .props.onPress();
    });

    await act(async () => {
      await renderer.root
        .find((node) => node.props.accessibilityLabel === Constants.CANCEL)
        .props.onPress();
    });

    expect(mockDiscard).not.toHaveBeenCalled();
    // Back to the three-action dialog.
    expect(labels(renderer)).toContain(Constants.SYNC_LOCAL_ACTION);
  });
});

describe('SyncPopup — account switch guard', () => {
  it('cannot be dismissed with Not now when B is viewing A data', async () => {
    mockState.auth.email = 'b@e.com';
    mockState.sync.account = 'a@e.com';
    mockState.sync.syncPopupAnswered = true; // a prior session answer cannot bypass the guard

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup mode="accountSwitch" />);
    });

    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === Constants.NOT_NOW)
    ).toHaveLength(0);
    const dialog = renderer.root.find((node) => node.type === ('Dialog' as never));
    await act(async () => {
      dialog.props.onRequestClose();
    });
    expect(mockDispatch).not.toHaveBeenCalledWith(declineSync());
  });

  it('offers to add A progress to B or keep it safely for A', async () => {
    mockState.auth.email = 'b@e.com';
    mockState.sync.account = 'a@e.com';
    mockState.sync.pathOps = { 1: { kind: 'update' } };
    const onAccountSwitched = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <SyncPopup mode="accountSwitch" onAccountSwitched={onAccountSwitched} />
      );
    });

    const add = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'Add a copy to b@e.com'
    );
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === 'Keep it safe for a@e.com')
    ).not.toHaveLength(0);

    await act(async () => {
      await add.props.onPress();
    });
    expect(mockSwitchAccount).toHaveBeenCalledWith(expect.anything(), 'b@e.com', true);
    expect(mockDispatch).toHaveBeenCalledWith(approveSync('b@e.com'));
    expect(onAccountSwitched).toHaveBeenCalledTimes(1);
  });

  it('lets an account switch continue offline and asks again after reconnecting', async () => {
    mockState.auth.email = 'b@e.com';
    mockState.sync.account = 'a@e.com';
    mockState.sync.pathOps = { 1: { kind: 'update' } };
    mockState.network.isOnline = false;
    const firstCallback = jest.fn();

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <SyncPopup mode="accountSwitch" onAccountSwitched={firstCallback} />
      );
    });

    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === Constants.CONTINUE_OFFLINE)
    ).not.toHaveLength(0);
    expect(mockSwitchAccount).not.toHaveBeenCalled();

    await act(async () => {
      renderer.root
        .find((node) => node.props.accessibilityLabel === Constants.CONTINUE_OFFLINE)
        .props.onPress();
    });
    expect(renderer.root.find((node) => node.type === ('Dialog' as never)).props.visible).toBe(
      false
    );

    mockState.network.isOnline = true;
    await act(async () => {
      renderer.update(<SyncPopup mode="accountSwitch" onAccountSwitched={jest.fn()} />);
    });
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === 'Keep it safe for a@e.com')
    ).not.toHaveLength(0);
  });

  it('shows a loading dialog while B’s saved progress is being refreshed', async () => {
    mockState.auth.email = 'b@e.com';
    mockState.sync.account = 'a@e.com';
    mockState.sync.pathOps = { 1: { kind: 'update' } };
    let finishRefresh: () => void = () => undefined;
    mockOnForeground.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishRefresh = resolve;
        })
    );

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup mode="accountSwitch" />);
    });
    const keep = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'Keep it safe for a@e.com'
    );

    act(() => {
      keep.props.onPress();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === Constants.LOADING_PROGRESS)
    ).not.toHaveLength(0);

    await act(async () => {
      finishRefresh();
    });
  });

  it('switches automatically when A is already fully backed up without a pull cursor', async () => {
    mockState.auth.email = 'b@e.com';
    mockState.sync.account = 'a@e.com';
    // `lastSyncedAt` is a pull cursor, not proof of a successful backup.
    // This is the legacy-account case that previously showed "Keep it safe".
    mockState.sync.lastSyncedAt = 0;
    // "Fully backed up" means every path is provably on the server, not just
    // that a sync happened once.
    mockState.sync.meta = { 1: { onServer: true, deletedAt: null } };

    await act(async () => {
      ReactTestRenderer.create(<SyncPopup mode="accountSwitch" />);
    });

    expect(mockSwitchAccount).toHaveBeenCalledWith(expect.anything(), 'b@e.com', false);
    expect(mockDispatch).toHaveBeenCalledWith(approveSync('b@e.com'));
  });

  it('asks before switching when only orphaned local history remains and A never synced', async () => {
    // `paths.every(...)` is vacuously true for an empty list, but this orphaned
    // date record is still real device data and must never be overwritten by B.
    mockState.auth.email = 'b@e.com';
    mockState.sync.account = 'a@e.com';
    mockState.sync.lastSyncedAt = 0;
    mockState.paths.paths = [];
    mockState.paths.dates = [{ pathid: 999 }];

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup mode="accountSwitch" />);
    });

    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === 'Keep it safe for a@e.com')
    ).not.toHaveLength(0);
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === 'Add a copy to b@e.com')
    ).not.toHaveLength(0);
    expect(mockSwitchAccount).not.toHaveBeenCalled();
  });

  it('does not claim unsynced progress when there is none', async () => {
    // Device bug: a fresh account with no local progress showed
    // "Unsynced progress found" while it was only switching silently.
    mockState.auth.email = 'b@e.com';
    mockState.sync.account = 'a@e.com';
    mockState.paths.paths = [];
    mockState.paths.dates = [];
    mockState.sync.lastSyncedAt = 10;

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup mode="accountSwitch" />);
    });

    const titles = renderer.root
      .findAll((node) => typeof node.props.children === 'string')
      .map((node) => node.props.children as string);
    // Nothing was unsynced, so it must never say so. Once the silent switch
    // finishes it explains where A's reading went instead.
    expect(titles).not.toContain(Constants.ACCOUNT_SWITCH_TITLE);
    expect(titles).toContain(Constants.SWITCHED_ACCOUNT_TITLE);
  });

  it('shows no decision dialog when the previous account is fully backed up', async () => {
    // Device report: a fully-synced account still produced a dialog, then a
    // loading screen, then the confirmation — three screens for a switch that
    // asks nothing. The first two are both "please wait".
    mockState.auth.email = 'b@e.com';
    mockState.sync.account = 'a@e.com';
    mockState.sync.lastSyncedAt = 10;
    mockState.sync.meta = { 1: { onServer: true, deletedAt: null } };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup mode="accountSwitch" />);
    });

    const titles = renderer.root
      .findAll((node) => typeof node.props.children === 'string')
      .map((node) => node.props.children as string);
    // Never the "please wait" dialog that duplicates the loading state.
    expect(titles).not.toContain(Constants.SWITCHING_ACCOUNT_TITLE);
    // A choice is never offered either — there is nothing to decide.
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === `Keep it safe for a@e.com`)
    ).toHaveLength(0);
  });

  it('keeps the switched-account explanation until it is dismissed', async () => {
    // Device report: the switch message went by too fast to read. A restored
    // local snapshot needs no network, so the switch can finish in well under a
    // second and the explanation flashed past.
    mockState.auth.email = 'b@e.com';
    mockState.sync.account = 'a@e.com';
    mockState.sync.lastSyncedAt = 10;
    mockState.sync.meta = { 1: { onServer: true, deletedAt: null } };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup mode="accountSwitch" />);
    });

    // Still on screen after the switch completed, naming the account put away.
    const dialog = renderer.root.find((node) => node.type === ('Dialog' as never));
    expect(dialog.props.visible).toBe(true);
    const texts = renderer.root
      .findAll((node) => typeof node.props.children === 'string')
      .map((node) => node.props.children as string);
    expect(texts).toContain('a@e.com');

    // The real switch sets the account to B; the mocked store cannot, so mirror
    // it here before dismissing, or the switch guard still thinks it is running.
    mockState.sync.account = 'b@e.com';

    // And it closes on the user's terms, not a timer.
    await act(async () => {
      renderer.root.find((node) => node.props.accessibilityLabel === Constants.OK).props.onPress();
    });
    expect(
      renderer.root
        .findAll((node) => node.type === ('Dialog' as never))
        .every((d) => d.props.visible === false)
    ).toBe(true);
  });

  it('disappears once the user signs out', async () => {
    // Device bug: `auth.email` clears before `sync.account`, so the switch
    // condition stayed true and pinned the dialog open — Logout looked broken.
    mockState.auth.email = 'b@e.com';
    mockState.sync.account = 'a@e.com';
    mockState.sync.pathOps = { 1: { kind: 'update' } };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup mode="accountSwitch" />);
    });
    expect(renderer.root.findAll((node) => node.type === ('Dialog' as never))).not.toHaveLength(0);

    // Logout signs out locally: status flips and the email clears first.
    mockState.auth.status = 'signedOut';
    mockState.auth.email = '';
    // A fresh render, not `update`: the component is memoized and the mocked
    // selector does not subscribe, so re-rendering the same props is a no-op.
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup mode="accountSwitch" />);
    });

    const dialogs = renderer.root.findAll((node) => node.type === ('Dialog' as never));
    expect(dialogs.every((dialog) => dialog.props.visible === false)).toBe(true);
    mockState.auth.status = 'signedIn';
  });

  it('shows progress only on the button that was pressed', async () => {
    mockState.auth.email = 'b@e.com';
    mockState.sync.account = 'a@e.com';
    mockState.sync.pathOps = { 1: { kind: 'update' } };
    let resolveSwitch: (value: boolean) => void = () => undefined;
    mockSwitchAccount.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSwitch = resolve;
        })
    );

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup mode="accountSwitch" />);
    });
    const add = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'Add a copy to b@e.com'
    );

    act(() => {
      add.props.onPress();
    });

    const texts = renderer.root
      .findAll((node) => typeof node.props.children === 'string')
      .map((node) => node.props.children as string);
    // "Add a copy" is running, so "Keep it safe" must keep its own label.
    expect(texts).toContain(Constants.SYNCING);
    expect(texts).toContain(Constants.KEEP_FOR_PREVIOUS);
    expect(texts).not.toContain(Constants.ADD_COPY_TO_ACCOUNT);

    await act(async () => {
      resolveSwitch(true);
    });
  });

  it('keeps logout usable while a switch is running', async () => {
    mockState.auth.email = 'b@e.com';
    mockState.sync.account = 'a@e.com';
    mockState.sync.pathOps = { 1: { kind: 'update' } };
    mockSwitchAccount.mockImplementationOnce(() => new Promise(() => undefined)); // hangs

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup mode="accountSwitch" />);
    });
    act(() => {
      renderer.root
        .find((node) => node.props.accessibilityLabel === 'Keep it safe for a@e.com')
        .props.onPress();
    });

    // The dialog cannot be dismissed any other way, so a hung switch must not
    // trap the user by disabling their only exit.
    const logoutButton = renderer.root.find(
      (node) => node.props.accessibilityLabel === Constants.LOGOUT
    );
    expect(logoutButton.props.disabled).toBeFalsy();
  });

  it('blocks the switch when the previous account backup status is unknown', async () => {
    mockState.auth.email = 'b@e.com';
    mockState.sync.account = 'a@e.com';
    mockState.sync.recoveryNeeded = true;

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup mode="accountSwitch" />);
    });

    const dialog = renderer.root.find((node) => node.type === ('Dialog' as never));
    expect(dialog.props.visible).toBe(true);
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === Constants.SYNC_NOW)
    ).toHaveLength(0);
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === Constants.NOT_NOW)
    ).toHaveLength(0);
  });
});

describe('SyncPopup — a restore that could not reach the account', () => {
  /**
   * The device a clean logout leaves behind: no paths, no owner. The account's
   * copy is the only one, so the silent restore on sign-in is the whole story.
   */
  // Renderers are unmounted by the shared cleanup above, which also cancels
  // their restore-retry timeouts.
  let mounted: ReactTestRenderer.ReactTestRenderer | null = null;
  afterEach(() => {
    const renderer = mounted;
    mounted = null;
    // Inside `act`: unmounting runs cleanup, which is a React update like any
    // other. Without it React logs "an update was not wrapped in act(...)".
    if (renderer) {
      act(() => {
        renderer.unmount();
      });
    }
  });

  const renderClearedDevice = async () => {
    mockState.paths.paths = [];
    mockState.paths.dates = [];
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(<SyncPopup />);
    });
    mounted = renderer;
    return renderer;
  };

  const textsOf = (renderer: ReactTestRenderer.ReactTestRenderer) =>
    renderer.root
      .findAll((node) => typeof node.props.children === 'string')
      .map((node) => node.props.children as string);

  it('says so instead of leaving the user on a blank screen', async () => {
    // Before this, a failed silent restore showed nothing at all: the user saw
    // an empty app with no explanation, which reads as "my reading is gone".
    mockRun.mockResolvedValue(false);

    const renderer = await renderClearedDevice();

    expect(mockRun).toHaveBeenCalledTimes(1);
    expect(textsOf(renderer)).toContain(Constants.RESTORE_FAILED_TITLE);
    expect(textsOf(renderer)).toContain(Constants.RETRY);
    // Silent means no alert — the dialog carries the message instead.
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('retries when asked, which one failed attempt used to make impossible', async () => {
    // `silentAssociationTarget` is set to `attemptKey` BEFORE the attempt, and
    // that key only changes when connectivity flips — so on a slow-but-connected
    // network the session got exactly one try. Retry clears the target.
    mockRun.mockResolvedValue(false);
    const renderer = await renderClearedDevice();
    expect(mockRun).toHaveBeenCalledTimes(1);

    mockRun.mockResolvedValue(true);
    const retry = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === Constants.RETRY
    )[0];
    await act(async () => {
      retry.props.onPress();
    });

    expect(mockRun).toHaveBeenCalledTimes(2);
    expect(mockDispatch).toHaveBeenCalledWith(approveSync('u@e.com'));
  });

  it('lets the user leave and keep reading offline', async () => {
    // The downloaded database still works with no connection, so this must never
    // be a dead end.
    mockRun.mockResolvedValue(false);
    const renderer = await renderClearedDevice();

    const leave = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === Constants.CONTINUE_OFFLINE
    )[0];
    await act(async () => {
      leave.props.onPress();
    });

    expect(textsOf(renderer)).not.toContain(Constants.RESTORE_FAILED_TITLE);
  });

  it('gives up retrying on its own, leaving Retry as the explicit way back', async () => {
    // Unbounded automatic retries turn a server outage into unlimited requests
    // and duplicate Crashlytics reports, from every affected device, for as long
    // as the screen stays open.
    mockRun.mockResolvedValue(false);
    const renderer = await renderClearedDevice();
    expect(mockRun).toHaveBeenCalledTimes(1);

    // Far past the 15s + 30s + 60s the backoff can ever schedule.
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(60_000);
      });
    }

    // One initial attempt plus a fixed budget of automatic ones — never more.
    expect(mockRun).toHaveBeenCalledTimes(4);
    // The dialog stays, so the user still has a way to try again themselves.
    expect(textsOf(renderer)).toContain(Constants.RETRY);
  });

  it('stays quiet when the restore succeeds', async () => {
    mockRun.mockResolvedValue(true);

    const renderer = await renderClearedDevice();

    expect(textsOf(renderer)).not.toContain(Constants.RESTORE_FAILED_TITLE);
    expect(mockDispatch).toHaveBeenCalledWith(approveSync('u@e.com'));
  });
});
