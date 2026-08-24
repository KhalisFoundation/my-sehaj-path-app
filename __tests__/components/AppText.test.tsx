import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { StyleSheet, Text as RNText, TextInput as RNTextInput, type TextStyle } from 'react-native';
import { FontSizes, FontScale, DEFAULT_FONT_SIZE_INDEX } from '@constants/FontSize';

let mockFontSize: { fontSize: string; number: number } = FontSizes[1];

jest.mock('../../store/hooks', () => ({
  useAppSelector: (selector: (s: unknown) => unknown) =>
    selector({ settings: { fontSize: mockFontSize } }),
}));

import { AppText, AppTextInput } from '../../components/AppText';

const styles = StyleSheet.create({
  title: { fontSize: 20 },
  caption: { fontSize: 11 },
  noSize: { color: 'red' },
});

const renderText = async (props: React.ComponentProps<typeof AppText>) => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = ReactTestRenderer.create(<AppText {...props} />);
  });
  return renderer.root.findByType(RNText);
};

const sizeOf = (node: ReactTestRenderer.ReactTestInstance) =>
  (StyleSheet.flatten(node.props.style) as { fontSize?: number }).fontSize;

beforeEach(() => {
  mockFontSize = FontSizes[1]; // Small (Default)
});

describe('AppText', () => {
  it('renders a style at its own size on the default setting', () => {
    // 20pt is a title; the table's title at the default step is 20.
    expect(FontScale.title[DEFAULT_FONT_SIZE_INDEX]).toBe(20);
  });

  it('places a style in the table from the size it declares', async () => {
    mockFontSize = FontSizes[3]; // Large
    const title = sizeOf(await renderText({ style: styles.title, children: 'x' }));
    const caption = sizeOf(await renderText({ style: styles.caption, children: 'x' }));

    expect(title).toBe(FontScale.title[3]);
    expect(caption).toBe(FontScale.caption[3]);
    // A title stays bigger than a caption at every setting.
    expect(title).toBeGreaterThan(caption!);
  });

  it('shrinks below the default too', async () => {
    mockFontSize = FontSizes[0];
    expect(sizeOf(await renderText({ style: styles.title, children: 'x' }))).toBe(
      FontScale.title[0]
    );
  });

  it('honours an explicit variant over the row its size would imply', async () => {
    // 11pt would be a caption, which barely grows. Asked for the reader row it
    // travels that row's curve instead — starting, as always, from the size the
    // style declares.
    mockFontSize = FontSizes[4];
    const node = await renderText({ style: styles.caption, variant: 'reader', children: 'x' });

    const growth = FontScale.reader[4] / FontScale.reader[DEFAULT_FONT_SIZE_INDEX];
    expect(sizeOf(node)).toBe(Math.round(11 * growth));
    expect(sizeOf(node)).toBeGreaterThan(FontScale.caption[4]);
  });

  it('takes the row outright when there is no declared size to carry', async () => {
    // Nothing to scale from, so the row's own number is the only answer.
    mockFontSize = FontSizes[4];
    const node = await renderText({ style: styles.noSize, variant: 'reader', children: 'x' });
    expect(sizeOf(node)).toBe(FontScale.reader[4]);
  });

  it('carries a declared line height across with the size', async () => {
    // A style pinning both chose its leading for the size it was written
    // against. Keeping the number while the size grows is what made the path
    // card look cramped, and at the top of the scale clips descenders.
    const paired = StyleSheet.create({ p: { fontSize: 18, lineHeight: 28 } });
    mockFontSize = FontSizes[4];

    const node = await renderText({ style: paired.p, children: 'x' });
    const flat = StyleSheet.flatten(node.props.style) as TextStyle;

    expect(flat.fontSize).toBe(Math.round(18 * (FontScale.body[4] / FontScale.body[1])));
    // The ratio survives, so the line box still clears the glyphs.
    expect(flat.lineHeight! / flat.fontSize!).toBeCloseTo(28 / 18, 1);
  });

  it('leaves a line height alone when it has no size to scale against', async () => {
    // Nothing to take a ratio from, and inventing one would change spacing the
    // style set deliberately.
    const orphan = StyleSheet.create({ o: { lineHeight: 30 } });
    const node = await renderText({ style: orphan.o, variant: 'body', children: 'x' });
    expect((StyleSheet.flatten(node.props.style) as TextStyle).lineHeight).toBe(30);
  });

  it('leaves text that declares no size to React Native', async () => {
    expect(sizeOf(await renderText({ style: styles.noSize, children: 'x' }))).toBeUndefined();
  });

  it('leaves a size far outside the table alone', async () => {
    // A splash-screen numeral is not body text that grew; forcing it into a row
    // would change text nobody asked us to touch.
    mockFontSize = FontSizes[4];
    const huge = StyleSheet.create({ h: { fontSize: 72 } });
    expect(sizeOf(await renderText({ style: huge.h, children: 'x' }))).toBe(72);
  });

  it('ignores the device font setting so the two cannot multiply', async () => {
    const node = await renderText({ style: styles.title, children: 'x' });
    expect(node.props.allowFontScaling).toBe(false);
  });

  it('still lets a caller opt back into device scaling', async () => {
    const node = await renderText({ style: styles.title, allowFontScaling: true, children: 'x' });
    expect(node.props.allowFontScaling).toBe(true);
  });

  it('sizes a text input from the same table, placeholder included', async () => {
    // A TextInput inherits nothing from AppText, so the ang-number and rename
    // fields were the last text in the app pinned to one size while everything
    // around them moved with the setting.
    const field = StyleSheet.create({ f: { fontSize: 20 } });
    mockFontSize = FontSizes[4];

    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <AppTextInput style={field.f} placeholder="Enter Ang Number" />
      );
    });

    const input = renderer.root.findByType(RNTextInput);
    const flat = StyleSheet.flatten(input.props.style) as TextStyle;
    expect(flat.fontSize).toBe(FontScale.title[4]);
    // Drawn by the input itself, so it rides on the same style.
    expect(input.props.placeholder).toBe('Enter Ang Number');
    expect(input.props.allowFontScaling).toBe(false);
  });
});
