import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Text as RNText, StyleSheet, type TextStyle } from 'react-native';
import { FontSizes, FontScale } from '@constants/FontSize';

// One mutable value standing in for `settings.fontSize`, plus the subscription
// react-redux would provide. Without the subscription this test could not tell
// a component that re-reads the store from one that ignores a change.
// `mock`-prefixed so jest allows the factory below to close over them.
let mockFontSize: { fontSize: string; number: number } = FontSizes[1];
const mockListeners = new Set<() => void>();

const setFontSize = (next: { fontSize: string; number: number }) => {
  mockFontSize = next;
  mockListeners.forEach((notify) => notify());
};

jest.mock('../../store/hooks', () => {
  const { useSyncExternalStore } = jest.requireActual<typeof import('react')>('react');
  return {
    useAppSelector: (selector: (state: unknown) => unknown) =>
      useSyncExternalStore(
        (notify: () => void) => {
          mockListeners.add(notify);
          return () => mockListeners.delete(notify);
        },
        () =>
          selector({
            settings: { fontSize: mockFontSize, vishraam: false, vishraamsSource: { source: '' } },
          })
      ),
  };
});

import { SimpleTextForPath } from '../../components/SimpleTextForPath';
import { PathSelectionProvider } from '../../components/PathSelectionContext';

/** Idle selection state — nothing here changes while the setting does. */
const selection = {
  isSaving: false,
  isSaved: false,
  pressIndex: -1,
  savedPathVerseId: 0,
  hasPendingVerseSelection: false,
  found: false,
  setIsSaving: jest.fn(),
  setIsSaved: jest.fn(),
  setPressIndex: jest.fn(),
  setSavedPathVerseId: jest.fn(),
  setHasPendingVerseSelection: jest.fn(),
  setFound: jest.fn(),
};

const props = {
  gurbaniLine: 'ਸਤਿ ਨਾਮੁ',
  onSelection: jest.fn(),
  onSave: jest.fn(),
  onLayout: jest.fn(),
  index: 1,
  verseId: 1,
  vishraams: {} as never,
};

const readerSizeOf = (renderer: ReactTestRenderer.ReactTestRenderer) => {
  const text = renderer.root.findAllByType(RNText)[0];
  return (StyleSheet.flatten(text.props.style) as TextStyle).fontSize;
};

describe('the reader follows the font setting', () => {
  it('re-renders at the new size without being unmounted', async () => {
    // The reader sits behind `React.memo` with a custom comparator, inside a
    // parent that memoises its verse elements. None of those inputs change when
    // the setting does, so if the size were read through props the reader would
    // keep rendering the old one while the rest of the app moved. It reads the
    // store itself precisely so this holds.
    setFontSize(FontSizes[1]);

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PathSelectionProvider {...selection}>
          <SimpleTextForPath {...props} />
        </PathSelectionProvider>
      );
    });
    expect(readerSizeOf(renderer)).toBe(FontScale.reader[1]);

    // Same element, same props — only the store moves.
    await act(async () => {
      setFontSize(FontSizes[4]);
    });
    expect(readerSizeOf(renderer)).toBe(FontScale.reader[4]);

    await act(async () => {
      setFontSize(FontSizes[0]);
    });
    expect(readerSizeOf(renderer)).toBe(FontScale.reader[0]);
  });

  it('takes its size from the same table the settings list offers', async () => {
    // A mismatch here is the bug where picking "Small" renders a size that is
    // not the Small the picker named.
    for (let step = 0; step < FontSizes.length; step += 1) {
      let renderer!: ReactTestRenderer.ReactTestRenderer;
      await act(async () => {
        setFontSize(FontSizes[step]);
        renderer = ReactTestRenderer.create(
          <PathSelectionProvider {...selection}>
            <SimpleTextForPath {...props} />
          </PathSelectionProvider>
        );
      });
      expect(readerSizeOf(renderer)).toBe(FontSizes[step].number);
    }
  });

  it('does not apply the device accessibility scale on top of the app setting', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <PathSelectionProvider {...selection}>
          <SimpleTextForPath {...props} />
        </PathSelectionProvider>
      );
    });

    expect(renderer.root.findAllByType(RNText)[0].props.allowFontScaling).toBe(false);
  });
});
