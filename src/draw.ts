import { BOARD_COLS, BOARD_ROWS } from './game.constants';
import type { initGame } from './game';
import type { Piece } from './game.constants';
import type { initSprites } from './sprites';
import { HIGH_SCORE_COUNT, type HighScore } from './high-scores';
import type { LayoutConfig } from './display';

export type DrawWindowParams = {
  isShowingHighScores: boolean;
  lastHighScoreIndex: number;
  welcomeScreen?: 'welcome' | 'credits' | 'highscores';
  isShowingAbout: boolean;
  showHelpPage?: 1 | 2 | 3 | 4;
  isGameInProgress: boolean;
  isGamePaused: boolean;
  highScores: HighScore[];
  showIntroPicture: boolean;
};

export const initDraw = (
  canvas: HTMLCanvasElement,
  scale: number,
  game: ReturnType<typeof initGame>,
  initialLayout: LayoutConfig
) => {
  // Mutable scaled dimensions for rendering
  let BLOCK_WIDTH = 0,
    BLOCK_HEIGHT = 0,
    // Mutable scaled positions
    BOARD_X = 0,
    BOARD_Y = 0,
    OVERLAY_X = 0,
    OVERLAY_Y = 0,
    BOARD_WIDTH = 0,
    BOARD_HEIGHT = 0,
    NEXT_X = 0,
    NEXT_Y = 0,
    NEXT_SIZE = 0,
    SCORE_X = [] as number[],
    SCORE_Y = 0;

  function applyLayout(layout: LayoutConfig) {
    BLOCK_WIDTH = layout.BLOCK_SIZE * scale;
    BLOCK_HEIGHT = layout.BLOCK_SIZE * scale;
    BOARD_X = layout.BOARD_X * scale;
    BOARD_Y = layout.BOARD_Y * scale;
    BOARD_WIDTH = BOARD_COLS * BLOCK_WIDTH;
    BOARD_HEIGHT = BOARD_ROWS * BLOCK_HEIGHT;
    NEXT_X = layout.NEXT_X * scale;
    NEXT_Y = layout.NEXT_Y * scale;
    NEXT_SIZE = layout.NEXT_SIZE * scale;
    SCORE_X = layout.SCORE_X.map((x) => x * scale);
    SCORE_Y = layout.SCORE_Y * scale;
    OVERLAY_X = layout.OVERLAY_X * scale;
    OVERLAY_Y = layout.OVERLAY_Y * scale;

    canvas.width = layout.WINDOW_WIDTH * scale;
    canvas.height = layout.WINDOW_HEIGHT * scale;

    // Browsers reset context state on canvas resize
    ctx.imageSmoothingEnabled = false;
  }

  function drawClearingAnimation() {
    if (!game.getClearAnimVisible()) {
      return;
    }
    ctx.fillStyle = '#000000';
    const cells = game.getRowsToClear() as { col: number; row: number }[];
    for (const { col, row } of cells) {
      const x = BOARD_X + col * BLOCK_WIDTH;
      const y = BOARD_Y + (BOARD_ROWS - 1 - row) * BLOCK_HEIGHT;
      ctx.fillRect(x, y, BLOCK_WIDTH, BLOCK_HEIGHT);
    }
  }

  function drawWindow(params: DrawWindowParams) {
    const background = sprites?.getMainSprite('background');
    if (background) {
      ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
    }
    drawNextBox();
    drawBoardArea(params);
    if (!params.showIntroPicture) {
      drawScoreBoxes();
    }
    if (params.isShowingHighScores || params.welcomeScreen === 'highscores') {
      drawHighScoresPopup(params);
    }
    if (params.isShowingAbout) {
      drawImagePopup('about');
    }
    if (params.showHelpPage !== undefined) {
      const helpImages = ['help1', 'help2', 'help3', 'help4'] as const;
      drawImagePopup(helpImages[params.showHelpPage - 1], true);
    }
  }

  function drawNextBox() {
    // Draw next triplet (Jewelbox style)
    const nextPiece = game.getNextPiece() as Piece | null;
    if (nextPiece) {
      const colX = NEXT_X + (NEXT_SIZE - BLOCK_WIDTH) / 2;
      const bottomY = NEXT_Y + NEXT_SIZE - BLOCK_HEIGHT * 3 - 4 * scale; // small padding

      for (let i = 0; i < 3; i++) {
        const jewelId = nextPiece.jewels[i];
        if (!jewelId) {
          continue;
        }
        const y = bottomY + (2 - i) * BLOCK_HEIGHT;
        drawBlockAt(colX, y, jewelId);
      }
    }
  }

  function drawBoardArea(params: DrawWindowParams) {
    const { welcomeScreen, isGameInProgress, isGamePaused, showIntroPicture } =
      params;
    if (showIntroPicture) {
      drawStatic('introPicture', false);
      return;
    }
    if (welcomeScreen === 'welcome') {
      drawStatic('welcome');
      return;
    }
    if (welcomeScreen === 'credits') {
      drawStatic('credits');
      return;
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_WIDTH, BOARD_HEIGHT);

    const lifeLost = game.getLifeLostState();
    const showBlankBoard =
      lifeLost !== null && lifeLost.elapsed >= lifeLost.freezeTicks;

    if (!showBlankBoard) {
      drawBoard();
      if (game.getCurrentPiece() && !game.getRowsToClear().length) {
        drawPiece();
      }
      if (game.getRowsToClear().length) {
        drawClearingAnimation();
      }
    }

    if (isGamePaused) {
      drawPauseScreen();
    } else if (!isGameInProgress && game.getCurrentPiece()) {
      drawHighScoresPopup(params);
    }
  }

  function drawScoreBoxes() {
    const values = [
      game.getLives(),
      game.getCurrentLevel(),
      game.getRest(),
      game.getScore(),
    ];

    for (let i = 0; i < values.length; i++) {
      ctx.fillStyle = '#e8fd42';
      ctx.font = `${12 * scale}px Charcoal, sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(String(values[i]), SCORE_X[i], SCORE_Y);
    }
  }

  function drawStatic(
    type: 'welcome' | 'highScores' | 'introPicture' | 'credits',
    isCenteredOnBoard: boolean = true
  ) {
    const image = sprites?.getMainSprite(type);
    if (image?.complete) {
      ctx.drawImage(
        image,
        isCenteredOnBoard
          ? OVERLAY_X
          : (canvas.width - image.width * scale) / 2,
        isCenteredOnBoard
          ? OVERLAY_Y
          : (canvas.height - image.height * scale) / 2,
        image.width * scale,
        image.height * scale
      );
    }
  }

  function drawPauseScreen() {
    const img = sprites?.getPiecesImage(11);
    ctx.fillStyle = '#000000';
    ctx.fillRect(BOARD_X, BOARD_Y, BOARD_WIDTH, BOARD_HEIGHT);
    if (img) {
      ctx.drawImage(
        img,
        BOARD_X + (BOARD_WIDTH - img.width) / 2,
        BOARD_Y + (BOARD_HEIGHT - img.height) / 2,
        img.width,
        img.height
      );
    }
  }

  function drawBoard() {
    const board = game.getGameBoard();
    if (!board) {
      return;
    }
    for (let i = 0; i < BOARD_COLS; i++) {
      if (!board[i]) {
        continue;
      }
      for (let j = 0; j < BOARD_ROWS; j++) {
        const jewelId = board[i][j];
        if (jewelId) {
          drawBlockAt(
            BOARD_X + i * BLOCK_WIDTH,
            BOARD_Y + (BOARD_ROWS - 1 - j) * BLOCK_HEIGHT,
            jewelId
          );
        }
      }
    }
  }

  function drawPiece() {
    const currentPiece = game.getCurrentPiece() as Piece | null;
    if (!currentPiece) {
      return;
    }

    for (let i = 0; i < 3; i++) {
      const jewelId = currentPiece.jewels[i];
      if (!jewelId) {
        continue;
      }

      const boardCol = currentPiece.column;
      const boardRow = currentPiece.bottomRow + i;

      if (
        boardRow >= 0 &&
        boardRow < BOARD_ROWS &&
        boardCol >= 0 &&
        boardCol < BOARD_COLS
      ) {
        drawBlockAt(
          BOARD_X + boardCol * BLOCK_WIDTH,
          BOARD_Y + (BOARD_ROWS - 1 - boardRow) * BLOCK_HEIGHT,
          jewelId
        );
      }
    }
  }

  function drawBlockAt(x: number, y: number, jewelId: number) {
    const spriteIndex = jewelId - 1;
    const piecesImage = sprites?.getPiecesImage(spriteIndex);
    if (piecesImage) {
      ctx.drawImage(piecesImage, x, y, BLOCK_WIDTH, BLOCK_HEIGHT);
    }
  }

  function drawImagePopup(
    imageName: 'about' | 'help1' | 'help2' | 'help3' | 'help4',
    hasClickToSeeNext: boolean = false
  ) {
    const image = sprites?.getMainSprite(imageName);
    if (!image?.complete) {
      return;
    }
    const IMG_WIDTH = image.naturalWidth;
    const IMG_HEIGHT = image.naturalHeight;
    const BORDER_WIDTH = 3;

    let drawW = IMG_WIDTH * scale;
    let drawH = IMG_HEIGHT * scale;
    const BOTTOM_PADDING = hasClickToSeeNext ? 20 * scale : 0;
    let POPUP_WIDTH = drawW + BORDER_WIDTH * 2 * scale;
    let POPUP_HEIGHT = drawH + BORDER_WIDTH * 2 * scale + BOTTOM_PADDING;

    if (POPUP_WIDTH > canvas.width) {
      POPUP_WIDTH = canvas.width;
      POPUP_HEIGHT = (POPUP_WIDTH * IMG_HEIGHT) / IMG_WIDTH + BOTTOM_PADDING;
      drawW = POPUP_WIDTH - BORDER_WIDTH * 2 * scale;
      drawH = POPUP_HEIGHT - BORDER_WIDTH * 2 * scale - BOTTOM_PADDING;
      ctx.imageSmoothingEnabled = true;
    }

    const POPUP_X =
      scale * Math.floor((canvas.width - POPUP_WIDTH) / 2 / scale);
    const POPUP_Y =
      scale * Math.floor((canvas.height - POPUP_HEIGHT) / 2 / scale);

    drawBeveledBorder(POPUP_X, POPUP_Y, POPUP_WIDTH, POPUP_HEIGHT);

    // Draw about image centered
    const CONTENT_X = POPUP_X + BORDER_WIDTH * scale;
    const CONTENT_Y = POPUP_Y + BORDER_WIDTH * scale;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(CONTENT_X, CONTENT_Y, drawW, drawH + BOTTOM_PADDING);
    ctx.drawImage(
      image,
      0,
      0,
      IMG_WIDTH,
      IMG_HEIGHT,
      CONTENT_X,
      CONTENT_Y,
      drawW,
      drawH
    );

    if (hasClickToSeeNext) {
      ctx.fillStyle = '#FF0000';
      ctx.font = `${12 * scale}px Charcoal, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(
        imageName !== 'help4' ? '* Click to see next *' : '* Click to close *',
        POPUP_X + POPUP_WIDTH / 2,
        POPUP_Y + POPUP_HEIGHT - 8 * scale
      );
    }

    ctx.imageSmoothingEnabled = false;
  }

  function drawBeveledBorder(
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 2 * scale, y + 2 * scale, width - scale, height - scale);
    ctx.fillRect(x, y, width, height);

    const borderColors = {
      topLeft: ['#000000', '#BBBBBB', '#FFFFFF'],
      bottomRight: ['#000000', '#555555', '#999999'],
    };

    for (let i = 0; i < 3; i++) {
      const offset = i;

      // Top edge
      ctx.fillStyle = borderColors.topLeft[i];
      ctx.fillRect(
        x + offset * scale,
        y + offset * scale,
        width - offset * 2 * scale,
        scale
      );

      // Left edge
      ctx.fillRect(
        x + offset * scale,
        y + offset * scale,
        scale,
        height - offset * 2 * scale
      );

      // Bottom edge
      ctx.fillStyle = borderColors.bottomRight[i];
      ctx.fillRect(
        x + (offset + 1) * scale,
        y + height - offset * scale - scale,
        width - (offset * 2 + 1) * scale,
        scale
      );

      // Right edge
      ctx.fillRect(
        x + width - offset * scale - scale,
        y + (offset + 1) * scale,
        scale,
        height - (offset * 2 + 1) * scale
      );
    }

    // Let's be pixel perfect
    ctx.fillStyle = borderColors.topLeft[1];
    ctx.fillRect(width + x - 3 * scale, y + 2 * scale, scale, scale);
    ctx.fillRect(x + 2 * scale, height + y - 3 * scale, scale, scale);
  }

  function drawHighScoresPopup({
    isShowingHighScores,
    lastHighScoreIndex,
    highScores,
  }: DrawWindowParams) {
    drawStatic('highScores');

    const ROW_START_Y = OVERLAY_Y + 64 * scale;
    const ROW_HEIGHT = 22 * scale;
    const COL_ID_X = OVERLAY_X + 25 * scale;
    const COL_NAME_X = COL_ID_X + 22 * scale;
    const COL_SCORE_X = COL_NAME_X + 120 * scale;

    // Draw each high score entry
    ctx.font = `${12 * scale}px Charcoal, sans-serif`;

    for (let i = 0; i < HIGH_SCORE_COUNT; i++) {
      const entry = highScores[i];
      const y = ROW_START_Y + (i + 1) * ROW_HEIGHT + 3 * scale;

      if (i === lastHighScoreIndex) {
        ctx.fillStyle = '#FF0000'; // gYellowRGB
      } else {
        ctx.fillStyle = '#e8fd42';
      }

      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}.`, COL_ID_X, y);
      ctx.textAlign = 'left';
      ctx.fillText(`${entry.name}`, COL_NAME_X, y);
      ctx.textAlign = 'left';
      ctx.fillText(String(entry.score), COL_SCORE_X, y);
    }

    if (isShowingHighScores) {
      ctx.fillStyle = '#FF0000';
      ctx.textAlign = 'center';
      ctx.fillText(
        '* Click mouse to continue *',
        BOARD_X + BOARD_WIDTH / 2,
        BOARD_Y + BOARD_HEIGHT
      );
    }
  }

  const ctx = getContext(canvas);
  let sprites: Awaited<ReturnType<typeof initSprites>> | null = null;

  applyLayout(initialLayout);

  // Show loading message
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `${12 * scale}px Charcoal, sans-serif`;
  ctx.fillText('Loading assets...', 20, canvas.height / 2);

  return {
    drawWindow,
    setSprites: (s: Awaited<ReturnType<typeof initSprites>>) => (sprites = s),
    setLayout: applyLayout,
  };
};

function getContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get context');
  }
  return ctx;
}
