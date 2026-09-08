import React from 'react';
import { Provider } from 'react-redux';
import { act, fireEvent, render } from '@testing-library/react-native';
import { makeStore } from '../../store';
import { hydrateSettings } from '../../store/slices/settingsSlice';
import { SimpleTextForPath } from '../../components/SimpleTextForPath';
import { ParagraphTextForPath } from '../../components/ParagraphTextForPath';
import { PathSelectionProvider, type PathSelection } from '../../components/PathSelectionContext';
import { LARIVAAR_ASSIST_COLORS } from '../../components/LarivaarAssistText';

jest.mock('../../utils', () => jest.requireActual('../../utils/pathTextHelpers'));

const words = ['ਸਤਿ', 'ਨਾਮੁ', 'ਕਰਤਾ', 'ਪੁਰਖੁ'];

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe.each(['line', 'paragraph'])('Assist in the %s reader', (mode) => {
  it('keeps long-press saving on the verse while colouring its words', () => {
    const store = makeStore();
    store.dispatch(hydrateSettings({ larivaar: true, larivaarAssist: true }));
    const selection: PathSelection = {
      isSaving: false,
      isSaved: false,
      pressIndex: 0,
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
    const onSave = jest.fn();
    const VerseComponent = mode === 'line' ? SimpleTextForPath : ParagraphTextForPath;
    const separator = mode === 'paragraph' ? '\u200B' : '';
    const screen = render(
      <Provider store={store}>
        <PathSelectionProvider {...selection}>
          <VerseComponent
            gurbaniLine={words.join(separator)}
            renderWordSegments={words}
            index={1}
            verseId={42}
            vishraams={{ sttm: [], sttm2: [], igurbani: [] }}
            onSelection={jest.fn()}
            onSave={onSave}
          />
        </PathSelectionProvider>
      </Provider>
    );
    expect(screen.getByText(`ਨਾਮੁ${separator}`)).toHaveStyle({ color: LARIVAAR_ASSIST_COLORS[1] });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    const verse = screen.getByRole('button');
    if (mode === 'line') {
      fireEvent(verse, 'longPress');
    } else {
      fireEvent(verse, 'pressIn');
      act(() => jest.advanceTimersByTime(500));
      fireEvent(verse, 'pressOut');
    }
    expect(selection.setSavedPathVerseId).toHaveBeenCalledWith(42);
    expect(selection.setIsSaving).toHaveBeenCalledWith(true);
    expect(onSave).toHaveBeenCalledTimes(1);
    screen.unmount();
  });
});
