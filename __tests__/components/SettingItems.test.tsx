import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { DropdownSettingItem } from '../../components/Settings/DropdownSettingItem';
import { SwitchSettingItem } from '../../components/Settings/SwitchSettingItem';

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
