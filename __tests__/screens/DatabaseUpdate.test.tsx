import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { DatabaseUpdateText } from '../../constants';
import { DatabaseUpdate } from '../../screens/DatabaseUpdate';

const mockCheckForDatabaseUpdate = jest.fn();
const mockRunDatabaseUpdate = jest.fn();
const mockIsBlockedByStorage = jest.fn(() => Promise.resolve(false));
let mockStoreState = {
  db: { status: 'failed', progress: 0 },
  network: { isOnline: true },
};

jest.mock('../../db', () => ({
  checkForDatabaseUpdate: (...args: unknown[]) => mockCheckForDatabaseUpdate(...args),
  runDatabaseUpdate: (...args: unknown[]) => mockRunDatabaseUpdate(...args),
  // Read on mount so a previous out-of-space attempt is visible before the user
  // starts another 181 MB download. Local lookup, not a network call.
  isDatabaseDownloadBlockedByStorage: (...args: unknown[]) =>
    mockIsBlockedByStorage(...(args as [])),
}));

jest.mock('../../store/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) => selector(mockStoreState),
}));

jest.mock('../../hooks', () => ({ useScreenAnalytics: jest.fn() }));
jest.mock('../../utils', () => ({ recordError: jest.fn(), trackEvent: jest.fn() }));
jest.mock('../../components', () => ({ NavContent: () => null }));
jest.mock('../../icons', () => ({ LeftArrowIcon: () => null }));

const textContent = (renderer: ReactTestRenderer.ReactTestRenderer): string[] =>
  renderer.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .flat(Infinity)
    .filter((value): value is string => typeof value === 'string');

describe('DatabaseUpdate storage handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreState = {
      db: { status: 'failed', progress: 0 },
      network: { isOnline: true },
    };
    mockCheckForDatabaseUpdate.mockResolvedValue({ status: 'update-available' });
    mockRunDatabaseUpdate.mockResolvedValue({ status: 'insufficient-storage' });
  });

  it('shows insufficient storage inside the status card and offers an explicit retry', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DatabaseUpdate
          navigation={{ goBack: jest.fn() } as never}
          route={{ key: 'DatabaseUpdate-test', name: 'DatabaseUpdate' } as never}
        />
      );
    });

    // The screen now opens idle — it must not spend a network round trip on a
    // question the user did not ask. The check is an explicit action.
    const checkButton = renderer.root
      .findAllByType(TouchableOpacity)
      .find((node) => node.props.accessibilityLabel === DatabaseUpdateText.CHECK_UPDATE_A11Y);
    expect(checkButton).toBeDefined();
    await act(async () => {
      await checkButton?.props.onPress();
    });

    const updateButton = renderer.root
      .findAllByType(TouchableOpacity)
      .find((node) => node.props.accessibilityLabel === DatabaseUpdateText.UPDATE_NOW);
    expect(updateButton).toBeDefined();

    await act(async () => {
      await updateButton?.props.onPress();
    });

    expect(textContent(renderer)).toEqual(
      expect.arrayContaining([
        DatabaseUpdateText.INSUFFICIENT_STORAGE_TITLE,
        DatabaseUpdateText.INSUFFICIENT_STORAGE_MESSAGE,
        DatabaseUpdateText.TRY_AGAIN,
      ])
    );
    expect(
      renderer.root
        .findAllByType(TouchableOpacity)
        .some((node) => node.props.accessibilityLabel === DatabaseUpdateText.TRY_AGAIN_STORAGE_A11Y)
    ).toBe(true);
  });

  it('shows an automatic-resume message and no download action while offline', async () => {
    mockStoreState = {
      db: { status: 'downloading', progress: 42 },
      network: { isOnline: false },
    };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DatabaseUpdate
          navigation={{ goBack: jest.fn() } as never}
          route={{ key: 'DatabaseUpdate-test', name: 'DatabaseUpdate' } as never}
        />
      );
    });

    expect(textContent(renderer)).toEqual(
      expect.arrayContaining([DatabaseUpdateText.OFFLINE_TITLE, DatabaseUpdateText.OFFLINE_MESSAGE])
    );
    expect(mockCheckForDatabaseUpdate).not.toHaveBeenCalled();
    expect(
      renderer.root
        .findAllByType(TouchableOpacity)
        .some((node) =>
          [
            DatabaseUpdateText.UPDATE_NOW,
            DatabaseUpdateText.TRY_AGAIN_STORAGE_A11Y,
            DatabaseUpdateText.CHECK_UPDATE_A11Y,
          ].includes(node.props.accessibilityLabel)
        )
    ).toBe(false);
  });
});
