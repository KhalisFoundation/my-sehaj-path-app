import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { SelectionSheetSettingItem } from '../../components/Settings/SelectionSheetSettingItem';
import { SwitchSettingItem } from '../../components/Settings/SwitchSettingItem';
import { AppText } from '../../components/AppText';

// The selection sheet's options now render through `AppText`, which reads the font
// setting from the store — the whole point of the change being tested elsewhere.
jest.mock('../../store/hooks', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ settings: { fontSize: { fontSize: 'Small (Default)', number: 24 } } }),
}));

const mockTrackEvent = jest.fn();
const mockRecordError = jest.fn();

jest.mock('../../utils', () => ({
  recordError: (...args: unknown[]) => mockRecordError(...args),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock('../../components', () => {
  const ReactForMock = jest.requireActual<typeof React>('react');
  return {
    NavContent: (props: object) => ReactForMock.createElement('NavContent', props),
    SimpleText: (props: object) => ReactForMock.createElement('SimpleText', props),
  };
});

jest.mock('../../icons', () => {
  const ReactForMock = jest.requireActual<typeof React>('react');
  const Empty = (props: object) => ReactForMock.createElement('Icon', props);
  return {
    CheckMarkIcon: Empty,
    LeftArrowIcon: Empty,
    RightChevronIcon: Empty,
  };
});

jest.mock('@react-native-community/blur', () => {
  const ReactForMock = jest.requireActual<typeof React>('react');
  return {
    BlurView: (props: { children?: React.ReactNode }) =>
      ReactForMock.createElement('BlurView', props, props.children),
  };
});

// These tests exercise persistence analytics and text rendering. The bottom
// sheet's native animations are covered by the hook's type/static checks and
// should not leave asynchronous native callbacks running after this renderer
// is torn down.
jest.mock('@hooks', () => {
  const ReactForMock = jest.requireActual<typeof React>('react');
  return {
    useSelectionBottomSheet: () => {
      const [isVisible, setIsVisible] = ReactForMock.useState(false);
      return {
        isVisible,
        open: () => setIsVisible(true),
        close: () => setIsVisible(false),
        translateY: 0,
        backdropOpacity: 1,
        panHandlers: {},
      };
    },
  };
});

const pressByAccessibilityLabel = (
  renderer: ReactTestRenderer.ReactTestRenderer,
  accessibilityLabel: string
) => {
  const target = renderer.root.findAll(
    (node) =>
      node.props.accessibilityLabel === accessibilityLabel &&
      typeof node.props.onPress === 'function'
  )[0];
  if (!target) {
    throw new Error(`Could not find pressable with accessibility label: ${accessibilityLabel}`);
  }
  return target.props.onPress();
};

const findSwitch = (renderer: ReactTestRenderer.ReactTestRenderer, settingKey: string) => {
  const control = renderer.root.findAll(
    (node) =>
      node.props.testID === `settings-switch-${settingKey}` &&
      typeof node.props.onValueChange === 'function'
  )[0];
  if (!control) {
    throw new Error(`Could not find switch for setting: ${settingKey}`);
  }
  return control;
};

describe('setting analytics', () => {
  it('tracks a switch change only after the durable callback succeeds', async () => {
    const onValueChange = jest.fn().mockResolvedValue(true);
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <SwitchSettingItem
          settingKey="paragraphMode"
          label="Paragraph mode"
          value={false}
          onValueChange={onValueChange}
        />
      );
    });

    await act(async () => {
      await findSwitch(renderer, 'paragraphMode').props.onValueChange(true);
    });

    expect(onValueChange).toHaveBeenCalledWith(true);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'Settings',
      'click',
      'changed paragraphMode to enabled'
    );
  });

  it('uses the same explicit inactive-track colour on iOS', async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <SwitchSettingItem
          settingKey="paragraphMode"
          label="Paragraph mode"
          value={false}
          onValueChange={jest.fn().mockResolvedValue(true)}
        />
      );
    });

    const control = findSwitch(renderer, 'paragraphMode');
    expect(control.props.ios_backgroundColor).toBe('rgb(194, 194, 194)');
    expect(control.props.trackColor).toEqual({
      false: 'rgb(194, 194, 194)',
      true: 'rgba(17, 51, 106, 0.46)',
    });
  });

  it.each([
    ['reports a failed switch save', false],
    ['handles a rejected switch save', new Error('disk full')],
  ])('does not track when the callback %s', async (_description, result) => {
    const onValueChange =
      result instanceof Error
        ? jest.fn().mockRejectedValue(result)
        : jest.fn().mockResolvedValue(result);
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <SwitchSettingItem
          settingKey="vishraam"
          label="Vishraam"
          value={false}
          onValueChange={onValueChange}
        />
      );
    });

    await act(async () => {
      await findSwitch(renderer, 'vishraam').props.onValueChange(true);
    });

    expect(mockTrackEvent).not.toHaveBeenCalled();
    if (result instanceof Error) {
      expect(mockRecordError).toHaveBeenCalledWith(
        result,
        'SwitchSettingItem: failed to change vishraam'
      );
    }
  });

  it('tracks a selection-sheet change only after the durable callback succeeds', async () => {
    const onValueChange = jest.fn().mockResolvedValue(true);
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <SelectionSheetSettingItem
          settingKey="fontSize"
          label="Font size"
          overlayTitle="Select font size"
          options={[{ value: 24, label: 'Large' }]}
          value={18}
          onValueChange={onValueChange}
          getDisplayValue={String}
          isEqual={(a, b) => a === b}
        />
      );
    });

    await act(async () => {
      await pressByAccessibilityLabel(renderer, 'Font size setting, currently 18');
    });
    await act(async () => {
      await pressByAccessibilityLabel(renderer, 'Font size option: Large');
    });

    expect(onValueChange).toHaveBeenCalledWith(24);
    expect(mockTrackEvent).toHaveBeenCalledWith('Settings', 'click', 'changed fontSize to Large');
  });

  it.each([
    ['reports a failed selection-sheet save', false],
    ['handles a rejected selection-sheet save', new Error('disk full')],
  ])('does not track when the callback %s', async (_description, result) => {
    const onValueChange =
      result instanceof Error
        ? jest.fn().mockRejectedValue(result)
        : jest.fn().mockResolvedValue(result);
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <SelectionSheetSettingItem
          settingKey="fontSize"
          label="Font size"
          overlayTitle="Select font size"
          options={[{ value: 24, label: 'Large' }]}
          value={18}
          onValueChange={onValueChange}
          getDisplayValue={String}
          isEqual={(a, b) => a === b}
        />
      );
    });

    await act(async () => {
      await pressByAccessibilityLabel(renderer, 'Font size setting, currently 18');
    });
    await act(async () => {
      await pressByAccessibilityLabel(renderer, 'Font size option: Large');
    });

    expect(mockTrackEvent).not.toHaveBeenCalled();
    if (result instanceof Error) {
      expect(mockRecordError).toHaveBeenCalledWith(
        result,
        'SelectionSheetSettingItem: failed to change fontSize'
      );
    }
  });
});

