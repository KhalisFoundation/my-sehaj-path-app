/**
 * Vishraams Theme Configuration
 * Centralized color and gradient configuration for vishraam styling
 */

export interface VishraamsColorConfig {
  // Main pause (v) colors
  mainPause: {
    text: string;
  };
  // Light pause (y) colors
  lightPause: {
    text: string;
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
    text: '#d35400', // Orange color for main pause text
  },
  lightPause: {
    text: '#16a085', // Green color for light pause text
  },
  coloredWords: {
    fontWeight: '600',
  },
};
