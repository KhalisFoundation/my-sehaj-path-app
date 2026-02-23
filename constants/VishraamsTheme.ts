/**
 * Vishraams Theme Configuration
 * Centralized color and gradient configuration for vishraam styling
 */

export interface VishraamsColorConfig {
  // Main pause (v) colors
  mainPause: {
    text: string;
    gradientBg: string;
    gradientBorderLeft: string;
    gradientBorderRight: string;
  };
  // Light pause (y) colors
  lightPause: {
    text: string;
    gradientBg: string;
    gradientBorderLeft: string;
    gradientBorderRight: string;
  };
  // Gradient style settings
  gradient: {
    paddingHorizontal: number;
    paddingVertical: number;
    borderRadius: number;
    borderLeftWidth: number;
    borderRightWidth: number;
  };
  // Colored words style settings
  coloredWords: {
    fontWeight: '400' | '500' | '600' | '700' | '800' | '900';
  };
}

/**
 * Default Vishraams Theme
 * You can modify these values to customize the appearance of vishraams
 */
export const VishraamsTheme: VishraamsColorConfig = {
  mainPause: {
    text: '#d2691e', // Chocolate/brown color for main pause text
    gradientBg: 'rgba(210, 105, 30, 0.3)', // Semi-transparent chocolate background
    gradientBorderLeft: 'rgba(210, 105, 30, 0.1)', // Light border on left
    gradientBorderRight: 'rgba(210, 105, 30, 0.6)', // Darker border on right
  },
  lightPause: {
    text: '#00cc66', // Green color for light pause text
    gradientBg: 'rgba(0, 204, 102, 0.3)', // Semi-transparent green background
    gradientBorderLeft: 'rgba(0, 204, 102, 0.1)', // Light border on left
    gradientBorderRight: 'rgba(0, 204, 102, 0.6)', // Darker border on right
  },
  gradient: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderRightWidth: 3,
  },
  coloredWords: {
    fontWeight: '600',
  },
};
