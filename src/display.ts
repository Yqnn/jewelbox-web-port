export type LayoutConfig = {
  WINDOW_WIDTH: number;
  WINDOW_HEIGHT: number;
  BLOCK_SIZE: number;
  OVERLAY_X: number;
  OVERLAY_Y: number;
  BOARD_X: number;
  BOARD_Y: number;
  NEXT_X: number;
  NEXT_Y: number;
  NEXT_SIZE: number;
  SCORE_X: number[];
  SCORE_Y: number;
};

export const WINDOW_LAYOUT: LayoutConfig = {
  WINDOW_WIDTH: 640,
  WINDOW_HEIGHT: 461,
  BLOCK_SIZE: 24,
  OVERLAY_X: 198,
  OVERLAY_Y: 50,
  BOARD_X: 246,
  BOARD_Y: 66,
  NEXT_X: 425,
  NEXT_Y: 79,
  NEXT_SIZE: 96,
  SCORE_Y: 440,
  SCORE_X: [237, 333, 433, 532],
};

export const MOBILE_LAYOUT: LayoutConfig = {
  WINDOW_WIDTH: 413,
  WINDOW_HEIGHT: 411,
  BLOCK_SIZE: 24,
  OVERLAY_X: 1,
  OVERLAY_Y: 1,
  BOARD_X: 49,
  BOARD_Y: 13,
  NEXT_X: 260,
  NEXT_Y: 94,
  NEXT_SIZE: 32,
  SCORE_Y: 390,
  SCORE_X: [40, 136, 236, 335],
};

export const DISPLAY_MODES = ['window', 'mobile'] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

export const getLayout = (mode: DisplayMode): LayoutConfig =>
  mode === 'mobile' ? MOBILE_LAYOUT : WINDOW_LAYOUT;

export const isDisplayMode = (value: string): value is DisplayMode =>
  DISPLAY_MODES.includes(value as DisplayMode);
