import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Modal } from 'react-native';

const mockDispatch = jest.fn();
let mockCompleted: 'installed' | 'updated' | null = null;

jest.mock('../../store/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({
      db: { completed: mockCompleted },
      // Present because the dialog's text reads it through AppText.
      settings: { fontSize: { fontSize: 'Small (Default)', number: 24 } },
    }),
  useAppDispatch: () => mockDispatch,
}));

import { OfflineDbNotice } from '../../components/OfflineDbNotice';
import { dbNoticeShown } from '../../store/slices/dbSlice';

const render = async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<OfflineDbNotice />);
  });
  return renderer;
};

const modalOf = (renderer: ReactTestRenderer.ReactTestRenderer) => renderer.root.findByType(Modal);

beforeEach(() => {
  mockDispatch.mockClear();
  mockCompleted = null;
});

describe('OfflineDbNotice', () => {
  it('stays hidden until a download actually completes', async () => {
    const renderer = await render();

    expect(modalOf(renderer).props.visible).toBe(false);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('does NOT consume the completion until the dialog is really on screen', async () => {
    // The case this exists for: the download finishes while the SSO browser is
    // covering the screen. iOS will not present a modal underneath one, so
    // `onShow` never fires — and clearing the flag anyway lost the notice for
    // good, because nothing raises it again once the database is installed.
    mockCompleted = 'installed';
    const renderer = await render();

    expect(modalOf(renderer).props.visible).toBe(true);
    expect(mockDispatch).not.toHaveBeenCalledWith(dbNoticeShown());

    // The screen frees up; the modal presents and only now is it consumed.
    await act(async () => {
      modalOf(renderer).props.onShow();
    });
    expect(mockDispatch).toHaveBeenCalledWith(dbNoticeShown());
  });

  it('consumes the completion when the user dismisses it', async () => {
    // A dialog the user dismissed has served its purpose even if `onShow` never
    // arrived; without this the flag would replay forever.
    mockCompleted = 'installed';
    const renderer = await render();

    await act(async () => {
      modalOf(renderer).props.onRequestClose();
    });

    expect(mockDispatch).toHaveBeenCalledWith(dbNoticeShown());
    expect(modalOf(renderer).props.visible).toBe(false);
  });

  it('says "Database updated" for an update, not "Offline reading ready"', async () => {
    mockCompleted = 'updated';
    const renderer = await render();

    const text = renderer.root
      .findAllByType(require('react-native').Text)
      .flatMap((node) => node.props.children)
      .filter((child: unknown) => typeof child === 'string');

    expect(text).toContain('Database updated');
    expect(text).not.toContain('Offline reading ready');
  });
});
