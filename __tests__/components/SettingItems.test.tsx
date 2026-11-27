import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { DropdownSettingItem } from '../../components/Settings/DropdownSettingItem';
import { SwitchSettingItem } from '../../components/Settings/SwitchSettingItem';
import { AppText } from '../../components/AppText';

// The dropdown's options now render through `AppText`, which reads the font
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

jest.mock('@rneui/themed', () => {
  const ReactForMock = jest.requireActual<typeof React>('react');
  const ListItem = (props: { children?: React.ReactNode }) =>
    ReactForMock.createElement('ListItem', props, props.children);
  ListItem.Content = (props: { children?: React.ReactNode }) =>
    ReactForMock.createElement('ListItemContent', props, props.children);
  // Left in place deliberately. If a future edit routes option labels back
  // through this, the test below fails: `ListItem.Title` renders React Native's
  // own Text, which no app setting reaches.
  ListItem.Title = (props: { children?: React.ReactNode }) =>
    ReactForMock.createElement('ListItemTitle', props, props.children);

  return {
    ListItem,
    Overlay: (props: { children?: React.ReactNode }) =>
      ReactForMock.createElement('Overlay', props, props.children),
    Switch: (props: object) => ReactForMock.createElement('Switch', props),
  };
});

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
      await renderer.root.findByType('Switch' as never).props.onValueChange(true);
    });

    expect(onValueChange).toHaveBeenCalledWith(true);
    expect(mockTrackEvent).toHaveBeenCalledWith(
      'Settings',
      'click',
      'changed paragraphMode to enabled'
    );
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
      await renderer.root.findByType('Switch' as never).props.onValueChange(true);
    });

    expect(mockTrackEvent).not.toHaveBeenCalled();
    if (result instanceof Error) {
      expect(mockRecordError).toHaveBeenCalledWith(
        result,
        'SwitchSettingItem: failed to change vishraam'
      );
    }
  });

  it('tracks a dropdown change only after the durable callback succeeds', async () => {
    const onValueChange = jest.fn().mockResolvedValue(true);
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DropdownSettingItem
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
      await renderer.root.findByType('ListItem' as never).props.onPress();
    });

    expect(onValueChange).toHaveBeenCalledWith(24);
    expect(mockTrackEvent).toHaveBeenCalledWith('Settings', 'click', 'changed fontSize to Large');
  });

  it.each([
    ['reports a failed dropdown save', false],
    ['handles a rejected dropdown save', new Error('disk full')],
  ])('does not track when the callback %s', async (_description, result) => {
    const onValueChange =
      result instanceof Error
        ? jest.fn().mockRejectedValue(result)
        : jest.fn().mockResolvedValue(result);
    let renderer!: ReactTestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DropdownSettingItem
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
      await renderer.root.findByType('ListItem' as never).props.onPress();
    });

    expect(mockTrackEvent).not.toHaveBeenCalled();
    if (result instanceof Error) {
      expect(mockRecordError).toHaveBeenCalledWith(
        result,
        'DropdownSettingItem: failed to change fontSize'
      );
    }
  });
});

describe('dropdown options follow the app font setting', () => {
  const renderDropdown = async () => {
    let renderer!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = ReactTestRenderer.create(
        <DropdownSettingItem<string>
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
    const renderer = await renderDropdown();
    expect(renderer.root.findAllByType('ListItemTitle' as never)).toHaveLength(0);

    const labels = renderer.root
      .findAllByType(AppText)
      .map((node) => node.props.children as string);
    expect(labels).toEqual(expect.arrayContaining(['Punjabi', 'English']));
  });

  it('opts the options out of the device font setting, like the rest of the app', async () => {
    // Otherwise the OS accessibility slider multiplies against the app's own
    // setting here and nowhere else.
    const renderer = await renderDropdown();
    for (const node of renderer.root.findAllByType(AppText)) {
      expect(node.props.allowFontScaling ?? false).toBe(false);
    }
  });
});
