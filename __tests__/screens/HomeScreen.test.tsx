import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { ErrorConstants, Routes } from '../../constants';
import { HomeScreen } from '../../screens/HomeScreen';

const mockCreatePath = jest.fn();
const mockRecordError = jest.fn();
const mockShowErrorAlert = jest.fn();
const mockTrackEvent = jest.fn();

jest.mock('../../store/commands', () => ({
  createPath: (...args: unknown[]) => mockCreatePath(...args),
}));

jest.mock('../../store/hooks', () => ({
  useAppSelector: jest.fn(() => []),
}));

jest.mock('../../hooks', () => ({
  useScreenAnalytics: jest.fn(),
  useDrawerNavigation: jest.fn(() => ({ handleDrawerNavigate: jest.fn() })),
}));

jest.mock('../../utils', () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
  showErrorAlert: (...args: unknown[]) => mockShowErrorAlert(...args),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
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
    PrimaryButton: (props: { buttonTitle: string; onPress: () => void }) =>
      ReactForMock.createElement('PrimaryButton', props),
  };
});

jest.mock('../../icons', () => ({
  MenuIcon: () => null,
}));

describe('HomeScreen', () => {
  it('reports and alerts when createPath rejects, then releases the create guard', async () => {
    const error = new Error('unexpected create failure');
    mockCreatePath.mockRejectedValueOnce(error).mockResolvedValueOnce(7);
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
      await startButton.props.onPress();
    });

    expect(mockRecordError).toHaveBeenCalledWith(
      error,
      'HomeScreen: failed to create new sehaj path'
    );
    expect(mockShowErrorAlert).toHaveBeenCalledWith(ErrorConstants.FAILED_TO_CREATE_NEW_SEHAJ_PATH);
    expect(navigation.push).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalled();

    // The finally block must release the rapid-tap guard after a rejection.
    await act(async () => {
      await startButton.props.onPress();
    });
    expect(mockTrackEvent).toHaveBeenCalledWith('PathCreated', 'click', 'start new path');
    expect(navigation.push).toHaveBeenCalledWith(Routes.Continue, { pathId: 7 });
  });
});
