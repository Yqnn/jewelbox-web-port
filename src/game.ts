import type {
  InternalGameState,
  JewelId,
  Level,
  Piece,
} from './game.constants';
import {
  BOARD_COLS,
  BOARD_ROWS,
  CLEAR_BLINK_HALF,
  CLEAR_BLINK_TICKS,
  CLEAR_TOTAL_TICKS,
  EXTRA_LIFE_SCORE_THRESHOLD,
  INITIAL_ACTIVE_JEWEL_ID,
  JEWEL_FIRST_ID,
  JEWEL_ONYX_ID,
  JEWEL_WILDCARD_ID,
  JEWELS_PER_LEVEL,
  LEVEL_SPEED,
  LIFE_LOST_BLANK_TICKS,
  LIFE_LOST_FREEZE_TICKS,
  ONYX_JEWEL_CHANCE,
  SCORE_DROP_PER_ROW,
  SCORE_MATCH_BASE,
  SCORE_MATCH_EXTRA_PER_JEWEL,
  SCORE_ONYX_BONUS_PER_JEWEL,
  STARTING_LIVES,
  TICK_MS,
  UNLOCK_JEWEL_7_SCORE,
  UNLOCK_JEWEL_8_SCORE,
  WILDCARD_TRIPLET_CHANCE,
  FREEFALL_RATE_TICKS,
  SCORE_ONYX_BONUS_PER_ROW_ON_GROUND,
} from './game.constants';

export const initGame = () => {
  let state = makeInitialGameState(true);

  const start = () => {
    state = makeInitialGameState();
    state.score.level = 1;

    // Spawn first piece
    startNextPiece(state);

    state.timing.lastDropTime = state.tick.count;
    state.tick.accumulator = 0;
  };

  const tick = (deltaTime: number) => {
    state.tick.accumulator += deltaTime;

    while (state.tick.accumulator >= TICK_MS) {
      state.tick.count++;
      state.tick.accumulator -= TICK_MS;

      if (state.lifeLost.active) {
        const elapsed = state.tick.count - state.lifeLost.startTick;
        if (elapsed >= LIFE_LOST_FREEZE_TICKS + LIFE_LOST_BLANK_TICKS) {
          finishLifeLostAnimation(state);
        }
      } else if (state.rowClearing.cellsToClear.length) {
        const elapsed = state.tick.count - state.rowClearing.clearAnimStartTime;
        if (elapsed === CLEAR_BLINK_TICKS) {
          removeClearedCells(state);
        } else if (elapsed >= CLEAR_TOTAL_TICKS) {
          finishCascadeStep(state);
        }
      } else {
        animateActivePiece(state);
      }
    }
  };

  const saveState = () => {
    const dataToSave = {
      version: 'jewelbox-v1',
      score: state.score,
      board: state.board,
      currentPiece: state.currentPiece,
      nextPiece: state.nextPiece,
      pendingDropScore: state.pendingDropScore,
    };
    localStorage.setItem('jewelBoxGameState', JSON.stringify(dataToSave));
  };

  return {
    start,
    tick,
    saveState,
    handleKeyDown: (key: string) => handleKeyDown(state, key),

    getScore: () => state.score.currentScore,
    getCurrentLevel: () => state.score.level,
    getRest: () => state.score.rest,
    getLives: () => state.score.lives,

    getCurrentPiece: () => state.currentPiece,
    getNextPiece: () => state.nextPiece,
    getGameBoard: () => state.board,

    getRowsToClear: () => state.rowClearing.cellsToClear,
    getClearAnimVisible: () => {
      if (!state.rowClearing.cellsToClear.length) {
        return false;
      }
      const elapsed = state.tick.count - state.rowClearing.clearAnimStartTime;
      if (elapsed >= CLEAR_BLINK_TICKS) {
        return false;
      }
      const phase = Math.floor(elapsed / CLEAR_BLINK_HALF);
      return phase % 2 === 0;
    },

    isGameOver: () => state.isGameOver,
    getEvents: () => state.events,
    clearEvents: () => (state.events = []),
    getLifeLostState: () =>
      state.lifeLost.active
        ? {
            elapsed: state.tick.count - state.lifeLost.startTick,
            freezeTicks: LIFE_LOST_FREEZE_TICKS,
          }
        : null,

    getTickCount: () => state.tick.count,
  };
};

