import React from 'react';
import { Provider } from 'react-redux';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import {
  clearTurnPlanCache,
  TurnsTab,
  timelineFrameFor,
  visibleSlotsForDay,
} from '../../components/TurnsTab';
import { store } from '../../store';
import { loadPlan } from '../../store/groupApi';
import type { SehajPathSlot } from '../../api/generated/types.gen';
import { formatTime } from '../../utils/dateTime';
import { pinClock, unpinClock } from '../fixtures/pinClock';

jest.mock('../../store/groupApi', () => ({ loadPlan: jest.fn() }));

const loadPlanMock = loadPlan as jest.MockedFunction<typeof loadPlan>;
const onBookSlot = jest.fn();
const onFollow = jest.fn();
const onTakeTurn = jest.fn();

const renderTab = (props: Partial<React.ComponentProps<typeof TurnsTab>> = {}) =>
  render(
    <Provider store={store}>
      <TurnsTab sehajPathId="p1" onBookSlot={onBookSlot} onFollow={onFollow} {...props} />
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
  pinClock();
  jest.clearAllMocks();
  clearTurnPlanCache();
  onTakeTurn.mockResolvedValue(undefined);
  loadPlanMock.mockResolvedValue({ ok: true, data: { stateVersion: 1, slots: [] } } as never);
});

