import React from 'react';
import { Provider } from 'react-redux';
import { render, fireEvent } from '@testing-library/react-native';
import { FinishReadingSheet } from '../../components/FinishReadingSheet';
import { store } from '../../store';

const onConfirm = jest.fn();
const onCancel = jest.fn();

const renderSheet = (props: Record<string, unknown> = {}) =>
  render(
    <Provider store={store}>
      <FinishReadingSheet
        visible
        startAng={745}
        currentAng={752}
        onConfirm={onConfirm}
        onCancel={onCancel}
        {...props}
      />
    </Provider>
  );

beforeEach(() => jest.clearAllMocks());

describe('the finish reading sheet', () => {
  it('reports where the turn began and where it reached', () => {
    const { getByText } = renderSheet();
    expect(getByText('745')).toBeTruthy();
    expect(getByText('752')).toBeTruthy();
  });

  it('counts the angs read', () => {
    const { getByText } = renderSheet();
    expect(getByText('7')).toBeTruthy();
    expect(getByText('Angs')).toBeTruthy();
  });

  it('uses the singular for one ang', () => {
    const { getByText } = renderSheet({ startAng: 745, currentAng: 746 });
    expect(getByText('Ang')).toBeTruthy();
  });

  it('never shows a negative count', () => {
    // The group can move the path on while a reader sits still, so "current"
    // can legitimately be behind where this turn began.
    const { getByText } = renderSheet({ startAng: 752, currentAng: 745 });
    expect(getByText('0')).toBeTruthy();
  });

  it('reports how long the turn ran', () => {
    const startedAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { getByText } = renderSheet({ startedAt });
    expect(getByText('in 30 min')).toBeTruthy();
  });

  it('never reports zero minutes', () => {
    // Nobody reads for zero minutes, and it makes the summary look broken.
    const startedAt = new Date(Date.now() - 20 * 1000).toISOString();
    const { getByText } = renderSheet({ startedAt });
    expect(getByText('in 1 min')).toBeTruthy();
  });

  it('reports a long turn in hours', () => {
    const startedAt = new Date(Date.now() - 95 * 60 * 1000).toISOString();
    const { getByText } = renderSheet({ startedAt });
    expect(getByText('in 1 hr 35 min')).toBeTruthy();
  });

  it('omits the duration when the start time is unknown', () => {
    const { queryByText } = renderSheet({ startedAt: null });
    expect(queryByText(/^in /)).toBeNull();
  });

  it('finishes only when asked', () => {
    const { getByText } = renderSheet();
    fireEvent.press(getByText('Finish & Log'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('lets the reader carry on instead', () => {
    // Ending a turn releases the reading to the group, so backing out of a page
    // by accident must not do it.
    const { getByText } = renderSheet();
    fireEvent.press(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('cannot be confirmed twice while it is working', () => {
    const { getByText } = renderSheet({ busy: true });
    fireEvent.press(getByText('Finish your reading?'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('the same sheet, seen by somebody who was watching', () => {
  const watching = { finishedBy: 'ssingh', startAng: 745, currentAng: 752 };

  it('announces rather than asks — the turn is already over', () => {
    const { getByText, queryByText } = renderSheet(watching);
    expect(getByText('ssingh has finished reading')).toBeTruthy();
    expect(queryByText('Finish your reading?')).toBeNull();
  });

  it('reports the reading in the third person', () => {
    const { getByText, queryByText } = renderSheet(watching);
    expect(getByText('They read')).toBeTruthy();
    expect(queryByText('You read')).toBeNull();
  });

  it('still says how far the reading got', () => {
    const { getByText } = renderSheet(watching);
    expect(getByText('745')).toBeTruthy();
    expect(getByText('752')).toBeTruthy();
    expect(getByText('7')).toBeTruthy();
  });

  it('shows them out instead of asking anything', () => {
    // A follower has nothing to decline: the turn ended without them, and the
    // page they were watching is nobody's now.
    const { getByText, queryByText } = renderSheet(watching);
    expect(getByText('OK')).toBeTruthy();
    expect(queryByText('Cancel')).toBeNull();
    expect(queryByText('Finish & Log')).toBeNull();
  });
});
