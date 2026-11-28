import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { Dialog } from '../../components/Dialog';
import { ModalBackdrop } from '../../components/ModalBackdrop';
import { UIConstants } from '../../constants/UIConstants';
import { SelectionSheetSettingItemStyles } from '../../styles/SelectionSheetSettingItemStyles';

describe('the shared backdrop', () => {
  it('is a blur with a grey tint over it, and never takes touches', () => {
    const view = render(<ModalBackdrop />);
    const root = view.UNSAFE_root.findAll((node) => node.props.pointerEvents === 'none')[0];
    expect(root).toBeDefined();
    expect(view.UNSAFE_root.findAll((node) => (node.type as unknown) === 'BlurView')).toHaveLength(
      1
    );
    const tinted = view.UNSAFE_root.findAll(
      (node) =>
        typeof node.type === 'string' &&
        StyleSheet.flatten(node.props.style)?.backgroundColor === UIConstants.MODAL_BACKDROP_COLOR
    );
    expect(tinted.length).toBeGreaterThan(0);
  });

  it('is what a dialog shows behind its card', () => {
    // The turn options and confirmation pop-ups used a plain grey with no blur.
    const view = render(
      <Dialog visible nativeModal={false} onRequestClose={jest.fn()}>
        <Text>Delete this turn?</Text>
      </Dialog>
    );
    expect(view.UNSAFE_queryAllByType(ModalBackdrop)).toHaveLength(1);
    expect(view.getByText('Delete this turn?')).toBeTruthy();
  });
});

describe('a settings selection sheet', () => {
  it('sets its options one step smaller than its title', () => {
    // They were the same size, so the title did not read as a heading.
    expect(SelectionSheetSettingItemStyles.optionText.fontSize).toBeLessThan(
      SelectionSheetSettingItemStyles.sheetTitle.fontSize as number
    );
  });
});