// ===========================================
// INITIAL STATE
// ===========================================

function createEmptyBoard(): JewelId[][] {
  const board: JewelId[][] = [];
  for (let col = 0; col < BOARD_COLS; col++) {
    board[col] = [];
    for (let row = 0; row < BOARD_ROWS; row++) {
      board[col][row] = 0;
    }
  }
  return board;
}

function makeInitialGameState(restoreSavedState = false): InternalGameState {
  const board = createEmptyBoard();

  const savedStateJson =
    restoreSavedState && typeof localStorage !== 'undefined'
      ? localStorage.getItem('jewelBoxGameState')
      : null;
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('jewelBoxGameState');
  }

  let saved: Partial<InternalGameState> | null = null;
  try {
    if (savedStateJson) {
      const parsed = JSON.parse(savedStateJson);
      if (parsed?.version === 'jewelbox-v1') {
        saved = parsed as Partial<InternalGameState>;
      }
    }
  } catch {
    saved = null;
  }

  const base: InternalGameState = {
    score: {
      currentScore: 0,
      totalCleared: 0,
      level: 1,
      rest: JEWELS_PER_LEVEL,
      lives: STARTING_LIVES,
      extraLifesAwarded: 0,
      activeMaxJewelId: INITIAL_ACTIVE_JEWEL_ID,
    },
    isGameOver: false,
    events: [],
    board,
    currentPiece: null,
    nextPiece: null,
    timing: {
      lastDropTime: 0,
    },
    movement: {
      inFreefall: false,
      pushKeyActive: false,
    },
    rowClearing: {
      cellsToClear: [],
      clearAnimStartTime: 0,
      clearAnimData: null,
    },
    lifeLost: {
      active: false,
      startTick: 0,
    },
    hardDrop: {
      isHardDropping: false,
      hardDropStartTime: 0,
    },
    pendingDropScore: 0,
    tick: {
      accumulator: 0,
      count: 0,
    },
  };

  return saved ? { ...base, ...saved } : base;
}

// ===========================================
// PIECE HELPERS
// ===========================================

function randomInt(minInclusive: number, maxInclusive: number): number {
  return (
    minInclusive + Math.floor(Math.random() * (maxInclusive - minInclusive + 1))
  );
}

function randomRegularJewel(state: InternalGameState): JewelId {
  // Regular colors 1..activeMaxJewelId (6 at start, then 7 at 25k, 8 at 50k)
  const id = randomInt(JEWEL_FIRST_ID, state.score.activeMaxJewelId);
  return id as JewelId;
}

function createRandomPiece(state: InternalGameState): Piece {
  const isWildcardTriplet = Math.random() < WILDCARD_TRIPLET_CHANCE;

  // Spawn in the 3rd column (1-based) for a 6×13 board.
  const column = Math.floor((BOARD_COLS - 1) / 2);
  // Start with the full triplet visible at the top of the board.
  const bottomRow = BOARD_ROWS - 3;

  let jewels: [JewelId, JewelId, JewelId];
  if (isWildcardTriplet) {
    jewels = [JEWEL_WILDCARD_ID, JEWEL_WILDCARD_ID, JEWEL_WILDCARD_ID];
  } else {
    const onyxPosition =
      Math.random() < ONYX_JEWEL_CHANCE ? randomInt(1, 3) : 0;
    jewels = [
      onyxPosition === 1 ? JEWEL_ONYX_ID : randomRegularJewel(state),
      onyxPosition === 2 ? JEWEL_ONYX_ID : randomRegularJewel(state),
      onyxPosition === 3 ? JEWEL_ONYX_ID : randomRegularJewel(state),
    ];
  }

  return {
    column,
    bottomRow,
    jewels,
    isWildcardTriplet,
  };
}

type Cell = { col: number; row: number };

function getPieceCells(piece: Piece): Cell[] {
  const cells: Cell[] = [];
  for (let i = 0; i < 3; i++) {
    cells.push({ col: piece.column, row: piece.bottomRow + i });
  }
  return cells;
}

