import React from 'react';
import { Text } from 'react-native';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { act, render } from '@testing-library/react-native';
import { LarivaarAssistText, LARIVAAR_ASSIST_COLORS } from '../../components/LarivaarAssistText';
import { ReaderVerseText } from '../../components/ReaderVerseText';
import { settingsSlice, setLarivaarAssist, setLarivaar } from '../../store/slices/settingsSlice';
import { VishraamsTheme } from '../../constants/VishraamsTheme';

const words = ['ਸਤਿ', 'ਨਾਮੁ', 'ਕਰਤਾ', 'ਪੁਰਖੁ'];

describe('Larivaar Assist rendering', () => {
  it.each(['', '\u200B'])('preserves the exact reader string with separator %j', (separator) => {
    const line = words.join(separator);
    const screen = render(
      <Text testID="verse">
        <LarivaarAssistText gurbaniLine={line} wordSegments={words} />
      </Text>
    );
    expect(screen.getByTestId('verse')).toHaveTextContent(line);
    words.forEach((word, index) => {
      expect(screen.getByText(word + (index < words.length - 1 ? separator : ''))).toHaveStyle({
        color: LARIVAAR_ASSIST_COLORS[index % 2],
      });
    });
  });

  it.each([undefined, null, [], ['different', 'text'], ['ਸਤਿਨਾਮੁਕਰਤਾਪੁਰਖੁ']])(
    'leaves the source untouched when boundaries are unavailable or unsafe: %j',
    (segments) => {
      const line = words.join('');
      const screen = render(
        <Text testID="verse">
          <LarivaarAssistText gurbaniLine={line} wordSegments={segments} />
        </Text>
      );
      expect(screen.getByTestId('verse').props.children).toBeTruthy();
      expect(screen.getByTestId('verse')).toHaveTextContent(line);
      expect(screen.UNSAFE_getAllByType(Text)).toHaveLength(1);
    }
  );

  it.each([
    'ਸਤਿ\u200Bਨਾਮੁਕਰਤਾਪੁਰਖੁ',
    'ਸਤਿ\u200B\u200Bਨਾਮੁ\u200Bਕਰਤਾ\u200Bਪੁਰਖੁ',
    '\u200Bਸਤਿਨਾਮੁਕਰਤਾਪੁਰਖੁ',
  ])('preserves irregular source separators without adding or removing characters: %j', (line) => {
    const screen = render(
      <Text testID="verse">
        <LarivaarAssistText gurbaniLine={line} wordSegments={words} />
      </Text>
    );
    expect(screen.getByTestId('verse')).toHaveTextContent(line);
    expect(screen.UNSAFE_getAllByType(Text)).toHaveLength(1);
  });

  it('reactively restores Vishraams when Assist is disabled and preserves both preferences', () => {
    const store = configureStore({
      reducer: { settings: settingsSlice.reducer },
      preloadedState: {
        settings: {
          ...settingsSlice.getInitialState(),
          larivaar: true,
          larivaarAssist: true,
          vishraam: true,
        },
      },
    });
    const screen = render(
      <Provider store={store}>
        <Text>
          <ReaderVerseText
            gurbaniLine={words.join('')}
            renderWordSegments={words}
            vishraams={{ sttm: [{ p: 1, t: 'v' }], sttm2: [], igurbani: [] }}
          />
        </Text>
      </Provider>
    );
    expect(screen.getByText('ਨਾਮੁ')).toHaveStyle({ color: LARIVAAR_ASSIST_COLORS[1] });
    act(() => store.dispatch(setLarivaarAssist(false)));
    expect(screen.getByText('ਨਾਮੁ')).toHaveStyle({ color: VishraamsTheme.mainPause.text });
    act(() => store.dispatch(setLarivaarAssist(true)));
    act(() => store.dispatch(setLarivaar(false)));
    expect(screen.getByText('ਨਾਮੁ')).toHaveStyle({ color: VishraamsTheme.mainPause.text });
    expect(store.getState().settings.larivaarAssist).toBe(true);
    expect(store.getState().settings.vishraam).toBe(true);
  });
});
