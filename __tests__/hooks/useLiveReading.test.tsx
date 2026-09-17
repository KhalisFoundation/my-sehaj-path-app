import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useLiveReading, type LiveReadingRole } from '../../hooks/useLiveReading';
import type { LivePosition } from '../../store/liveSession';
import { connectLive } from '../../store/liveSession';

jest.mock('../../store/liveSession', () => ({ connectLive: jest.fn() }));

const connectLiveMock = connectLive as jest.MockedFunction<typeof connectLive>;

let handle: { close: jest.Mock; sendPosition: jest.Mock; sendSettings: jest.Mock };
let listeners: Parameters<typeof connectLive>[0];

const Probe = ({
  live,
  pathAng,
  centerVerseId,
  offset,
  onRemotePosition,
  onSettings,
  settings,
}: {
  live: LiveReadingRole | undefined;
  pathAng: number;
  centerVerseId: number;
  offset: number;
  onRemotePosition: (position: LivePosition) => void;
  onSettings?: (s: { larivaar?: boolean; fontSizeIndex?: number }) => void;
  settings?: {
    larivaar: boolean;
    paragraphMode: boolean;
    vishraam: boolean;
    fontSizeIndex: number;
  };
}) => {
  const scrollOffset = React.useRef(offset);
  scrollOffset.current = offset;
  useLiveReading({
    live,
    pathAng,
    centerVerseId,
    scrollOffset,
    onRemotePosition,
    onSettings,
    settings,
  });
  return null;
};

type ProbeProps = React.ComponentProps<typeof Probe>;

const mount = async (props: ProbeProps) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<Probe {...props} />);
  });
  return tree;
};

const baseProps = (
  live: LiveReadingRole | undefined,
  extra: Partial<ProbeProps> = {}
): ProbeProps => ({
  live,
  pathAng: 5,
  centerVerseId: 50,
  offset: 120,
  onRemotePosition: jest.fn(),
  ...extra,
});

beforeEach(() => {
  jest.clearAllMocks();
  handle = { close: jest.fn(), sendPosition: jest.fn(), sendSettings: jest.fn() };
  connectLiveMock.mockImplementation((options) => {
    listeners = options;
    return Promise.resolve(handle as never);
  });
});