function isPositionLegal(state: InternalGameState, piece: Piece): boolean {
  const cells = getPieceCells(piece);
  for (const { col, row } of cells) {
    if (col < 0 || col >= BOARD_COLS) {
      return false;
    }
    if (row < 0) {
      return false;
    }
    if (row >= BOARD_ROWS) {
      continue;
    } // Still above the board
    if (state.board[col][row]) {
      return false;
    }
  }
  return true;
}

function tryMovePieceHorizontal(
  state: InternalGameState,
  deltaCol: number
): void {
  if (!state.currentPiece) {
    return;
  }
  const moved: Piece = {
    ...state.currentPiece,
    column: state.currentPiece.column + deltaCol,
  };
  if (isPositionLegal(state, moved)) {
    state.currentPiece = moved;
  }
}

/** Returns the lowest legal bottomRow for the current piece (0 = on the floor). */
function getHardDropBottomRow(state: InternalGameState): number {
  if (!state.currentPiece) {
    return 0;
  }
  let bottomRow = state.currentPiece.bottomRow;
  while (bottomRow > 0) {
    const moved: Piece = { ...state.currentPiece, bottomRow: bottomRow - 1 };
    if (!isPositionLegal(state, moved)) {
      break;
    }
    bottomRow--;
  }
  return bottomRow;
}

// ===========================================
// GAMEPLAY CORE
// ===========================================

function animateActivePiece(state: InternalGameState) {
  if (!state.currentPiece) {
    return;
  }
  const currentTicks = state.tick.count;

  // Determine drop timing
  const levelSpeed = LEVEL_SPEED[state.score.level];
  const dropInterval = state.movement.inFreefall
    ? FREEFALL_RATE_TICKS
    : levelSpeed;

  if (currentTicks - state.timing.lastDropTime < dropInterval) {
    return;
  }

  state.timing.lastDropTime = currentTicks;

  if (!state.currentPiece) {
    return;
  }
  const moved: Piece = {
    ...state.currentPiece,
    bottomRow: state.currentPiece.bottomRow - 1,
  };

  if (isPositionLegal(state, moved)) {
    state.currentPiece = moved;
  } else {
    lockPiece(state, state.movement.inFreefall);
  }
}

function startNextPiece(state: InternalGameState): boolean {
  if (!state.nextPiece) {
    state.nextPiece = createRandomPiece(state);
  }

  state.currentPiece = state.nextPiece;
  state.currentPiece.column = Math.floor((BOARD_COLS - 1) / 2);
  state.currentPiece.bottomRow = BOARD_ROWS - 3;

  state.nextPiece = createRandomPiece(state);
  if (state.nextPiece.isWildcardTriplet) {
    state.events.push('wildcard');
  }

  if (!isPositionLegal(state, state.currentPiece)) {
    return false;
  }

  state.timing.lastDropTime = state.tick.count;
  return true;
}

function placePieceOnBoard(
  state: InternalGameState,
  piece: Piece
): { ok: boolean; wildcardTargetColor: JewelId | null } {
  const cells = getPieceCells(piece);
  let ok = true;
  let wildcardTargetColor: JewelId | null = null;

  for (let i = 0; i < cells.length; i++) {
    const { col, row } = cells[i];
    const jewel = piece.jewels[i];

    if (row >= BOARD_ROWS || row < 0) {
      ok = false;
      continue;
    }

    if (state.board[col][row]) {
      ok = false;
    }

    if (jewel === JEWEL_WILDCARD_ID && wildcardTargetColor === null) {
      if (row > 0) {
        const below = state.board[col][row - 1];
        if (below && below !== JEWEL_WILDCARD_ID) {
          wildcardTargetColor = state.board[col][row - 1];
        }
      } else {
        wildcardTargetColor = JEWEL_WILDCARD_ID;
      }
    }

    state.board[col][row] = jewel;
  }

  return { ok, wildcardTargetColor };
}

function handleLifeLost(state: InternalGameState) {
  state.score.lives -= 1;
  if (state.score.lives <= 0) {
    state.isGameOver = true;
    return;
  }
  state.events.push('lifeLost');
  console.log('handleLifeLost', state.events);

  state.currentPiece = null;
  // nextPiece is preserved so it stays visible during the life-lost animation
  state.rowClearing.cellsToClear = [];
  state.rowClearing.clearAnimData = null;
  resetMovementFlags(state);

  // Start the life-lost animation (freeze then blank board)
  state.lifeLost.active = true;
  state.lifeLost.startTick = state.tick.count;
}

