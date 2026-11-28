import React, { useState } from 'react';
import { Provider } from 'react-redux';
import { act, fireEvent, render } from '@testing-library/react-native';
import { DrawerMenu } from '../../components/DrawerMenu';
import { Constants } from '../../constants';
import { store } from '../../store';

jest.mock('../../icons', () => new Proxy({}, { get: () => () => null }));
jest.mock('../../icons/Donation.icon', () => ({ DonationIcon: () => null }));
jest.mock('../../icons/SaveIconMenu.icon', () => ({ SaveIconMenu: () => null }));
jest.mock('../../icons/SettingsMenu.icon', () => ({ SettingsMenu: () => null }));
jest.mock('../../auth', () => ({ startLogin: jest.fn(), logout: jest.fn() }));

/** The drawer as a screen uses it: open, and closed again by its own onClose. */
const Harness = ({ onNavigate }: { onNavigate: jest.Mock }) => {
  const [visible, setVisible] = useState(true);
  return (
    <Provider store={store}>
      <DrawerMenu
        isVisible={visible}
        onClose={() => setVisible(false)}
        onNavigate={onNavigate}
        showOnlyHomeItems
      />
    </Provider>
  );
};

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('choosing a destination in the drawer', () => {
  it('opens it only once the drawer has finished closing', async () => {
    // Navigating first left the drawer's full-screen layer over the new screen
    // for the whole close animation: Settings appeared under a white veil with
    // the previous screen's text showing through.
    const onNavigate = jest.fn();
    const view = render(<Harness onNavigate={onNavigate} />);
    await act(async () => {
      jest.advanceTimersByTime(400); // let it open
    });

    fireEvent.press(view.getByText(Constants.SETTINGS));
    expect(onNavigate).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(400); // the close animation
    });

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate).toHaveBeenCalledWith('Setting');
  });

  it('goes nowhere when the drawer is simply closed', async () => {
    const onNavigate = jest.fn();
    const view = render(<Harness onNavigate={onNavigate} />);
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    fireEvent.press(view.getByLabelText(Constants.CLOSE_MENU));
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(onNavigate).not.toHaveBeenCalled();
  });
});
