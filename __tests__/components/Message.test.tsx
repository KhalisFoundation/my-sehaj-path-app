import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Animated, StyleSheet, type ViewStyle } from 'react-native';

jest.mock('@icons', () => {
  const ReactForMock = jest.requireActual<typeof React>('react');
  return {
    SaveIcon: () => ReactForMock.createElement('SaveIcon'),
    SyncedCheckIcon: () => ReactForMock.createElement('SyncedCheckIcon'),
  };
});
jest.mock('@components', () => {
  const ReactForMock = jest.requireActual<typeof React>('react');
  return { NavContent: (props: object) => ReactForMock.createElement('NavContent', props) };
});
jest.mock('../../store/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { fontSize: { fontSize: 'Small (Default)', number: 24 } } }),
}));

import { Message } from '../../components/Message';

const render = async (element: React.ReactElement) => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(element);
  });
  return renderer;
};

beforeEach(() => jest.clearAllMocks());

describe('Message', () => {
  it('runs its own fade when the caller does not supply one', async () => {
    // Anywhere but the reader, self-driving means one fewer copy of this
    // animation to keep in step with the others.
    const onHidden = jest.fn();
    const start = jest.spyOn(Animated, 'sequence');

    await render(<Message message="Path deleted" onHidden={onHidden} />);

    expect(start).toHaveBeenCalled();
  });

  it('leaves the timing alone when the caller drives it', async () => {
    // The reader's value also tracks save state, so the toast must not animate
    // it out from under the screen that owns it.
    const sequence = jest.spyOn(Animated, 'sequence');
    const caller = new Animated.Value(1);

    await render(<Message message="Saved" fadeAnim={caller} />);

    expect(sequence).not.toHaveBeenCalled();
  });

  it('reports back once it has faded, so the host can drop the message', async () => {
    const onHidden = jest.fn();
    const renderer = await render(<Message message="Path deleted" onHidden={onHidden} />);

    // Drive the animation to completion rather than waiting on real timers.
    await act(async () => {
      jest.advanceTimersByTime?.(5000);
    });

    // The callback is held in a ref, so re-rendering must not restart the fade.
    await act(async () => {
      renderer.update(<Message message="Path deleted" onHidden={() => undefined} />);
    });
    expect(onHidden.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("lets the host place it without disturbing the reader's default", async () => {
    // The shared style pins it to the bottom edge, which is right in the reader
    // and wrong on a screen whose content stops higher up.
    const styleOf = (renderer: ReactTestRenderer.ReactTestRenderer) =>
      StyleSheet.flatten(renderer.root.findByType(Animated.View).props.style) as ViewStyle;

    const placed = await render(<Message message="Path deleted" style={{ bottom: 36 }} />);
    expect(styleOf(placed).bottom).toBe(36);

    const defaulted = await render(<Message message="Saved" />);
    expect(styleOf(defaulted).bottom).toBe(2);
  });

  it('grows with its text instead of pinning a height', async () => {
    // The bug: a fixed 48pt pill left exactly 28pt of usable space after
    // padding, which is what a 22pt line needs at the largest font setting —
    // nothing spare for a descender or a wrapped second line. The text sat
    // off-centre and clipped, worst on iOS.
    const renderer = await render(<Message message="Path deleted" />);
    const style = StyleSheet.flatten(
      renderer.root.findByType(Animated.View).props.style
    ) as ViewStyle;

    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBe(48);
  });

  it('shows the icon it is given, falling back to the save icon', async () => {
    // Read off the prop rather than the tree: NavContent renders `navIcon`
    // itself, and it is stubbed here.
    const iconOf = (renderer: ReactTestRenderer.ReactTestRenderer) =>
      renderer.root.findByType('NavContent' as never).props.navIcon;

    const custom = <Animated.View />;
    const withIcon = await render(<Message message="Path deleted" icon={custom} />);
    expect(iconOf(withIcon)).toBe(custom);

    const withoutIcon = await render(<Message message="Saved" />);
    expect(iconOf(withoutIcon).type.name).toBe('SaveIcon');
  });
});