function finishLifeLostAnimation(state: InternalGameState) {
  state.lifeLost.active = false;

  // Clear the board and spawn next piece
  for (let col = 0; col < BOARD_COLS; col++) {
    for (let row = 0; row < BOARD_ROWS; row++) {
      state.board[col][row] = 0;
    }
  }

  startNextPiece(state);
}

function afterCascadeSequenceFinished(state: InternalGameState) {
  resetMovementFlags(state);

  if (!startNextPiece(state)) {
    handleLifeLost(state);
  }
}

function lockPiece(state: InternalGameState, wasDropOrFreefall: boolean) {
  if (!state.currentPiece) {
    return;
  }

  const piece = state.currentPiece;

  // Apply pending drop score from hard drop (if any)
  if (state.pendingDropScore > 0) {
    state.score.currentScore += state.pendingDropScore;
    state.pendingDropScore = 0;
  }

  const { ok, wildcardTargetColor } = placePieceOnBoard(state, piece);
  state.currentPiece = null;

  if (!ok) {
    handleLifeLost(state);
    return;
  }

  startCascadeSequence(state, wasDropOrFreefall, wildcardTargetColor);
}

// ===========================================
// MATCH FINDING & CASCADES
// ===========================================

type CascadeStepResult = {
  cellsToClear: Cell[];
  removedCount: number;
  scoreDelta: number;
  cascadeIndex: number;
  hasOnyx: boolean;
};

const DIRECTIONS: Cell[] = [
  { col: 1, row: 0 }, // horizontal
  { col: 0, row: 1 }, // vertical
  { col: 1, row: 1 }, // diagonal /
  { col: 1, row: -1 }, // diagonal \
];

function isStartOfRun(
  board: number[][],
  col: number,
  row: number,
  dir: Cell
): boolean {
  const value = board[col][row];
  if (!value) {
    return false;
  }

  const prevCol = col - dir.col;
  const prevRow = row - dir.row;
  if (
    prevCol < 0 ||
    prevCol >= BOARD_COLS ||
    prevRow < 0 ||
    prevRow >= BOARD_ROWS
  ) {
    return true;
  }

  const prevValue = board[prevCol][prevRow];
  if (!prevValue) {
    return true;
  }

  if (
    prevValue === JEWEL_WILDCARD_ID ||
    value === JEWEL_WILDCARD_ID ||
    prevValue === value
  ) {
    return false;
  }
  return true;
}

function collectRun(
  board: JewelId[][],
  startCol: number,
  startRow: number,
  dir: Cell
): { cells: Cell[]; baseColor: JewelId | null } {
  const cells: Cell[] = [];
  let baseColor: JewelId | null = null;

  let col = startCol;
  let row = startRow;

  while (
    col >= 0 &&
    col < BOARD_COLS &&
    row >= 0 &&
    row < BOARD_ROWS &&
    board[col][row]
  ) {
    const value = board[col][row];
    if (baseColor === null) {
      baseColor = value;
    } else if (value !== baseColor) {
      break;
    }
    cells.push({ col, row });

    col += dir.col;
    row += dir.row;
  }

  return { cells, baseColor };
}

function updateActiveJewelPalette(state: InternalGameState) {
  let target = INITIAL_ACTIVE_JEWEL_ID; // 6
  if (state.score.currentScore >= UNLOCK_JEWEL_8_SCORE) {
    target = 8;
  } else if (state.score.currentScore >= UNLOCK_JEWEL_7_SCORE) {
    target = 7;
  }
  if (target !== state.score.activeMaxJewelId) {
    state.score.activeMaxJewelId = target;
  }
}

