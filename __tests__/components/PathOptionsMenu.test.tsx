import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, type ViewStyle } from 'react-native';
import { Constants } from '@constants';

jest.mock('@icons', () => {
  const ReactForMock = jest.requireActual<typeof React>('react');
  return { MoreOptionsIcon: () => ReactForMock.createElement('MoreOptionsIcon') };
});

const mockTrack = jest.fn();
jest.mock('@utils/analytics', () => ({ trackEvent: (...a: unknown[]) => mockTrack(...a) }));

const mockDelete = jest.fn();
jest.mock('../../store/commands', () => ({
  deletePathCommand: (...args: unknown[]) => mockDelete(...args),
}));
jest.mock('../../store/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { fontSize: { fontSize: 'Small (Default)', number: 24 } } }),
}));

import { PathOptionsMenu } from '../../components/PathOptionsMenu';

const onDeleted = jest.fn();
const onDeletingChange = jest.fn();

const render = async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(
      <PathOptionsMenu
        pathId={7}
        pathName="Path #7"
        onDeleted={onDeleted}
        onDeletingChange={onDeletingChange}
      />
    );
  });
  return renderer;
};

/** Presses the first element carrying this accessibility label. */
const press = async (renderer: ReactTestRenderer.ReactTestRenderer, label: string) => {
  const node = renderer.root.find(
    (n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function'
  );
  await act(async () => node.props.onPress());
};

/** Taps without waiting for the handler to settle, to model a tap mid-flight. */
const tap = async (renderer: ReactTestRenderer.ReactTestRenderer, label: string) => {
  const node = renderer.root.find(
    (n) => n.props?.accessibilityLabel === label && typeof n.props?.onPress === 'function'
  );
  await act(async () => {
    node.props.onPress();
  });
};

const labels = (renderer: ReactTestRenderer.ReactTestRenderer) =>
  renderer.root
    .findAll((n) => typeof n.props?.accessibilityLabel === 'string')
    .map((n) => n.props.accessibilityLabel as string);

beforeEach(() => {
  jest.clearAllMocks();
  mockDelete.mockResolvedValue(true);
});

describe('deleting a path from the three-dot menu', () => {
  it('does not offer the action until the menu is opened', async () => {
    const renderer = await render();
    expect(labels(renderer)).not.toContain(Constants.DELETE_PATH);
  });

  it('asks before deleting, rather than deleting on the menu tap', async () => {
    // The menu item is one tap away from destroying reading progress that may
    // represent months. It opens the confirmation and nothing else.
    const renderer = await render();
    await press(renderer, 'More options for Path #7');
    await press(renderer, Constants.DELETE_PATH);

    expect(labels(renderer)).toContain(Constants.DELETE);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('leaves the screen behind it untouched', async () => {
    // The menu is a light touch on a screen the user is still reading. Dimming
    // is reserved for the confirmation, which does want their full attention.
    const renderer = await render();
    await press(renderer, 'More options for Path #7');

    const backdrop = renderer.root.find((n) => n.props?.accessibilityLabel === 'Close menu');
    const painted = StyleSheet.flatten(backdrop.props.style) as ViewStyle;
    expect(painted.backgroundColor).toBeUndefined();
  });

  it('closes when the user taps anywhere outside it', async () => {
    const renderer = await render();
    await press(renderer, 'More options for Path #7');
    expect(labels(renderer)).toContain(Constants.DELETE_PATH);

    await press(renderer, 'Close menu');

    expect(labels(renderer)).not.toContain(Constants.DELETE_PATH);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('dims the screen for the confirmation, unlike the menu', async () => {
    const renderer = await render();
    await press(renderer, 'More options for Path #7');
    await press(renderer, Constants.DELETE_PATH);

    const dimmed = renderer.root.findAll(
      (n) => !!(StyleSheet.flatten(n.props?.style) as ViewStyle | undefined)?.backgroundColor
    );
    expect(dimmed.length).toBeGreaterThan(0);
  });

  it('reports opening the menu and pressing delete', async () => {
    // Two separate signals on purpose: paired with the command's `PathDeleted`
    // they show how far people get before backing out.
    const renderer = await render();
    await press(renderer, 'More options for Path #7');
    expect(mockTrack).toHaveBeenCalledWith('PathOptions', 'click', 'more options opened');

    await press(renderer, Constants.DELETE_PATH);
    expect(mockTrack).toHaveBeenCalledWith('PathOptions', 'click', 'delete pressed');
  });

  it('reports the press even if the user then cancels', async () => {
    const renderer = await render();
    await press(renderer, 'More options for Path #7');
    await press(renderer, Constants.DELETE_PATH);
    await press(renderer, Constants.CANCEL);

    expect(mockTrack).toHaveBeenCalledWith('PathOptions', 'click', 'delete pressed');
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('warns the host screen before the path disappears from under it', async () => {
    // The host renders this path. It vanishes partway through the command, and
    // without this the screen reported "Failed to load your path data" for a
    // deletion that had in fact succeeded.
    const renderer = await render();
    await press(renderer, 'More options for Path #7');
    await press(renderer, Constants.DELETE_PATH);
    await press(renderer, Constants.DELETE);

    expect(onDeletingChange).toHaveBeenCalledWith(true);
    // Ordered: the warning has to land before the command that removes it.
    expect(onDeletingChange.mock.invocationCallOrder[0]).toBeLessThan(
      mockDelete.mock.invocationCallOrder[0]
    );
  });

  it('tells the host the path is back when the delete failed', async () => {
    // Rolled back, so it is on screen again — and a later genuine load failure
    // must still be reported.
    mockDelete.mockResolvedValue(false);
    const renderer = await render();
    await press(renderer, 'More options for Path #7');
    await press(renderer, Constants.DELETE_PATH);
    await press(renderer, Constants.DELETE);

    expect(onDeletingChange).toHaveBeenLastCalledWith(false);
  });

  it('deletes and tells the screen to leave once confirmed', async () => {
    const renderer = await render();
    await press(renderer, 'More options for Path #7');
    await press(renderer, Constants.DELETE_PATH);
    await press(renderer, Constants.DELETE);

    expect(mockDelete).toHaveBeenCalledWith(7);
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('backing out of the confirmation deletes nothing', async () => {
    const renderer = await render();
    await press(renderer, 'More options for Path #7');
    await press(renderer, Constants.DELETE_PATH);
    await press(renderer, Constants.CANCEL);

    expect(mockDelete).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(labels(renderer)).not.toContain(Constants.DELETE);
  });

  it('keeps the screen in place when the delete could not be saved', async () => {
    // The command alerts on failure. Navigating away as well would tell the
    // user it worked while the path is still on their account.
    mockDelete.mockResolvedValue(false);
    const renderer = await render();
    await press(renderer, 'More options for Path #7');
    await press(renderer, Constants.DELETE_PATH);
    await press(renderer, Constants.DELETE);

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('a second tap while the first is in flight does not delete twice', async () => {
    let release!: (value: boolean) => void;
    mockDelete.mockReturnValue(
      new Promise<boolean>((resolve) => {
        release = resolve;
      })
    );
    const renderer = await render();
    await press(renderer, 'More options for Path #7');
    await press(renderer, Constants.DELETE_PATH);

    // Neither tap is awaited: the first is still in flight when the second lands.
    await tap(renderer, Constants.DELETE);
    await tap(renderer, Constants.DELETE);
    await act(async () => {
      release(true);
    });

    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });
});
