import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { usePathNavigation } from '../../hooks/usePathNavigation';

const mockState = {
  paths: { paths: [{ pathId: 1, saveData: { angNumber: 10, verseId: 1 } }] },
};

jest.mock('../../store', () => ({ store: { getState: () => mockState } }));

type Props = Parameters<typeof usePathNavigation>[0];

const setup = (over: Partial<Pick<Props, 'isAngNavigation' | 'pathAng'>> = {}) => {
  const popTo = jest.fn();
  const push = jest.fn();
  const setIsAngNavigation = jest.fn();
  const updatePathAng = jest.fn();
  const persistCurrentScroll = jest.fn().mockResolvedValue(true);
  const suppressLeaveSave = jest.fn();
  const navigation = { popTo, push } as unknown as Props['navigation'];

  const { result } = renderHook(() =>
    usePathNavigation({
      isAngNavigation: false,
      pathAng: 10,
      pathId: 1,
      setIsAngNavigation,
      updatePathAng,
      navigation,
      persistCurrentScroll,
      suppressLeaveSave,
      ...over,
    })
  );
  return {
    popTo,
    push,
    setIsAngNavigation,
    updatePathAng,
    persistCurrentScroll,
    suppressLeaveSave,
    result,
  };
};

/** Press a button on the most recent Alert by its label. */
const pressAlert = async (label: string) => {
  const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)?.[2] ?? [];
  const button = buttons.find((b: { text: string }) => b.text.includes(label));
  expect(button).toBeDefined();
  await act(async () => button.onPress());
};

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.clearAllMocks();
});

describe('usePathNavigation', () => {
  it('pops to the existing Home route so reader screens do not accumulate', async () => {
    const { persistCurrentScroll, popTo, push, result } = setup();

    await act(async () => result.current.handleGoBack());

    expect(persistCurrentScroll).toHaveBeenCalledTimes(1);
    expect(popTo).toHaveBeenCalledWith('Home');
    expect(push).not.toHaveBeenCalled();
  });

  it('asks before leaving a jumped ang that was never saved', async () => {
    // Saved ang is 10; the reader is showing 500 after a jump.
    const { persistCurrentScroll, popTo, result } = setup({
      isAngNavigation: true,
      pathAng: 500,
    });

    await act(async () => result.current.handleGoBack());

    expect(Alert.alert).toHaveBeenCalled();
    // Nothing is written and nothing moves until the user answers.
    expect(persistCurrentScroll).not.toHaveBeenCalled();
    expect(popTo).not.toHaveBeenCalled();
  });

  it('leaving without saving must not let the exit checkpoint write the ang', async () => {
    // The bug this covers: declining navigates immediately, and removing the
    // screen fires the reader's `beforeRemove` checkpoint — which persists the
    // ang currently on screen. That is still the jumped one, because the revert
    // is a `setState` that has not committed. Home then showed the ang the user
    // had just refused to save.
    const { updatePathAng, suppressLeaveSave, persistCurrentScroll, popTo, result } = setup({
      isAngNavigation: true,
      pathAng: 500,
    });

    await act(async () => result.current.handleGoBack());
    await pressAlert('Without Saving');

    // The checkpoint is disarmed BEFORE navigating, or it fires on the way out.
    expect(suppressLeaveSave).toHaveBeenCalledTimes(1);
    expect(suppressLeaveSave.mock.invocationCallOrder[0]).toBeLessThan(
      popTo.mock.invocationCallOrder[0]
    );
    // The reader is put back to the saved ang, and nothing is persisted here.
    expect(updatePathAng).toHaveBeenCalledWith(10);
    expect(persistCurrentScroll).not.toHaveBeenCalled();
    expect(popTo).toHaveBeenCalledWith('Home');
  });

  it('saving on the way out keeps the jumped ang', async () => {
    const { setIsAngNavigation, suppressLeaveSave, persistCurrentScroll, popTo, result } = setup({
      isAngNavigation: true,
      pathAng: 500,
    });

    await act(async () => result.current.handleGoBack());
    await pressAlert('Save');

    expect(persistCurrentScroll).toHaveBeenCalledTimes(1);
    // The checkpoint must NOT be disarmed here — this path wants the write.
    expect(suppressLeaveSave).not.toHaveBeenCalled();
    expect(setIsAngNavigation).toHaveBeenCalledWith(false);
    expect(popTo).toHaveBeenCalledWith('Home');
  });
});
