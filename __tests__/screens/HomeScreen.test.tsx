import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ScrollView } from 'react-native';
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
    PathMembershipRemovalDialog: (props: {
      visible: boolean;
      pathName?: string;
      adminName?: string;
      onDismiss: () => void;
    }) => ReactForMock.createElement('PathMembershipRemovalDialog', props),
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

  it('shows the membership-removal dialog after a notification tap', async () => {
    const navigation = { push: jest.fn(), setParams: jest.fn() };

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen
          navigation={navigation as never}
          route={
            {
              key: 'Home-notification',
              name: Routes.Home,
              params: {
                membershipRemovalNotice: { pathName: 'Morning Sehaj Path', adminName: 'Amrit' },
              },
            } as never
          }
        />
      );
    });

    const dialog = renderer.root.findByType('PathMembershipRemovalDialog' as never);
    expect(dialog.props).toMatchObject({
      visible: true,
      pathName: 'Morning Sehaj Path',
      adminName: 'Amrit',
    });

    await act(async () => {
      dialog.props.onDismiss();
    });
    expect(navigation.setParams).toHaveBeenCalledWith({ membershipRemovalNotice: undefined });
  });

  it('scrolls back inside the page when the page gets shorter', async () => {
    // Every text here follows the reader font. From Extra Large to Extra Small
    // the page shrinks while the scroll position stays put, so the page sat
    // scrolled past its own top (the greeting cut off) until the user scrolled.
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen
          navigation={{ push: jest.fn() } as never}
          route={{ key: 'Home-test', name: Routes.Home } as never}
        />
      );
    });
    const scroll = renderer.root.findByType(ScrollView);
    const scrollTo = jest.fn();
    (scroll.instance as { scrollTo: jest.Mock }).scrollTo = scrollTo;

    await act(async () => {
      scroll.props.onLayout({ nativeEvent: { layout: { height: 800 } } });
      // Scrolled 600 down a 1,600-tall page at Extra Large…
      scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 600 } } });
      // …then the page becomes 900 tall: at most 100 can be scrolled.
      scroll.props.onContentSizeChange(400, 900);
    });

    expect(scrollTo).toHaveBeenCalledWith({ y: 100, animated: false });
  });

  it('leaves the position alone when the page is still tall enough', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <HomeScreen
          navigation={{ push: jest.fn() } as never}
          route={{ key: 'Home-test', name: Routes.Home } as never}
        />
      );
    });
    const scroll = renderer.root.findByType(ScrollView);
    const scrollTo = jest.fn();
    (scroll.instance as { scrollTo: jest.Mock }).scrollTo = scrollTo;

    await act(async () => {
      scroll.props.onLayout({ nativeEvent: { layout: { height: 800 } } });
      scroll.props.onScroll({ nativeEvent: { contentOffset: { y: 200 } } });
      scroll.props.onContentSizeChange(400, 1200);
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
