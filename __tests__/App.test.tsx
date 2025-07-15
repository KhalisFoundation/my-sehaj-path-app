import React from 'react';
import { it, describe } from '@jest/globals';
import { render } from '@testing-library/react-native';
import App from '../App';

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
  });
});
