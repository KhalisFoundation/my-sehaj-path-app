interface UIConstant {
  [key: string]: any;
}

export const UIConstants: UIConstant = {
  PROGRESS_CIRCLE_SIZE: 53,
  PROGRESS_CIRCLE_STROKE_WIDTH: 12,
  PROGRESS_CIRCLE_MAX_PROGRESS: 99,
  PROGRESS_CIRCLE_START_ANGLE: 0,
  PROGRESS_CIRCLE_FULL_ANGLE: 360,
  PROGRESS_FILLED_COLOR_START: '#2459AD',
  PROGRESS_FILLED_COLOR_END: '#0D2346',
  PROGRESS_UNFILLED_COLOR: 'rgba(225,225,225,0.9)',
  GRADIENT_X1: '16.15%',
  GRADIENT_Y1: '85.35%',
  GRADIENT_X2: '85.35%',
  GRADIENT_Y2: '16.15%',
  SAVE_ICON_COLOR: '#0D2346',
  PRIMARY_BUTTON_GRADIENT_COLORS: ['#FFFFFF', '#E8F0FC'],
  SWITCH_TRACK_COLOR_FALSE: 'rgb(194, 194, 194)',
  SWITCH_TRACK_COLOR_TRUE: 'rgba(17, 51, 106, 0.46)',
  SWITCH_THUMB_COLOR_TRUE: 'rgb(17, 51, 106)',
  SWITCH_THUMB_COLOR_FALSE: 'rgb(142, 142, 142)',
  PATH_SELECTED_BACKGROUND_COLOR: 'rgba(253, 198, 6, 0.3)',
  PADDING: 12,
  RHYTHM: 12,

  // Shared screen chrome. These were literals repeated across the style files
  // (#0D2346 and #11336A appear in eight of them); naming them here is what lets
  // a screen be restyled without hunting for hex codes.
  SCREEN_BACKGROUND: '#FFFFFF',
  NAV_BACKGROUND: '#0D2346',
  NAV_TEXT_COLOR: '#FFFFFF',
  NAV_TITLE_FONT_SIZE: 20,

  // Text roles, darkest to lightest.
  BRAND_TEXT_COLOR: '#11336A',
  BODY_TEXT_COLOR: '#2C3E50',
  MUTED_TEXT_COLOR: '#6B7B8F',
  DIVIDER_COLOR: '#E3E9F2',

  // Base sizes. `AppText` scales these by the user's font-size setting, so they
  // are the value at the default setting rather than a fixed rendered size.
  TITLE_FONT_SIZE: 28,
  SUBTITLE_FONT_SIZE: 20,
  BODY_FONT_SIZE: 16,
  BODY_LINE_HEIGHT: 26,
  CAPTION_FONT_SIZE: 14,

  // About screen artwork, sized to the aspect ratio of each source image.
  ABOUT_KHALIS_LOGO_WIDTH: 220,
  ABOUT_KHALIS_LOGO_HEIGHT: 74,
  ABOUT_BANIDB_LOGO_SIZE: 64,
  DIVIDER_HEIGHT: 1,
  DRAWER_REDUCED_TRANSPARENCY_FALLBACK: 'rgba(0, 0, 0, 0.3)',
};

export const EDGES_ALL_SIDES = ['top', 'bottom', 'left', 'right'] as const;
export const EDGES_DRAWER_MENU = ['top', 'left', 'bottom'] as const;
