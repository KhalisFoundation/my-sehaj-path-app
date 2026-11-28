import type { SehajPathMember, SehajPathSession } from '@api/generated/types.gen';
import { takeRecurringTurn } from '../../store/takeTurn';
import { currentSession, listMembers, startReading, takeoverReading } from '../../store/groupApi';

jest.mock('../../store/groupApi', () => ({
  currentSession: jest.fn(),
  listMembers: jest.fn(),
  startReading: jest.fn(),
  takeoverReading: jest.fn(),
  reportUnexpectedGroupRefusal: jest.fn(),
}));

const currentSessionMock = currentSession as jest.MockedFunction<typeof currentSession>;
const listMembersMock = listMembers as jest.MockedFunction<typeof listMembers>;
const startReadingMock = startReading as jest.MockedFunction<typeof startReading>;
const takeoverMock = takeoverReading as jest.MockedFunction<typeof takeoverReading>;

const PATH = 'path-1';
const OCCURRENCE = 'occurrence-1';

const me = { id: 'member-me', isMine: true } as SehajPathMember;
const someoneElse = { id: 'member-other', isMine: false } as SehajPathMember;

const session = (overrides: Partial<SehajPathSession> = {}) =>
  ({
    id: 'session-1',
    status: 'LIVE',
    readerMemberId: me.id,
    startAng: 10,
    startedAt: '2030-01-01T10:00:00.000Z',
    slotEndsAt: null,
    ...overrides,
  } as SehajPathSession);

const live = (overrides: Partial<SehajPathSession> = {}) =>
  currentSessionMock.mockResolvedValue({ ok: true, data: session(overrides) } as never);

const refused = (status: number, message = 'No.') =>
  ({ ok: false, kind: 'refused', status, message } as never);

beforeEach(() => {
  jest.clearAllMocks();
  listMembersMock.mockResolvedValue({ ok: true, data: [me, someoneElse] } as never);
});

describe('taking a recurring turn from the calendar', () => {
  it('starts the turn when the server says nobody is reading (404)', async () => {
    currentSessionMock.mockResolvedValue(refused(404));
    startReadingMock.mockResolvedValue({ ok: true, data: session({ id: 'new' }) } as never);

    const result = await takeRecurringTurn(PATH, OCCURRENCE, [me]);

    expect(startReadingMock).toHaveBeenCalledWith(PATH, OCCURRENCE);
    expect(result).toMatchObject({ outcome: 'READING_START', session: { id: 'new' } });
  });

  it('treats a 409 from the lookup the same way', async () => {
    currentSessionMock.mockResolvedValue(refused(409));
    startReadingMock.mockResolvedValue({ ok: true, data: session({ id: 'new' }) } as never);

    await expect(takeRecurringTurn(PATH, OCCURRENCE, [me])).resolves.toMatchObject({
      outcome: 'READING_START',
    });
  });

  it('stops, without starting anything, when the lookup got no answer at all', async () => {
    currentSessionMock.mockResolvedValue({
      ok: false,
      kind: 'unreachable',
      message: 'Check your connection.',
    } as never);

    await expect(takeRecurringTurn(PATH, OCCURRENCE, [me])).rejects.toThrow(
      'Check your connection.'
    );
    expect(startReadingMock).not.toHaveBeenCalled();
    expect(takeoverMock).not.toHaveBeenCalled();
  });

  it('shows the server’s reason when starting the turn is refused', async () => {
    currentSessionMock.mockResolvedValue(refused(404));
    startReadingMock.mockResolvedValue(refused(409, 'That turn was taken.'));

    await expect(takeRecurringTurn(PATH, OCCURRENCE, [me])).rejects.toThrow('That turn was taken.');
  });

  it('records the turn on a reading the caller already has, and records no outcome', async () => {
    live({ readerMemberId: me.id });
    takeoverMock.mockResolvedValue({
      ok: true,
      data: session({ id: 'same', recurrenceTemplateId: 'template-1' }),
    } as never);

    const result = await takeRecurringTurn(PATH, OCCURRENCE, [me]);

    expect(takeoverMock).toHaveBeenCalledWith(PATH, OCCURRENCE);
    expect(result).toMatchObject({ outcome: null, session: { id: 'same' } });
  });

  it('lets a reader carry on in their own reading when recording the turn is refused', async () => {
    live({ id: 'mine-live', readerMemberId: me.id });
    takeoverMock.mockResolvedValue(refused(409, 'You are already reading a different turn.'));

    const result = await takeRecurringTurn(PATH, OCCURRENCE, [me]);

    // No error over their own live page: they resume the reading they have.
    expect(result).toMatchObject({ outcome: 'READING_RESUME', session: { id: 'mine-live' } });
  });

  it('also carries on when the connection dips while recording the turn', async () => {
    live({ id: 'mine-live', readerMemberId: me.id });
    takeoverMock.mockResolvedValue({
      ok: false,
      kind: 'unreachable',
      message: 'Offline.',
    } as never);

    await expect(takeRecurringTurn(PATH, OCCURRENCE, [me])).resolves.toMatchObject({
      outcome: 'READING_RESUME',
    });
  });

  it('hands the reading over when somebody else is reading', async () => {
    live({ readerMemberId: someoneElse.id });
    takeoverMock.mockResolvedValue({ ok: true, data: session({ id: 'handed' }) } as never);

    await expect(takeRecurringTurn(PATH, OCCURRENCE, [me])).resolves.toMatchObject({
      outcome: 'TAKEOVER',
      session: { id: 'handed' },
    });
  });

  it('says why when taking over somebody else’s reading is refused', async () => {
    live({ readerMemberId: someoneElse.id });
    takeoverMock.mockResolvedValue(refused(409, 'The booked time expired or was cancelled.'));

    await expect(takeRecurringTurn(PATH, OCCURRENCE, [me])).rejects.toThrow(
      'The booked time expired or was cancelled.'
    );
  });

  it('loads the members itself when the screen has not got them yet', async () => {
    live({ readerMemberId: me.id });
    takeoverMock.mockResolvedValue({ ok: true, data: session() } as never);

    const result = await takeRecurringTurn(PATH, OCCURRENCE, []);

    expect(listMembersMock).toHaveBeenCalledWith(PATH);
    // Recognised as their own reading, so no hand-over is recorded.
    expect(result.outcome).toBeNull();
  });
});
