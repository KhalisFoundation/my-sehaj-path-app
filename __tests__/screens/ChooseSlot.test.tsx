import React from 'react';
import { Provider } from 'react-redux';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ChooseSlot } from '../../screens/ChooseSlot';
import { store } from '../../store';
import { bookSlot, loadPlan, updateSlot } from '../../store/groupApi';
import { pinClock, unpinClock } from '../fixtures/pinClock';

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(),
    displayNotification: jest.fn(),
  },
  AndroidImportance: { HIGH: 4 },
}));

jest.mock('../../store/groupApi', () => ({
  loadPlan: jest.fn(),
  bookSlot: jest.fn(),
  updateSlot: jest.fn(),
}));
jest.mock('@react-native-community/datetimepicker', () => {
  const { Pressable, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ value, onChange, accessibilityLabel, mode }: any) => (
      <Pressable
        accessibilityLabel={accessibilityLabel || `Native ${mode} picker`}
        onPress={() => {
          const selected = new Date(value);
          if (mode === 'date') {
            selected.setDate(selected.getDate() + 1);
          } else {
            selected.setHours(7, 7, 0, 0);
          }
          onChange({ type: 'set' }, selected);
        }}
      >
        <Text>Time picker</Text>
      </Pressable>
    ),
  };
});

const loadPlanMock = loadPlan as jest.MockedFunction<typeof loadPlan>;
const bookSlotMock = bookSlot as jest.MockedFunction<typeof bookSlot>;
const updateSlotMock = updateSlot as jest.MockedFunction<typeof updateSlot>;
const goBack = jest.fn();
const navigation = { goBack } as never;
const route = { key: 'ChooseSlot', name: 'ChooseSlot', params: { sehajPathId: 'p1' } } as never;

const renderScreen = () =>
  render(
    <Provider store={store}>
      <ChooseSlot navigation={navigation} route={route} />
    </Provider>
  );

const plan = (slots: unknown[] = []) =>
  loadPlanMock.mockResolvedValue({ ok: true, data: { stateVersion: 1, slots } } as never);

const selectTomorrowAtSevenOhSeven = async (
  findByLabelText: ReturnType<typeof renderScreen>['findByLabelText'],
  findByText: ReturnType<typeof renderScreen>['findByText']
) => {
  fireEvent.press(await findByLabelText('Date picker'));
  fireEvent.press(await findByLabelText('Native date picker'));
  fireEvent.press(await findByText('OK'));
  fireEvent.press(await findByLabelText('Start time picker'));
  fireEvent.press(await findByLabelText('Native time picker'));
  fireEvent.press(await findByText('OK'));
};

beforeEach(() => {
  // The mocked date picker moves the screen's day forward by one, so what
  // "tomorrow" means must not depend on the hour the suite happens to run.
  pinClock();
  jest.clearAllMocks();
  plan();
});

afterEach(() => {
  unpinClock();
});

