import React from 'react';
import { Provider } from 'react-redux';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ChooseSlot } from '../../screens/ChooseSlot';
import { store } from '../../store';
import { bookSlot, loadPlan, updateSlot } from '../../store/groupApi';

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
  jest.clearAllMocks();
  plan();
});

describe('ChooseSlot', () => {
  it('uses the full design duration range', async () => {
    const { findByText } = renderScreen();
    expect(await findByText('15 mins')).toBeTruthy();
    expect(await findByText('120 mins')).toBeTruthy();
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
});