describe('selection-sheet options follow the app font setting', () => {
  const renderSelectionSheet = async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <SelectionSheetSettingItem<string>
          settingKey="angsFormat"
          label="Ang Numbering"
          overlayTitle="Select Ang Numbering"
          options={[
            { value: 'punjabi', label: 'Punjabi' },
            { value: 'english', label: 'English' },
          ]}
          value="punjabi"
          onValueChange={jest.fn().mockResolvedValue(true)}
          getDisplayValue={(value) => value}
          isEqual={(a, b) => a === b}
        />
      );
    });
    return renderer;
  };

  it('renders the options through the app text primitive', async () => {
    // The row that opens the list grew with the setting while the list itself
    // stayed put, because this was the one text in the app that bypassed the
    // typography table.
    const renderer = await renderSelectionSheet();
    await act(async () => {
      await pressByAccessibilityLabel(renderer, 'Ang Numbering setting, currently punjabi');
    });
    expect(renderer.root.findAllByType('ListItemTitle' as never)).toHaveLength(0);

    const labels = renderer.root
      .findAllByType(AppText)
      .map((node) => node.props.children as string);
    expect(labels).toEqual(expect.arrayContaining(['Punjabi', 'English']));
  });

  it('opts the options out of the device font setting, like the rest of the app', async () => {
    // Otherwise the OS accessibility slider multiplies against the app's own
    // setting here and nowhere else.
    const renderer = await renderSelectionSheet();
    await act(async () => {
      await pressByAccessibilityLabel(renderer, 'Ang Numbering setting, currently punjabi');
    });
    for (const node of renderer.root.findAllByType(AppText)) {
      expect(node.props.allowFontScaling ?? false).toBe(false);
    }
  });
});
