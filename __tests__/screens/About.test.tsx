import React from 'react';
import { Linking } from 'react-native';
import { Provider } from 'react-redux';
import { render, fireEvent } from '@testing-library/react-native';
import { About } from '../../screens/About';
import { store } from '../../store';
import { AboutText, KHALIS_PRIVACY_POLICY_URL, KHALIS_FOUNDATION_URL } from '@constants';

jest.mock('@icons', () => {
  const ReactForMock = jest.requireActual<typeof React>('react');
  return { LeftArrowIcon: () => ReactForMock.createElement('LeftArrowIcon') };
});
jest.mock('@hooks', () => ({ useScreenAnalytics: jest.fn() }));
jest.mock('@utils', () => ({
  recordError: jest.fn(),
  trackEvent: jest.fn(),
}));

const navigation = { goBack: jest.fn() } as never;
const route = { key: 'About', name: 'About' } as never;

// `AppText` scales itself from the font size in the store, so the screen needs a
// real Provider rather than a mocked selector — the point is that this renders
// the way it will on a device.
const renderAbout = () =>
  render(
    <Provider store={store}>
      <About navigation={navigation} route={route} />
    </Provider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

describe('the About screen', () => {
  it('credits Khalis Foundation and BaniDB, and blesses the reader', () => {
    const { getByText } = renderAbout();
    expect(getByText(AboutText.APP_NAME)).toBeTruthy();
    expect(getByText(AboutText.BANIDB_LINK)).toBeTruthy();
    expect(getByText(AboutText.BHUL_CHUK_MAAF)).toBeTruthy();
  });

  it('shows the copyright', () => {
    const { getByText } = renderAbout();
    expect(getByText(AboutText.COPYRIGHT)).toBeTruthy();
  });

  it('opens the privacy policy — the one link the stores require to work', () => {
    const { getByText } = renderAbout();
    fireEvent.press(getByText(AboutText.PRIVACY_POLICY));
    expect(Linking.openURL).toHaveBeenCalledWith(KHALIS_PRIVACY_POLICY_URL);
  });

  it('opens the foundation site', () => {
    const { getByText } = renderAbout();
    fireEvent.press(getByText(KHALIS_FOUNDATION_URL));
    expect(Linking.openURL).toHaveBeenCalledWith(KHALIS_FOUNDATION_URL);
  });

  it('does not crash when no browser can handle the link', async () => {
    // `openURL` rejects when nothing can open the URL. Unhandled, that is a
    // redbox on a screen whose whole job is to be reassuring.
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const { getByText } = renderAbout();
    expect(() => fireEvent.press(getByText(AboutText.PRIVACY_POLICY))).not.toThrow();
  });
});
