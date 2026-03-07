export type LayoutConfig = {
  WINDOW_WIDTH: number;
  WINDOW_HEIGHT: number;
  BLOCK_SIZE: number;
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
  BOARD_X: 246,
  BOARD_Y: 64,
  NEXT_X: 425,
  NEXT_Y: 79,
  NEXT_SIZE: 96,
  SCORE_Y: 440,
  SCORE_X: [237, 333, 433, 532],
};

export const MOBILE_LAYOUT: LayoutConfig = {
  WINDOW_WIDTH: 640,
  WINDOW_HEIGHT: 461,
  BLOCK_SIZE: 24,
  BOARD_X: 246,
  BOARD_Y: 64,
  NEXT_X: 425,
  NEXT_Y: 79,
  NEXT_SIZE: 96,
  SCORE_Y: 440,
  SCORE_X: [237, 333, 433, 532],
};

export const DISPLAY_MODES = ['window', 'mobile'] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

export const getLayout = (mode: DisplayMode): LayoutConfig =>
  mode === 'mobile' ? MOBILE_LAYOUT : WINDOW_LAYOUT;

export const isDisplayMode = (value: string): value is DisplayMode =>
  DISPLAY_MODES.includes(value as DisplayMode);
