import React from 'react';
import { Provider } from 'react-redux';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PATH_DATA } from '@constants';
import { PathRename } from '../../components/PathRename';
import { store } from '../../store';
import { renamePathCommand } from '../../store/commands';

jest.mock('../../store/commands', () => ({ renamePathCommand: jest.fn() }));
jest.mock('@react-native-community/blur', () => ({ BlurView: () => null }));
jest.mock('@utils', () => ({ trackEvent: jest.fn() }));

const renameMock = renamePathCommand as jest.MockedFunction<typeof renamePathCommand>;

const renderRename = () => {
  const setPathRename = jest.fn();
  const setPathName = jest.fn();
  const screen = render(
    <Provider store={store}>
      <PathRename
        pathId={7}
        initialPathName="Family path"
        setPathRename={setPathRename}
        setPathName={setPathName}
      />
    </Provider>
  );
  return { ...screen, setPathName };
};

beforeEach(() => {
  jest.clearAllMocks();
  renameMock.mockResolvedValue(true);
});

describe('PathRename', () => {
  it('limits the field to the length the server accepts', () => {
    const { getByPlaceholderText } = renderRename();

    expect(getByPlaceholderText('Enter New Name').props.maxLength).toBe(PATH_DATA.MAX_NAME_LENGTH);
  });

  it('turns a pasted line break into a space before saving', async () => {
    const { getByPlaceholderText, getByLabelText, setPathName } = renderRename();

    fireEvent.changeText(getByPlaceholderText('Enter New Name'), 'Morning\nPath');
    expect(getByPlaceholderText('Enter New Name').props.value).toBe('Morning Path');

    fireEvent.press(getByLabelText('Update path name'));

    await waitFor(() => expect(renameMock).toHaveBeenCalledWith(7, 'Morning Path'));
    expect(setPathName).toHaveBeenCalledWith('Morning Path');
  });

  it('cuts a pasted name that is too long instead of sending it', async () => {
    const { getByPlaceholderText, getByLabelText } = renderRename();

    fireEvent.changeText(
      getByPlaceholderText('Enter New Name'),
      'a'.repeat(PATH_DATA.MAX_NAME_LENGTH + 40)
    );
    fireEvent.press(getByLabelText('Update path name'));

    await waitFor(() =>
      expect(renameMock).toHaveBeenCalledWith(7, 'a'.repeat(PATH_DATA.MAX_NAME_LENGTH))
    );
  });

  it('shows the limit error once the name reaches the maximum length', () => {
    const { getByPlaceholderText, queryByText } = renderRename();
    const message = `A path name can be up to ${PATH_DATA.MAX_NAME_LENGTH} characters.`;

    expect(queryByText(message)).toBeNull();

    fireEvent.changeText(
      getByPlaceholderText('Enter New Name'),
      'a'.repeat(PATH_DATA.MAX_NAME_LENGTH)
    );
    expect(queryByText(message)).toBeTruthy();

    fireEvent.changeText(getByPlaceholderText('Enter New Name'), 'Family');
    expect(queryByText(message)).toBeNull();
  });
});