describe('ChooseSlot', () => {
  it('uses the full design duration range', async () => {
    const { findByText, queryByTestId } = renderScreen();
    expect(await findByText('15 mins')).toBeTruthy();
    expect(await findByText('120 mins')).toBeTruthy();
    await waitFor(() => expect(queryByTestId('turn-plan-loading')).toBeNull());
  });

  it('books the exact time selected by the user', async () => {
    bookSlotMock.mockResolvedValue({ ok: true, data: {} } as never);
    const { findByLabelText, findByText } = renderScreen();
    await selectTomorrowAtSevenOhSeven(findByLabelText, findByText);
    fireEvent.press(await findByText('Add turn'));

    await waitFor(() => expect(bookSlotMock).toHaveBeenCalledTimes(1));
    const [pathId, startsAt, endsAt] = bookSlotMock.mock.calls[0];
    expect(pathId).toBe('p1');
    expect((startsAt as Date).getHours()).toBe(7);
    expect((startsAt as Date).getMinutes()).toBe(7);
    expect((endsAt as Date).getTime() - (startsAt as Date).getTime()).toBe(15 * 60 * 1000);
    expect(goBack).toHaveBeenCalled();
  });

  it('sends an unbounded daily recurrence when the reader selects repeat', async () => {
    bookSlotMock.mockResolvedValue({ ok: true, data: {} } as never);
    const { findByLabelText, findByText, getAllByText } = renderScreen();
    await selectTomorrowAtSevenOhSeven(findByLabelText, findByText);

    fireEvent.press(await findByLabelText('Repeat options'));
    fireEvent.press(getAllByText('Every day')[0]);
    fireEvent.press(await findByText('Add turn'));

    await waitFor(() => expect(bookSlotMock).toHaveBeenCalledTimes(1));
    const recurrence = bookSlotMock.mock.calls[0][3];
    expect(recurrence).toMatchObject({
      recurrenceRule: 'FREQ=DAILY',
      recurrenceTimezone: expect.any(String),
    });
  });

  it.each([
    {
      option: /^Every week on /,
      expectedRule: (startsAt: Date) =>
        `FREQ=WEEKLY;BYDAY=${['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][startsAt.getDay()]}`,
    },
    {
      option: /^Every month on the /,
      expectedRule: (startsAt: Date) => `FREQ=MONTHLY;BYMONTHDAY=${startsAt.getDate()}`,
    },
    {
      option: /^Every year on /,
      expectedRule: (startsAt: Date) =>
        `FREQ=YEARLY;BYMONTH=${startsAt.getMonth() + 1};BYMONTHDAY=${startsAt.getDate()}`,
    },
  ])('sends the selected $option recurrence rule', async ({ option, expectedRule }) => {
    bookSlotMock.mockResolvedValue({ ok: true, data: {} } as never);
    const { findAllByText, findByLabelText, findByText } = renderScreen();
    await selectTomorrowAtSevenOhSeven(findByLabelText, findByText);

    fireEvent.press(await findByLabelText('Repeat options'));
    fireEvent.press((await findAllByText(option))[0]);
    fireEvent.press(await findByText('Add turn'));

    await waitFor(() => expect(bookSlotMock).toHaveBeenCalledTimes(1));
    const [, startsAt, , recurrence] = bookSlotMock.mock.calls[0];
    expect(recurrence?.recurrenceRule).toBe(expectedRule(startsAt as Date));
  });

  it('disables the selected time when its duration overlaps a turn', async () => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const midnight = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate()
    ).toISOString();
    const nextMidnight = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate() + 1
    ).toISOString();
    plan([{ id: 'all-day', status: 'SCHEDULED', startsAt: midnight, endsAt: nextMidnight }]);

    const { findByLabelText, findByText } = renderScreen();
    await selectTomorrowAtSevenOhSeven(findByLabelText, findByText);
    expect(await findByText('This time overlaps another turn.')).toBeTruthy();

    fireEvent.press(await findByText('Add turn'));
    expect(bookSlotMock).not.toHaveBeenCalled();
  });

  it('disables durations that do not fit after the selected time', async () => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startsAt = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
      7,
      22
    ).toISOString();
    const endsAt = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate(),
      8
    ).toISOString();
    plan([{ id: 'next-turn', status: 'SCHEDULED', startsAt, endsAt }]);

    const { findByLabelText, findByRole, findByText } = renderScreen();
    await selectTomorrowAtSevenOhSeven(findByLabelText, findByText);

    expect(
      (await findByRole('button', { name: '15 mins' })).props.accessibilityState
    ).toMatchObject({
      disabled: false,
    });
    expect(
      (await findByRole('button', { name: '30 mins' })).props.accessibilityState
    ).toMatchObject({
      disabled: true,
    });
    expect(
      (await findByRole('button', { name: '120 mins' })).props.accessibilityState
    ).toMatchObject({
      disabled: true,
    });
  });

  it("uses an edited overnight turn's actual local calendar date", async () => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 10);
    const editRoute = {
      key: 'ChooseSlot-edit',
      name: 'ChooseSlot',
      params: {
        sehajPathId: 'p1',
        slotId: 'slot-1',
        initialStartsAt: tomorrow.toISOString(),
        initialDurationMinutes: 15,
      },
    } as never;
    updateSlotMock.mockResolvedValue({ ok: true, data: {} } as never);

    const { findByText } = render(
      <Provider store={store}>
        <ChooseSlot navigation={navigation} route={editRoute} />
      </Provider>
    );

    expect(
      await findByText(
        tomorrow.toLocaleDateString([], {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      )
    ).toBeTruthy();
  });

  it.each([
    ['Update this turn', 'OCCURRENCE'],
    ['Update this and following turns', 'THIS_AND_FUTURE'],
  ] as const)('sends %s with the selected recurrence scope', async (choice, scope) => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 6, 0);
    const editRoute = {
      key: 'ChooseSlot-recurring-edit',
      name: 'ChooseSlot',
      params: {
        sehajPathId: 'p1',
        slotId: '11111111-1111-5111-8111-111111111111',
        initialStartsAt: tomorrow.toISOString(),
        initialDurationMinutes: 15,
        isRecurring: true,
      },
    } as never;
    updateSlotMock.mockResolvedValue({ ok: true, data: {} } as never);
    const { findByLabelText, findByText } = render(
      <Provider store={store}>
        <ChooseSlot navigation={navigation} route={editRoute} />
      </Provider>
    );

    fireEvent.press(await findByLabelText('Start time picker'));
    fireEvent.press(await findByLabelText('Native time picker'));
    fireEvent.press(await findByText('OK'));
    fireEvent.press(await findByText('Continue'));
    fireEvent.press(await findByText(choice));
    // Choosing only selects; nothing is saved until the sheet's button.
    expect(updateSlotMock).not.toHaveBeenCalled();
    fireEvent.press(await findByLabelText('Confirm update'));

    await waitFor(() => expect(updateSlotMock).toHaveBeenCalledTimes(1));
    expect(updateSlotMock.mock.calls[0][4]).toBe(scope);
  });

  it('starts on the narrower choice, so confirming without picking changes only this turn', async () => {
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 6, 0);
    const editRoute = {
      key: 'ChooseSlot-recurring-default',
      name: 'ChooseSlot',
      params: {
        sehajPathId: 'p1',
        slotId: '11111111-1111-5111-8111-111111111111',
        initialStartsAt: tomorrow.toISOString(),
        initialDurationMinutes: 15,
        isRecurring: true,
      },
    } as never;
    updateSlotMock.mockResolvedValue({ ok: true, data: {} } as never);
    const { findByLabelText, findByText } = render(
      <Provider store={store}>
        <ChooseSlot navigation={navigation} route={editRoute} />
      </Provider>
    );

    fireEvent.press(await findByLabelText('Start time picker'));
    fireEvent.press(await findByLabelText('Native time picker'));
    fireEvent.press(await findByText('OK'));
    fireEvent.press(await findByText('Continue'));
    fireEvent.press(await findByLabelText('Confirm update'));

    await waitFor(() => expect(updateSlotMock).toHaveBeenCalledTimes(1));
    expect(updateSlotMock.mock.calls[0][4]).toBe('OCCURRENCE');
  });

  it('changes a repeat rule for this and following turns only', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const editRoute = {
      key: 'ChooseSlot-recurring-rule-edit',
      name: 'ChooseSlot',
      params: {
        sehajPathId: 'p1',
        slotId: '11111111-1111-5111-8111-111111111111',
        initialStartsAt: tomorrow.toISOString(),
        initialDurationMinutes: 15,
        isRecurring: true,
        initialRecurrenceRule: 'FREQ=DAILY',
      },
    } as never;
    updateSlotMock.mockResolvedValue({ ok: true, data: {} } as never);
    const { findAllByText, findByLabelText, findByText, queryByText } = render(
      <Provider store={store}>
        <ChooseSlot navigation={navigation} route={editRoute} />
      </Provider>
    );

    fireEvent.press(await findByLabelText('Repeat options'));
    fireEvent.press((await findAllByText(/^Every week on /))[0]);
    fireEvent.press(await findByText('Continue'));

    // A new repeat rule has one valid meaning, so that is the only choice,
    // already selected, with the reason shown. Nothing is saved yet.
    expect(await findByText('The new repeat schedule applies from this turn onward.')).toBeTruthy();
    expect(queryByText('Update this turn')).toBeNull();
    expect(updateSlotMock).not.toHaveBeenCalled();
    fireEvent.press(await findByLabelText('Confirm update'));

    await waitFor(() => expect(updateSlotMock).toHaveBeenCalledTimes(1));
    expect(updateSlotMock.mock.calls[0][4]).toBe('THIS_AND_FUTURE');
    expect(updateSlotMock.mock.calls[0][5]).toMatchObject({
      recurrenceRule: expect.stringMatching(/^FREQ=WEEKLY;BYDAY=/),
      recurrenceTimezone: expect.any(String),
    });
  });

  it('updates the timezone for a time-only this-and-following edit', async () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const editRoute = {
      key: 'ChooseSlot-time-only-series',
      name: 'ChooseSlot',
      params: {
        sehajPathId: 'p1',
        slotId: '11111111-1111-5111-8111-111111111111',
        initialStartsAt: tomorrow.toISOString(),
        initialDurationMinutes: 15,
        isRecurring: true,
        initialRecurrenceRule: 'FREQ=DAILY',
      },
    } as never;
    updateSlotMock.mockResolvedValue({ ok: true, data: {} } as never);
    const { findByLabelText, findByText } = render(
      <Provider store={store}>
        <ChooseSlot navigation={navigation} route={editRoute} />
      </Provider>
    );

    fireEvent.press(await findByLabelText('Start time picker'));
    fireEvent.press(await findByLabelText('Native time picker'));
    fireEvent.press(await findByText('OK'));
    fireEvent.press(await findByText('Continue'));
    fireEvent.press(await findByText('Update this and following turns'));
    fireEvent.press(await findByLabelText('Confirm update'));

    await waitFor(() => expect(updateSlotMock).toHaveBeenCalledTimes(1));
    expect(updateSlotMock.mock.calls[0][4]).toBe('THIS_AND_FUTURE');
    expect(updateSlotMock.mock.calls[0][5]).toMatchObject({
      recurrenceRule: 'FREQ=DAILY',
      recurrenceTimezone: expect.any(String),
    });
  });
});
