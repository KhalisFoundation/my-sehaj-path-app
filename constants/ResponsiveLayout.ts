/**
 * Layout policy for controls that intentionally grow with the app's reading
 * font setting. Keeping it here prevents individual screens from inventing
 * slightly different large-text geometry.
 */
export const ReaderToolbar = {
  BASE_HEIGHT: 48,
  BASE_MAX_WIDTH: 200,
  CONTROL_ICON_SIZE: 26,
  CONTROL_ICON_STROKE_WIDTH: 1.7,
  VERTICAL_PADDING_PER_SCALE_STEP: 10,
  WIDTH_GROWTH_PER_SCALE_STEP: 80,
} as const;

export const ReaderStatusMessage = {
  BASE_MAX_WIDTH: 356,
  SCREEN_EDGE_INSET: 12,
  WIDTH_GROWTH_PER_SCALE_STEP: 80,
} as const;

export const DrawerIcon = {
  SIZE: 20,
  MINIMUM_SLOT_SIZE: 24,
} as const;

const additionalScale = (scale: number): number => Math.max(0, scale - 1);

/** Geometry for the reader's three-icon control bar at a given interface scale. */
export const readerToolbarLayout = (scale: number) => {
  const growth = additionalScale(scale);
  const verticalPadding = Math.round(growth * ReaderToolbar.VERTICAL_PADDING_PER_SCALE_STEP);

  return {
    height: ReaderToolbar.BASE_HEIGHT + verticalPadding * 2,
    maxWidth:
      ReaderToolbar.BASE_MAX_WIDTH + Math.round(growth * ReaderToolbar.WIDTH_GROWTH_PER_SCALE_STEP),
    paddingVertical: verticalPadding,
  };
};

/**
 * Keeps a status message readable at larger interface sizes without letting it
 * touch a phone's screen edge or become excessively wide on a foldable.
 */
export const readerStatusMessageMaxWidth = (scale: number, windowWidth: number): number =>
  Math.min(
    windowWidth - ReaderStatusMessage.SCREEN_EDGE_INSET * 2,
    ReaderStatusMessage.BASE_MAX_WIDTH +
      Math.round(additionalScale(scale) * ReaderStatusMessage.WIDTH_GROWTH_PER_SCALE_STEP)
  );
