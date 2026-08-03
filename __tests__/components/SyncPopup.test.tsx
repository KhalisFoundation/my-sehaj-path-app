import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Constants, ErrorConstants } from '@constants';
import { SyncPopup } from '../../components/SyncPopup';
import {
  discardLocalDataAndSync,
  runConfirmedAccountSync,
  switchAccountData,
} from '../../store/confirmedSync';
import { approveSync, declineSync } from '../../store/slices/syncSlice';

const mockDispatch = jest.fn();
const mockShowError = jest.fn();
// Signed in, data not yet associated → the popup is visible.
const mockState: {
  auth: { status: string; email: string; firstname: string };
  paths: { paths: unknown[] };
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
} = {
  auth: { status: 'signedIn', email: 'u@e.com', firstname: 'U' },
  paths: { paths: [] },
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
jest.mock('../../store', () => ({ store: {} }));
jest.mock('@auth', () => ({ logout: jest.fn() }));
jest.mock('@utils', () => ({ showErrorAlert: (...args: unknown[]) => mockShowError(...args) }));
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

const pressSyncNow = async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<SyncPopup />);
  });
  const button = renderer.root.findAll(
    (node) => node.props.accessibilityLabel === Constants.SYNC_NOW
  )[0];
  await act(async () => {
    await button.props.onPress();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDiscard.mockResolvedValue(true);
  mockSwitchAccount.mockResolvedValue(true);
  mockState.auth.email = 'u@e.com';
  mockState.sync.account = null;
  mockState.sync.lastSyncedAt = 0;
  mockState.sync.meta = {};
  mockState.sync.syncPopupAnswered = false;
  mockState.sync.recoveryNeeded = false;
  mockState.sync.pathOps = {};
  mockState.sync.scrollDirty = {};
  mockState.sync.pendingSettingsUpdatedAt = null;
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

    const add = renderer.root.find((node) => node.props.accessibilityLabel === 'Add to b@e.com');
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === 'Keep for a@e.com')
    ).not.toHaveLength(0);

    await act(async () => {
      await add.props.onPress();
    });
    expect(mockSwitchAccount).toHaveBeenCalledWith(expect.anything(), 'b@e.com', true);
    expect(mockDispatch).toHaveBeenCalledWith(approveSync('b@e.com'));
    expect(onAccountSwitched).toHaveBeenCalledTimes(1);
  });

  it('switches automatically when A is already fully backed up', async () => {
    mockState.auth.email = 'b@e.com';
    mockState.sync.account = 'a@e.com';
    mockState.sync.lastSyncedAt = 10;

    await act(async () => {
      ReactTestRenderer.create(<SyncPopup mode="accountSwitch" />);
    });

    expect(mockSwitchAccount).toHaveBeenCalledWith(expect.anything(), 'b@e.com', false);
    expect(mockDispatch).toHaveBeenCalledWith(approveSync('b@e.com'));
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