describe('useLiveReading', () => {
  it('opens no socket for a personal path', async () => {
    await mount(baseProps(undefined));
    expect(connectLiveMock).not.toHaveBeenCalled();
  });

  it('reports the reader’s position while driving', async () => {
    await mount(baseProps({ sehajPathId: 'p1', driving: true }));

    expect(handle.sendPosition).toHaveBeenCalledWith({
      currentAng: 5,
      currentVerseId: 50,
      scrollPosition: 120,
    });
  });

  it('rounds the scroll offset, because the column is an Int', async () => {
    // A fractional offset failed the server's write outright, which cost the
    // reader their grace period on a drop.
    await mount(baseProps({ sehajPathId: 'p1', driving: true }, { offset: 120.7 }));

    expect(handle.sendPosition).toHaveBeenCalledWith(
      expect.objectContaining({ scrollPosition: 121 })
    );
  });

  it('never reports a negative offset from an overscroll bounce', async () => {
    await mount(baseProps({ sehajPathId: 'p1', driving: true }, { offset: -40 }));

    expect(handle.sendPosition).toHaveBeenCalledWith(
      expect.objectContaining({ scrollPosition: 0 })
    );
  });

  it('reports again when the reader moves', async () => {
    const tree = await mount(baseProps({ sehajPathId: 'p1', driving: true }));
    handle.sendPosition.mockClear();

    await act(async () => {
      tree.update(<Probe {...baseProps({ sehajPathId: 'p1', driving: true }, { pathAng: 6 })} />);
    });

    expect(handle.sendPosition).toHaveBeenCalledWith(expect.objectContaining({ currentAng: 6 }));
  });

  it('sends nothing while following', async () => {
    await mount(baseProps({ sehajPathId: 'p1', driving: false }));

    // Exactly one device drives. A follower reporting would move the group.
    expect(handle.sendPosition).not.toHaveBeenCalled();
  });

  it('applies the reader’s position while following', async () => {
    const onRemotePosition = jest.fn();
    await mount(baseProps({ sehajPathId: 'p1', driving: false }, { onRemotePosition }));

    await act(async () => {
      listeners.onPosition({
        currentAng: 9,
        currentVerseId: 90,
        scrollPosition: 0,
        sequence: 3,
      });
    });

    expect(onRemotePosition).toHaveBeenCalledWith(expect.objectContaining({ currentAng: 9 }));
  });

  it('does not apply anything to the reader’s own screen', async () => {
    const onRemotePosition = jest.fn();
    await mount(baseProps({ sehajPathId: 'p1', driving: true }, { onRemotePosition }));

    await act(async () => {
      listeners.onPosition({
        currentAng: 9,
        currentVerseId: 90,
        scrollPosition: 0,
        sequence: 3,
      });
    });

    // The reader IS the position; applying an echo would fight their scrolling.
    expect(onRemotePosition).not.toHaveBeenCalled();
  });

  it('starts a follower at the snapshot it joined on', async () => {
    const onRemotePosition = jest.fn();
    await mount(baseProps({ sehajPathId: 'p1', driving: false }, { onRemotePosition }));

    await act(async () => {
      listeners.onJoined({
        sessionId: 's1',
        readerLabel: 'Harpreet',
        currentAng: 42,
        currentVerseId: 420,
        scrollPosition: 0,
        sequence: 1,
      });
    });

    expect(onRemotePosition).toHaveBeenCalledWith(expect.objectContaining({ currentAng: 42 }));
  });

  it('does not reconnect when the callback changes on every page', async () => {
    const tree = await mount(baseProps({ sehajPathId: 'p1', driving: false }));
    expect(connectLiveMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      // A fresh closure, as `onRemotePosition` is on each render.
      tree.update(
        <Probe
          {...baseProps(
            { sehajPathId: 'p1', driving: false },
            {
              onRemotePosition: jest.fn(),
              pathAng: 6,
            }
          )}
        />
      );
    });

    // Reconnecting per page would drop the group's position and re-handshake
    // several times a minute.
    expect(connectLiveMock).toHaveBeenCalledTimes(1);
    expect(handle.close).not.toHaveBeenCalled();
  });

  it('closes the socket when the screen goes away', async () => {
    const tree = await mount(baseProps({ sehajPathId: 'p1', driving: false }));
    await act(async () => {
      tree.unmount();
    });
    expect(handle.close).toHaveBeenCalled();
  });
});

describe('sharing how the text is laid out', () => {
  const layout = { larivaar: true, paragraphMode: false, vishraam: true, fontSizeIndex: 3 };

  it('sends the reader’s layout once the socket is open', async () => {
    await mount(baseProps({ sehajPathId: 'p1', driving: true }, { settings: layout }));
    expect(handle.sendSettings).toHaveBeenCalledWith(layout);
  });

  it('sends nothing while following — the reader is the source', async () => {
    await mount(baseProps({ sehajPathId: 'p1', driving: false }, { settings: layout }));
    expect(handle.sendSettings).not.toHaveBeenCalled();
  });

  it('gives a follower the reader’s layout', async () => {
    const onSettings = jest.fn();
    await mount(baseProps({ sehajPathId: 'p1', driving: false }, { onSettings }));

    await act(async () => {
      listeners.onSettings?.({ larivaar: true });
    });
    expect(onSettings).toHaveBeenCalledWith({ larivaar: true });
  });

  it('does not apply an echo to the reader’s own screen', async () => {
    const onSettings = jest.fn();
    await mount(baseProps({ sehajPathId: 'p1', driving: true }, { onSettings }));

    await act(async () => {
      listeners.onSettings?.({ larivaar: true });
    });
    // The reader owns these; applying an echo would fight their own controls.
    expect(onSettings).not.toHaveBeenCalled();
  });
});
