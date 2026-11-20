import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Routes } from '../../constants';
import { HomeScreen } from '../../screens/HomeScreen';

jest.mock('../../store/hooks', () => ({
  useAppSelector: jest.fn(() => []),
  useAppDispatch: jest.fn(() => jest.fn()),
}));

jest.mock('../../hooks', () => ({
  useScreenAnalytics: jest.fn(),
  useDrawerNavigation: jest.fn(() => ({ handleDrawerNavigate: jest.fn() })),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useIsFocused: jest.fn(() => false),
}));

jest.mock('../../components', () => {
  const ReactForMock = jest.requireActual<typeof React>('react');
  const Empty = () => null;
  return {
    DrawerMenu: Empty,
    Headline: Empty,
    Label: Empty,
    PrimaryCard: Empty,
    SecondaryCard: Empty,
    Slider: Empty,
    SyncPopup: Empty,
    SignInPopup: Empty,
    SyncUnavailablePopup: Empty,
    PrimaryButton: (props: { buttonTitle: string; onPress: () => void }) =>
      ReactForMock.createElement('PrimaryButton', props),
  };
});

jest.mock('../../icons', () => ({
  MenuIcon: () => null,
}));

describe('HomeScreen', () => {
  it('opens the dedicated create-path screen', async () => {
    const navigation = { push: jest.fn() };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen
          navigation={navigation as never}
          route={{ key: 'Home-test', name: Routes.Home } as never}
        />
      );
    });

    const startButton = renderer.root.findByType('PrimaryButton' as never);

    await act(async () => {
      startButton.props.onPress();
    });
    expect(navigation.push).toHaveBeenCalledWith(Routes.CreatePath);
  });
});
