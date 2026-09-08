import React from 'react';
import { AppState } from 'react-native';
import { Provider } from 'react-redux';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { activateKeepAwake, deactivateKeepAwake } from '@sayem314/react-native-keep-awake';
import { store } from '../../store';
import { setAll } from '../../store/slices/pathsSlice';
import { setKeepScreenAwake } from '../../store/slices/settingsSlice';
import { PathScreen } from '../../screens/PathScreen';
import { getAngContent } from '../../db';

jest.mock('../../db', () => ({ getAngContent: jest.fn() }));
jest.mock('../../utils', () => ({
  convertNumberToFormat: ({ number }: { number: number }) => String(number),
  recordError: jest.fn(),
  showErrorAlert: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => true,
  useFocusEffect: jest.fn(),
}));
jest.mock('../../hooks', () => ({
  useReaderKeepAwake: jest.requireActual('../../hooks/useReaderKeepAwake').useReaderKeepAwake,
  useInternet: () => ({ checkNetwork: jest.fn() }),
  useNavigation: () => ({ handleRightArrow: jest.fn(), handleLeftArrow: jest.fn() }),
  usePathNavigation: () => ({ handleGoBack: jest.fn(), confirmBeforeLeaving: jest.fn() }),
  useDrawerNavigation: () => ({ handleDrawerNavigate: jest.fn() }),
  useScrollToSavedPath: () => ({ scrollToSavedPathData: jest.fn() }),
  useScreenAnalytics: jest.fn(),
}));
jest.mock('../../components', () => {
  const { Button, View, Text } = jest.requireActual('react-native');
  const ReactForMock = jest.requireActual<typeof React>('react');
  return {
    PathNavigation: ({ onMenuPress, setIsAngsNavigationVisible }: any) =>
      ReactForMock.createElement(
        View,
        {},
        ReactForMock.createElement(Button, { title: 'Menu', onPress: onMenuPress }),
        ReactForMock.createElement(Button, {
          title: 'Choose Ang',
          onPress: () => setIsAngsNavigationVisible(true),
        })
      ),
    DrawerMenu: ({ isVisible, onClose }: any) =>
      isVisible
        ? ReactForMock.createElement(Button, { title: 'Close drawer', onPress: onClose })
        : null,
    AngsNavigation: ({ setIsAngsNavigationVisible }: any) =>
      ReactForMock.createElement(Button, {
        title: 'Close Ang picker',
        onPress: () => setIsAngsNavigationVisible(false),
      }),
    PathSelectionProvider: View,
    PathReader: ({ pathContent }: any) =>
      pathContent ? ReactForMock.createElement(Text, {}, 'Reading content') : null,
    PathControls: () => null,
    Loading: () => null,
    Message: () => null,
  };
});

beforeEach(() => {
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  store.dispatch(setKeepScreenAwake(false));
  store.dispatch(
    setAll({
      paths: [
        {
          pathId: 1,
          pathName: 'Path #1',
          progress: 1,
          saveData: { angNumber: 1, verseId: 0 },
          startDate: '',
          completionDate: '',
        },
      ],
      dates: [],
    })
  );
  (getAngContent as jest.Mock).mockResolvedValue({
    success: true,
    data: { page: [{ verseId: 1 }] },
  });
});

it.each([
  ['Menu', 'Close drawer'],
  ['Choose Ang', 'Close Ang picker'],
])('releases for %s and restores only when opted in', async (open, close) => {
  const screen = render(
    <Provider store={store}>
      <PathScreen
        navigation={{ addListener: () => jest.fn() } as never}
        route={{ params: { pathId: 1 } } as never}
      />
    </Provider>
  );
  await screen.findByText('Reading content');
  expect(activateKeepAwake).not.toHaveBeenCalled();
  act(() => {
    store.dispatch(setKeepScreenAwake(true));
  });
  await waitFor(() => expect(activateKeepAwake).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByText(open));
  expect(deactivateKeepAwake).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText(close));
  expect(activateKeepAwake).toHaveBeenCalledTimes(2);
  fireEvent.press(screen.getByText(open));
  act(() => {
    store.dispatch(setKeepScreenAwake(false));
  });
  fireEvent.press(screen.getByText(close));
  expect(activateKeepAwake).toHaveBeenCalledTimes(2);
  expect(deactivateKeepAwake).toHaveBeenCalledTimes(2);
  screen.unmount();
});