function applyProgressAndBonuses(
  state: InternalGameState,
  removedCount: number,
  addedScore: number
) {
  state.score.currentScore += addedScore;
  state.score.totalCleared += removedCount;

  // Rest / level progression – 50 jewels per level
  let remaining = removedCount;
  while (remaining > 0) {
    if (state.score.rest > remaining) {
      state.score.rest -= remaining;
      remaining = 0;
    } else {
      remaining -= state.score.rest;
      if (state.score.level < 20) {
        state.score.level = (state.score.level + 1) as Level;
      }
      state.score.rest = JEWELS_PER_LEVEL;
    }
  }

  // Extra life at 100,000 points
  if (
    state.score.currentScore / EXTRA_LIFE_SCORE_THRESHOLD - 1 >
    state.score.extraLifesAwarded
  ) {
    state.score.lives += 1;
    state.score.extraLifesAwarded++;
  }

  updateActiveJewelPalette(state);
}

function findMatchesAndPrepareCascadeStep(
  state: InternalGameState,
  cascadeIndex: number,
  wildcardTargetColor: JewelId | null
): CascadeStepResult | null {
  const isFirstStep = cascadeIndex === 1;
  const board = state.board;
  const cellMap = new Map<string, Cell>();
  let hasOnyxRowOnGround = 0;

  // Directional runs
  for (const dir of DIRECTIONS) {
    for (let col = 0; col < BOARD_COLS; col++) {
      for (let row = 0; row < BOARD_ROWS; row++) {
        if (!isStartOfRun(board, col, row, dir)) {
          continue;
        }
        const { cells, baseColor } = collectRun(board, col, row, dir);
        if (baseColor !== null && cells.length >= 3) {
          for (const cell of cells) {
            const key = `${cell.col}:${cell.row}`;
            cellMap.set(key, cell);
          }
          if (baseColor === JEWEL_ONYX_ID && row === 0 && dir.row === 0) {
            hasOnyxRowOnGround = 1;
          }
        }
      }
    }
  }

  // Wildcard global clear (first cascade only)
  if (isFirstStep && wildcardTargetColor !== null) {
    const wildcardCells: Cell[] = [];
    for (let col = 0; col < BOARD_COLS; col++) {
      for (let row = 0; row < BOARD_ROWS; row++) {
        const value = board[col][row];
        if (value === wildcardTargetColor || value === JEWEL_WILDCARD_ID) {
          wildcardCells.push({ col, row });
        }
      }
    }
    for (const cell of wildcardCells) {
      const key = `${cell.col}:${cell.row}`;
      cellMap.set(key, cell);
    }
  }

  if (!cellMap.size) {
    return null;
  }

  // Aggregate unique cells and compute score
  const cellsToClear = [...cellMap.values()];
  const onyxCount = cellsToClear.reduce((count, cell) => {
    if (board[cell.col][cell.row] === JEWEL_ONYX_ID) {
      return count + 1;
    }
    return count;
  }, 0);

  const scoreDelta =
    (SCORE_MATCH_BASE +
      SCORE_MATCH_EXTRA_PER_JEWEL * Math.max(0, cellMap.size - 3)) *
      cascadeIndex +
    SCORE_ONYX_BONUS_PER_JEWEL * onyxCount +
    SCORE_ONYX_BONUS_PER_ROW_ON_GROUND * hasOnyxRowOnGround;

  const removedCount = cellsToClear.length;

  return {
    cellsToClear,
    removedCount,
    scoreDelta,
    cascadeIndex,
    hasOnyx: onyxCount > 0,
  };
}

const CLEAR_SOUNDS = [
  'clear0',
  'clear1',
  'clear2',
  'clear3',
  'clear4',
  'clear5',
] as const;

function pushClearSound(state: InternalGameState, hasOnyx: boolean) {
  if (hasOnyx) {
    state.events.push('clearOnyx');
  } else {
    const idx = Math.floor(Math.random() * CLEAR_SOUNDS.length);
    state.events.push(CLEAR_SOUNDS[idx]);
  }
}

function startCascadeSequence(
  state: InternalGameState,
  wasDropOrFreefall: boolean,
  wildcardTargetColor: JewelId | null
) {
  const firstStep = findMatchesAndPrepareCascadeStep(
    state,
    1,
    wildcardTargetColor
  );
  if (!firstStep) {
    afterCascadeSequenceFinished(state);
    return;
  }

  state.rowClearing.cellsToClear = firstStep.cellsToClear;
  state.rowClearing.clearAnimStartTime = state.tick.count;
  state.rowClearing.clearAnimData = {
    removedCount: firstStep.removedCount,
    scoreDelta: firstStep.scoreDelta,
    cascadeIndex: firstStep.cascadeIndex,
    wasDropOrFreefall,
    hasOnyx: firstStep.hasOnyx,
  };
}