afterEach(() => {
  unpinClock();
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
    // Built with the app's own formatter: the label follows the device locale
    // ("7:00 AM" in en-US, "7:00 am" in en-IN), so a literal would only pass
    // on some machines.
    expect(await findByText(`${formatTime(at(7))} - ${formatTime(at(8))}`)).toBeTruthy();
  });

  it('shows the cached plan immediately while refreshing the same version', async () => {
    const cachedSlot = slot();
    loadPlanMock.mockResolvedValueOnce({
      ok: true,
      data: { stateVersion: 7, slots: [cachedSlot] },
    } as never);
    const first = renderTab();
    expect(await first.findByText('Inder Singh')).toBeTruthy();
    first.unmount();

    let finishRefresh: ((value: Awaited<ReturnType<typeof loadPlan>>) => void) | undefined;
    loadPlanMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve;
        }) as never
    );
    const reopened = renderTab();

    expect(reopened.getByText('Inder Singh')).toBeTruthy();
    expect(loadPlanMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      finishRefresh?.({ ok: true, data: { stateVersion: 7, slots: [cachedSlot] } });
    });
    expect(reopened.getByText('Inder Singh')).toBeTruthy();
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

  it('offers Take your turn for an active recurring turn', async () => {
    const now = new Date();
    loadPlanMock.mockResolvedValue({
      ok: true,
      data: {
        stateVersion: 1,
        slots: [
          slot({
            readerMemberId: null,
            readerLabel: 'Open',
            isVirtual: true,
            isRecurring: true,
            startsAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
            endsAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
          }),
        ],
      },
    } as never);
    const onPlanChanged = jest.fn();
    const { findAllByLabelText, findByText } = renderTab({ onTakeTurn, onPlanChanged });

    const takeTurnButtons = await findAllByLabelText('Take your turn');
    const plansLoadedBefore = loadPlanMock.mock.calls.length;
    fireEvent.press(takeTurnButtons[0]);
    fireEvent.press(await findByText('Take your turn'));

    await waitFor(() => expect(onTakeTurn).toHaveBeenCalledTimes(1));
    // Taken, so the calendar must stop offering it: the plan is reloaded and
    // the parent told, instead of leaving the stale entry until some other
    // refresh happens.
    await waitFor(() => expect(loadPlanMock.mock.calls.length).toBeGreaterThan(plansLoadedBefore));
    expect(onPlanChanged).toHaveBeenCalledTimes(1);
    expect(onTakeTurn).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'slot-1', isVirtual: true })
    );
  });

  it('deletes this and following recurring turns through the existing endpoint', async () => {
    const onCancelSlot = jest.fn().mockResolvedValue(undefined);
    const startsAt = new Date(Date.now() + 30 * 60_000);
    const endsAt = new Date(Date.now() + 60 * 60_000);
    const recurringSlot = slot({
      isMine: true,
      isVirtual: true,
      isRecurring: true,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
    loadPlanMock.mockResolvedValue({
      ok: true,
      data: { stateVersion: 1, slots: [recurringSlot] },
    } as never);
    const { findByText } = renderTab({ onCancelSlot });

    fireEvent(await findByText(`${formatTime(startsAt)} - ${formatTime(endsAt)}`), 'longPress');
    fireEvent.press(await findByText('Delete turn'));
    fireEvent.press(await findByText('Delete this and following turns'));

    await waitFor(() =>
      expect(onCancelSlot).toHaveBeenCalledWith(recurringSlot, 'THIS_AND_FUTURE')
    );
  });

  it('does not carry a recurring delete choice over to the next, ordinary delete', async () => {
    const onCancelSlot = jest.fn().mockResolvedValue(undefined);
    const minutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000);
    const recurringStart = minutesFromNow(30);
    const recurringEnd = minutesFromNow(60);
    const ordinaryStart = minutesFromNow(90);
    const ordinaryEnd = minutesFromNow(120);
    const recurringSlot = slot({
      id: 'recurring-1',
      isMine: true,
      isVirtual: true,
      isRecurring: true,
      startsAt: recurringStart.toISOString(),
      endsAt: recurringEnd.toISOString(),
    });
    const ordinarySlot = slot({
      id: 'ordinary-1',
      isMine: true,
      startsAt: ordinaryStart.toISOString(),
      endsAt: ordinaryEnd.toISOString(),
    });
    loadPlanMock.mockResolvedValue({
      ok: true,
      data: { stateVersion: 1, slots: [recurringSlot, ordinarySlot] },
    } as never);
    const { findByText, findByLabelText } = renderTab({ onCancelSlot });

    // First: remove a recurring turn and every one after it.
    fireEvent(
      await findByText(`${formatTime(recurringStart)} - ${formatTime(recurringEnd)}`),
      'longPress'
    );
    fireEvent.press(await findByText('Delete turn'));
    fireEvent.press(await findByText('Delete this and following turns'));
    await waitFor(() => expect(onCancelSlot).toHaveBeenCalledTimes(1));

    // Then: an ordinary one-time turn. It must not inherit that choice.
    fireEvent(
      await findByText(`${formatTime(ordinaryStart)} - ${formatTime(ordinaryEnd)}`),
      'longPress'
    );
    fireEvent.press(await findByText('Delete turn'));
    fireEvent.press(await findByLabelText('Delete turn'));
    await waitFor(() => expect(onCancelSlot).toHaveBeenCalledTimes(2));

    expect(onCancelSlot.mock.calls[0]).toEqual([recurringSlot, 'THIS_AND_FUTURE']);
    expect(onCancelSlot.mock.calls[1][0]).toEqual(ordinarySlot);
    expect(onCancelSlot.mock.calls[1][1]).toBeUndefined();
  });

  it('offers the series choice when deleting any turn that belongs to a series', async () => {
    // Marked as part of a series but not a projected turn: edit already treats
    // it as recurring, so delete must too.
    const onCancelSlot = jest.fn().mockResolvedValue(undefined);
    const startsAt = new Date(Date.now() + 30 * 60_000);
    const endsAt = new Date(Date.now() + 60 * 60_000);
    const seriesSlot = slot({
      isMine: true,
      isRecurring: true,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    });
    loadPlanMock.mockResolvedValue({
      ok: true,
      data: { stateVersion: 1, slots: [seriesSlot] },
    } as never);
    const { findByText } = renderTab({ onCancelSlot });

    fireEvent(await findByText(`${formatTime(startsAt)} - ${formatTime(endsAt)}`), 'longPress');
    fireEvent.press(await findByText('Delete turn'));

    expect(await findByText('Delete this and following turns')).toBeTruthy();
    expect(onCancelSlot).not.toHaveBeenCalled();
  });
});
