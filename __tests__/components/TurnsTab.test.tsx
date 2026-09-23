import React from 'react';
import { Provider } from 'react-redux';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { TurnsTab, timelineFrameFor, visibleSlotsForDay } from '../../components/TurnsTab';
import { store } from '../../store';
import { loadPlan } from '../../store/groupApi';
import type { SehajPathSlot } from '../../api/generated/types.gen';

jest.mock('../../store/groupApi', () => ({ loadPlan: jest.fn() }));

const loadPlanMock = loadPlan as jest.MockedFunction<typeof loadPlan>;
const onBookSlot = jest.fn();
const onFollow = jest.fn();

const renderTab = () =>
  render(
    <Provider store={store}>
      <TurnsTab sehajPathId="p1" onBookSlot={onBookSlot} onFollow={onFollow} />
    </Provider>
  );

const at = (hour: number, offsetDays = 0) => {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offsetDays,
    hour
  ).toISOString();
};

const slot = (overrides: Partial<SehajPathSlot> = {}): SehajPathSlot => ({
  id: 'slot-1',
  sehajPathId: 'path-1',
  readerMemberId: 'member-1',
  readerLabel: 'Inder Singh',
  createdByMemberId: 'member-1',
  status: 'SCHEDULED',
  startsAt: at(7),
  endsAt: at(8),
  isMine: false,
  assignedByOther: false,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  loadPlanMock.mockResolvedValue({ ok: true, data: { stateVersion: 1, slots: [] } } as never);
});

describe('TurnsTabs', () => {
  it('places and sizes turns proportionally to their exact time and duration', () => {
    const frame = timelineFrameFor({
      startsAt: new Date(2026, 8, 10, 7, 30).toISOString(),
      endsAt: new Date(2026, 8, 10, 8, 45).toISOString(),
    });

    expect(frame).toEqual({ top: 750, height: 125 });
  });

  it('clips an overnight booking for each calendar day without duplicating it', () => {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const overnight = slot({
      startsAt: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
        23,
        50
      ).toISOString(),
      endsAt: new Date(
        tomorrow.getFullYear(),
        tomorrow.getMonth(),
        tomorrow.getDate(),
        0,
        5
      ).toISOString(),
    });

    const firstDay = visibleSlotsForDay([overnight], today);
    const secondDay = visibleSlotsForDay([overnight], tomorrow);

    expect(firstDay).toHaveLength(1);
    expect(secondDay).toHaveLength(1);
    expect(firstDay[0].id).toBe(overnight.id);
    expect(secondDay[0].id).toBe(overnight.id);
    expect(timelineFrameFor(firstDay[0]).height).toBeCloseTo((10 / 60) * 100);
    expect(timelineFrameFor(secondDay[0]).top).toBe(0);
    expect(timelineFrameFor(secondDay[0]).height).toBeCloseTo((5 / 60) * 100);
  });

  it('renders a booked turn in the selected day timeline', async () => {
    loadPlanMock.mockResolvedValue({
      ok: true,
      data: { stateVersion: 1, slots: [slot()] },
    } as never);
    const { findByText } = renderTab();

    expect(await findByText('Inder Singh')).toBeTruthy();
    expect(await findByText('7:00 AM - 8:00 AM')).toBeTruthy();
  });

  it('shows the empty schedule state without cancelled turns', async () => {
    loadPlanMock.mockResolvedValue({
      ok: true,
      data: { stateVersion: 1, slots: [slot({ status: 'CANCELLED', readerLabel: 'Cancelled' })] },
    } as never);
    const { findByText, queryByText } = renderTab();

    expect(await findByText('No turns yet')).toBeTruthy();
    expect(queryByText('Cancelled')).toBeNull();
  });

  it('opens the booking sheet from Add turn', async () => {
    const { findByText } = renderTab();
    fireEvent.press(await findByText('Add turn'));
    expect(onBookSlot).toHaveBeenCalledTimes(1);
  });

  it('opens the booking sheet when an empty timeline area is tapped', async () => {
    const { findByLabelText } = renderTab();
    fireEvent.press(await findByLabelText('Add turn at this time'));
    expect(onBookSlot).toHaveBeenCalledTimes(1);
  });

  it('reloads the plan when the reader changes week', async () => {
    const { findByLabelText } = renderTab();
    await waitFor(() => expect(loadPlanMock).toHaveBeenCalledTimes(1));
    fireEvent.press(await findByLabelText('Next week'));
    await waitFor(() => expect(loadPlanMock).toHaveBeenCalledTimes(2));
  });

  it('lets a follower open an active reader turn', async () => {
    loadPlanMock.mockResolvedValue({
      ok: true,
      data: { stateVersion: 1, slots: [slot({ status: 'ACTIVE' })] },
    } as never);
    const { findByLabelText } = renderTab();
    fireEvent.press(await findByLabelText('Follow along'));
    expect(onFollow).toHaveBeenCalledTimes(1);
  });
});
