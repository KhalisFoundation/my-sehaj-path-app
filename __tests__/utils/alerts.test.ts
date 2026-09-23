import { Alert } from 'react-native';
import { showSaveProgressAlert } from '../../utils/alerts';

const show = (destinationLabel?: string) => {
  showSaveProgressAlert({
    onSaveAndGoBack: jest.fn(),
    onGoBackWithoutSaving: jest.fn(),
    destinationLabel,
  });
  const [, message, buttons] = (Alert.alert as jest.Mock).mock.calls.at(-1)!;
  return { message: message as string, texts: (buttons as { text: string }[]).map((b) => b.text) };
};

beforeEach(() => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.clearAllMocks();
});

describe('leaving the reader with an unsaved ang', () => {
  it('talks about going to a screen, not opening one', () => {
    // "Open Home" reads wrong — a screen is somewhere you go, not something you
    // open — and it got worse the further the destination was from a document.
    for (const destination of ['Home', 'Settings', 'Progress', 'Streaks']) {
      const { message, texts } = show(destination);
      expect(message).toContain(`going to ${destination}`);
      expect(texts).toContain(`Save & Go to ${destination}`);
      expect(texts).toContain(`Go to ${destination} Without Saving`);
      expect(texts.join(' ')).not.toContain('Open');
    }
  });

  it('offers save, leave, and cancel — in that order', () => {
    // Leaving is destructive and must never be the first thing a thumb finds.
    const { texts } = show('Home');
    expect(texts).toEqual(['Save & Go to Home', 'Go to Home Without Saving', 'Cancel']);
  });

  it('defaults to Home when no destination is named', () => {
    expect(show().texts[0]).toBe('Save & Go to Home');
  });
});
