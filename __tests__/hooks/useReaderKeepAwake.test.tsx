import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { activateKeepAwake, deactivateKeepAwake } from '@sayem314/react-native-keep-awake';
import { useReaderKeepAwake } from '../../hooks/useReaderKeepAwake';

jest.mock('@react-navigation/native', () => ({ useIsFocused: jest.fn() }));

const focus = useIsFocused as jest.Mock;
let stateListener: ((state: AppStateStatus) => void) | undefined;
const remove = jest.fn();

beforeEach(() => {
  focus.mockReturnValue(true);
  stateListener = undefined;
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
    stateListener = listener;
    return { remove };
  });
});

test('waits for reading content and releases when it disappears', () => {
  const { rerender } = renderHook<void, { loaded: boolean }>(
    ({ loaded }) => useReaderKeepAwake(loaded),
    {
      initialProps: { loaded: false },
    }
  );
  expect(activateKeepAwake).not.toHaveBeenCalled();
  rerender({ loaded: true });
  expect(activateKeepAwake).toHaveBeenCalledTimes(1);
  rerender({ loaded: false });
  expect(deactivateKeepAwake).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
});

test('releases for inactive/background states and reacquires only on return', () => {
  const { unmount } = renderHook(() => useReaderKeepAwake(true));
  act(() => stateListener?.('inactive'));
  act(() => stateListener?.('background'));
  expect(deactivateKeepAwake).toHaveBeenCalledTimes(1);
  act(() => stateListener?.('active'));
  act(() => stateListener?.('active'));
  expect(activateKeepAwake).toHaveBeenCalledTimes(2);
  unmount();
  expect(deactivateKeepAwake).toHaveBeenCalledTimes(2);
  expect(remove).toHaveBeenCalledTimes(1);
});

test('opening settings releases the hold even though the reader remains mounted', () => {
  const { rerender, unmount } = renderHook(() => useReaderKeepAwake(true));
  focus.mockReturnValue(false);
  rerender({});
  expect(deactivateKeepAwake).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
  focus.mockReturnValue(true);
  rerender({});
  expect(activateKeepAwake).toHaveBeenCalledTimes(2);
  unmount();
  expect(deactivateKeepAwake).toHaveBeenCalledTimes(2);
});

test('a hidden reader does not subscribe or keep the display awake', () => {
  focus.mockReturnValue(false);
  renderHook(() => useReaderKeepAwake(true));
  expect(AppState.addEventListener).not.toHaveBeenCalled();
  expect(activateKeepAwake).not.toHaveBeenCalled();
});

test('a reader mounted in the background waits for active and does not double-release', () => {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'background' });
  const { unmount } = renderHook(() => useReaderKeepAwake(true));
  expect(activateKeepAwake).not.toHaveBeenCalled();
  act(() => stateListener?.('active'));
  expect(activateKeepAwake).toHaveBeenCalledTimes(1);
  act(() => stateListener?.('background'));
  unmount();
  expect(deactivateKeepAwake).toHaveBeenCalledTimes(1);
});
