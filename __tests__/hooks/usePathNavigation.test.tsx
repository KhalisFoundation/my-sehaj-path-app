import { act, renderHook } from '@testing-library/react-native';
import { usePathNavigation } from '../../hooks/usePathNavigation';

const mockState = {
  paths: { paths: [{ pathId: 1, saveData: { angNumber: 10, verseId: 1 } }] },
};

jest.mock('../../store', () => ({ store: { getState: () => mockState } }));

describe('usePathNavigation', () => {
  it('pops to the existing Home route so reader screens do not accumulate', async () => {
    const navigation = {
      popTo: jest.fn(),
      push: jest.fn(),
    } as any;
    const persistCurrentScroll = jest.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      usePathNavigation({
        isAngNavigation: false,
        pathAng: 10,
        pathId: 1,
        setIsAngNavigation: jest.fn(),
        updatePathAng: jest.fn(),
        navigation,
        persistCurrentScroll,
      })
    );

    await act(async () => result.current.handleGoBack());

    expect(persistCurrentScroll).toHaveBeenCalledTimes(1);
    expect(navigation.popTo).toHaveBeenCalledWith('Home');
    expect(navigation.push).not.toHaveBeenCalled();
  });
});
