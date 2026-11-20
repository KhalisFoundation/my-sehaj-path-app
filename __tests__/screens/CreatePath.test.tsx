import React from 'react';
import { Provider } from 'react-redux';
import { fireEvent, render } from '@testing-library/react-native';
import { CreatePath } from '../../screens/CreatePath';
import { store } from '../../store';
import { PATH_DATA } from '@constants';

jest.mock('../../store/commands', () => ({ createPath: jest.fn() }));
jest.mock('@auth', () => ({ startLogin: jest.fn() }));
// Icons are SVG components, which need a native renderer; a stub is enough here.
jest.mock('../../icons', () => new Proxy({}, { get: () => () => null }));

const navigation = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() } as never;
const route = { key: 'CreatePath', name: 'CreatePath' } as never;

const renderScreen = () =>
  render(
    <Provider store={store}>
      <CreatePath navigation={navigation} route={route} />
    </Provider>
  );

describe('the new path name box', () => {
  it('stops typing at the length the server accepts', () => {
    const { getByLabelText } = renderScreen();

    expect(getByLabelText('Path name input').props.maxLength).toBe(PATH_DATA.MAX_NAME_LENGTH);
  });

  it('lets return finish the name instead of adding a line to it', () => {
    const { getByLabelText } = renderScreen();

    // Multiline only so a long name wraps.
    expect(getByLabelText('Path name input').props.submitBehavior).toBe('blurAndSubmit');
  });

  it('keeps a pasted name to one line and within the limit', () => {
    const { getByLabelText } = renderScreen();

    fireEvent.changeText(getByLabelText('Path name input'), `Morning\npath ${'x'.repeat(200)}`);

    const value = getByLabelText('Path name input').props.value as string;
    expect(value).not.toContain('\n');
    expect(value).toHaveLength(PATH_DATA.MAX_NAME_LENGTH);
    expect(value.startsWith('Morning path')).toBe(true);
  });
});
