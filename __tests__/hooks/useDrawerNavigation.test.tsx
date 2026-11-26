import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useDrawerNavigation } from '../../hooks/useDrawerNavigation';

const mockNavigation = {
  getState: jest.fn(),
  popTo: jest.fn(),
  push: jest.fn(),
  navigate: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

let navigate!: ReturnType<typeof useDrawerNavigation>['handleDrawerNavigate'];
const Probe = () => {
  navigate = useDrawerNavigation().handleDrawerNavigate;
  return null;
};

const onRoute = (name: string, params?: object) =>
  mockNavigation.getState.mockReturnValue({
    index: 2,
    routes: [{ name: 'Home' }, { name: 'Continue' }, { name, params }],
  });

beforeEach(async () => {
  jest.clearAllMocks();
  await act(async () => {
    ReactTestRenderer.create(<Probe />);
  });
});

describe('opening Progress or Streaks from the drawer', () => {
  it('tells Continue how the reader was opened, so it can offer "Go to path"', () => {
    onRoute('Path', { pathId: 7 });

    navigate('Progress', 7);

    expect(mockNavigation.popTo).toHaveBeenCalledWith('Continue', {
      pathId: 7,
      initialTab: 'progress',
      returnToReader: { live: undefined },
    });
  });

  it('carries a follower’s live reading through, for the same follower view', () => {
    const live = { sehajPathId: 'g-1', driving: false, sessionId: 's-1', startAng: 3 };
    onRoute('Path', { pathId: 7, live });

    navigate('Streaks', 7);

    expect(mockNavigation.popTo).toHaveBeenCalledWith('Continue', {
      pathId: 7,
      initialTab: 'streak',
      returnToReader: { live },
    });
  });

  it('does not mark a Continue opened from anywhere else', () => {
    onRoute('Home');

    navigate('Progress', 7);

    expect(mockNavigation.push).toHaveBeenCalledWith('Continue', {
      pathId: 7,
      initialTab: 'progress',
    });
  });
});
