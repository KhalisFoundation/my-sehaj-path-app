import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { store } from '../../store';
import { ReaderFontSizeOverride, useReaderFontSize } from '../../hooks/useReaderFontSize';

/**
 * The size every part of the reader asks for.
 *
 * The verse components call this hook directly rather than taking a prop, so an
 * override applied anywhere else reaches the line height and nothing else — a
 * follower matched the reader's layout in every respect except the one most
 * visible on screen.
 */
let seen: number | null = null;
const Probe = () => {
  seen = useReaderFontSize();
  return null;
};

const render = (override: number | null) =>
  act(() => {
    ReactTestRenderer.create(
      <Provider store={store}>
        <ReaderFontSizeOverride.Provider value={override}>
          <Probe />
        </ReaderFontSizeOverride.Provider>
      </Provider>
    );
  });

beforeEach(() => {
  seen = null;
});

describe('the reader font size', () => {
  it('uses this device’s own setting by default', () => {
    render(null);
    expect(typeof seen).toBe('number');
    expect(seen).toBeGreaterThan(0);
  });

  it('takes an imposed size while following somebody', () => {
    render(41);
    expect(seen).toBe(41);
  });

  it('returns to the device’s own the moment the override goes', () => {
    render(41);
    const imposed = seen;
    render(null);
    // The follower's setting is theirs; it is borrowed for one reading, never
    // written.
    expect(seen).not.toBe(imposed);
  });
});