function collapseBoardColumns(state: InternalGameState) {
  for (let col = 0; col < BOARD_COLS; col++) {
    let writeRow = 0;
    for (let row = 0; row < BOARD_ROWS; row++) {
      const value = state.board[col][row];
      if (value) {
        if (writeRow !== row) {
          state.board[col][writeRow] = value;
          state.board[col][row] = 0;
        }
        writeRow++;
      }
    }
  }
}

/** Called once at the end of the blink phase: remove cells and apply gravity. */
function removeClearedCells(state: InternalGameState) {
  const hasOnyx = state.rowClearing.clearAnimData?.hasOnyx ?? false;
  pushClearSound(state, hasOnyx);

  for (const { col, row } of state.rowClearing.cellsToClear) {
    if (col >= 0 && col < BOARD_COLS && row >= 0 && row < BOARD_ROWS) {
      state.board[col][row] = 0;
    }
  }
  collapseBoardColumns(state);
}

/** Called after the settle pause: check for cascading matches or spawn next piece. */
function finishCascadeStep(state: InternalGameState) {
  if (!state.rowClearing.clearAnimData) {
    return;
  }

  const { cascadeIndex, wasDropOrFreefall, removedCount, scoreDelta } =
    state.rowClearing.clearAnimData;

  applyProgressAndBonuses(state, removedCount, scoreDelta);

  state.rowClearing.cellsToClear = [];
  state.rowClearing.clearAnimData = null;

  const nextStep = findMatchesAndPrepareCascadeStep(
    state,
    cascadeIndex + 1,
    null
  );
  if (!nextStep) {
    afterCascadeSequenceFinished(state);
    return;
  }

  state.rowClearing.cellsToClear = nextStep.cellsToClear;
  state.rowClearing.clearAnimStartTime = state.tick.count;
  state.rowClearing.clearAnimData = {
    removedCount: nextStep.removedCount,
    scoreDelta: nextStep.scoreDelta,
    cascadeIndex: nextStep.cascadeIndex,
    wasDropOrFreefall,
    hasOnyx: nextStep.hasOnyx,
  };
}

// ===========================================
// MOVEMENT FLAGS & INPUT
// ===========================================

function resetMovementFlags(state: InternalGameState) {
  state.movement.pushKeyActive = false;
  state.movement.inFreefall = false;
  state.hardDrop.isHardDropping = false;
}

function rotateTripletForward(piece: Piece) {
  const [bottom, middle, top] = piece.jewels;
  piece.jewels = [middle, top, bottom];
}

function handleKeyDown(state: InternalGameState, key: string) {
  key = key.toLowerCase();

  // Block all input during hard drop, clear animation, or life-lost animation
  if (
    state.hardDrop.isHardDropping ||
    state.rowClearing.cellsToClear.length ||
    state.lifeLost.active
  ) {
    return;
  }

  if (state.currentPiece) {
    // Single rotate key (K): use forward rotation
    if (key === 'k' || key === 'arrowup') {
      rotateTripletForward(state.currentPiece);
    }

    // Move left (J / ArrowLeft)
    if (key === 'j' || key === 'arrowleft') {
      tryMovePieceHorizontal(state, -1);
    }

    // Move right (L / ArrowRight)
    if (key === 'l' || key === 'arrowright') {
      tryMovePieceHorizontal(state, 1);
    }
  }

  // Hard drop (Space or ArrowDown) — instant, no animation
  if ((key === ' ' || key === 'arrowdown') && state.currentPiece) {
    const dropToRow = getHardDropBottomRow(state);
    const rowsFallen = state.currentPiece.bottomRow - dropToRow;
    state.currentPiece.bottomRow = dropToRow;
    state.pendingDropScore += rowsFallen * SCORE_DROP_PER_ROW;

    state.timing.lastDropTime = state.tick.count;
    lockPiece(state, true);
  }
}
