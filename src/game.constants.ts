import type { Sound } from './sound';

// ===========================================
// CORE TYPES
// ===========================================

// Jewel IDs used on the board
// 0 = empty
// 1–8 = regular colored jewels
// 9 = Onyx jewel (special scoring)
// 10 = Wildcard jewel (matches any color)
export type JewelId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// Active falling piece – a single vertical triplet (1×3 column)
export type Piece = {
  // Column index on the board (0-based)
  column: number;
  // Board row index of the bottom jewel in the triplet.
  // Can be >= BOARD_ROWS while the piece is entering from the top.
  bottomRow: number;
  // Jewel IDs for [bottom, middle, top]
  jewels: [JewelId, JewelId, JewelId];
  // True when this piece is the special wildcard triplet (three gray jewels)
  isWildcardTriplet: boolean;
};

// Level speeds in ticks (kept compatible with original timing system)
export type Level =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20;
// Actual formula: 56 - 3.5 * level, to be validated
export const LEVEL_SPEED = Array.from({ length: 20 }, (_, i) => 58 - 3 * i);

export const FREEFALL_RATE_TICKS = 2; // Freefall drop rate

// Timing: 1 tick = 1/60 second = ~16.67ms
export const TICK_MS = 1000 / 60;
// Clearing animation: 4 blink cycles (visible 8 ticks, invisible 8 ticks) = 56 ticks flash,
// then blocks removed + gravity, then 8 ticks wait before checking next cascade.
export const CLEAR_BLINK_HALF = 8; // Ticks for each visible/invisible half-cycle
export const CLEAR_BLINK_CYCLES = 4; // Number of full on/off cycles (last ends with "on")
export const CLEAR_BLINK_TICKS =
  CLEAR_BLINK_HALF * (CLEAR_BLINK_CYCLES * 2 - 1); // 56 ticks
export const CLEAR_SETTLE_TICKS = 8; // Pause after gravity before checking next cascade
export const CLEAR_TOTAL_TICKS = CLEAR_BLINK_TICKS + CLEAR_SETTLE_TICKS; // 64 ticks total

export const BOARD_COLS = 6;
export const BOARD_ROWS = 13;

// Life-lost animation
export const LIFE_LOST_FREEZE_TICKS = 30; // Board shown as-is
export const LIFE_LOST_BLANK_TICKS = 140; // Board shown empty
export const LIFE_LOST_TOTAL_TICKS =
  LIFE_LOST_FREEZE_TICKS + LIFE_LOST_BLANK_TICKS;

// ===========================================
// JEWEL & SCORING CONSTANTS
// ===========================================

// Jewel IDs
export const JEWEL_FIRST_ID = 1 as const;
// Regular jewels (8 colored + 1 Onyx)
export const JEWEL_LAST_REGULAR_ID = 9 as const;
// Special Onyx jewel (black) – one of the regular IDs
export const JEWEL_ONYX_ID = 9 as const;
// Wildcard jewel (three gray jewels in the falling triplet)
export const JEWEL_WILDCARD_ID = 10 as const;

// Regular jewel palette: start with 1–6; jewel 7 unlocks at 25k, jewel 8 at 50k.
// Jewel 9 (Onyx) is always available with lower probability (see ONYX_JEWEL_CHANCE).
export const INITIAL_ACTIVE_JEWEL_ID = 6;
export const UNLOCK_JEWEL_7_SCORE = 25_000;
export const UNLOCK_JEWEL_8_SCORE = 50_000;

// Match scoring (per disappearing jewel group, before cascade multiplier)
export const SCORE_MATCH_BASE = 300; // First 3 jewels
export const SCORE_MATCH_EXTRA_PER_JEWEL = 150; // Each jewel beyond 3
export const SCORE_ONYX_BONUS_PER_JEWEL = 500;

// Drop scoring
export const SCORE_DROP_PER_ROW = 10;

// Level / rest / lives
export const JEWELS_PER_LEVEL = 50;
export const EXTRA_LIFE_SCORE_THRESHOLD = 100_000;
export const STARTING_LIVES = 3;

// Spawn chances
export const WILDCARD_TRIPLET_CHANCE = 0.025; // ~1.5% of pieces
export const COMMON_JEWEL_WEIGHT = 16;
export const ONYX_JEWEL_WEIGHT = 3; // Onyx available from start; lower than regular weight

export type InternalGameState = {
  score: {
    currentScore: number;
    // Total number of jewels cleared across the whole game
    totalCleared: number;
    level: Level;
    // Remaining jewels to clear before advancing to the next level
    rest: number;
    // Remaining lives
    lives: number;
    // Whether the 100,000-point bonus life has already been awarded
    extraLifeAwarded: boolean;
    // Highest jewel ID currently active for random generation (7–9)
    activeMaxJewelId: number;
  };

  isGameOver: boolean;
  events: Sound[];

  board: number[][];

  currentPiece: Piece | null;
  nextPiece: Piece | null;

  // Timing (in ticks)
  timing: {
    lastDropTime: number;
  };

  // Movement state
  movement: {
    inFreefall: boolean;
    pushKeyActive: boolean;
  };

  // Row clearing animation state
  rowClearing: {
    // Cells that are flashing during the current clear animation
    cellsToClear: { col: number; row: number }[];
    clearAnimStartTime: number;
    clearAnimData: {
      removedCount: number;
      scoreDelta: number;
      cascadeIndex: number;
      wasDropOrFreefall?: boolean;
      hasOnyx: boolean;
    } | null;
  };

  // Life-lost animation: 30 ticks freeze, then 140 ticks blank board
  lifeLost: {
    active: boolean;
    startTick: number;
  };

  // Hard drop animation state (original showed piece falling row by row)
  hardDrop: {
    isHardDropping: boolean;
    hardDropStartTime: number;
  };

  pendingDropScore: number; // Accumulated during drop, added when piece lands

  tick: {
    accumulator: number;
    count: number;
  };
};
