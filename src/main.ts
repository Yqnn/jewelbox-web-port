import './style.css';

import { initSound } from './sound';
import { initSprites } from './sprites';
import { initGame } from './game';
import { initDraw } from './draw';
import { getCanvas, initHandlers, promptPlayerName } from './ui';
import type { Level } from './game.constants';
import { addHighScore, isHighScore, loadHighScores } from './high-scores';
import type { HighScore } from './high-scores';
import { getLayout, type DisplayMode } from './display';
import { initSettings } from './settings';

/**
 * Jewelbox - Accurate Web Port
 * Ported from the original PowerPC Macintosh version
 *
 * This is a faithful recreation of the original game mechanics,
 * matching the exact behavior of GameLogic.c and Main.c
 */

const SCALE = 2;

async function init() {
  // State:
  const { setSetting, settings } = initSettings();

  let highScores: HighScore[] = []; // Array of {name, score, rows, date}
  let lastHighScoreIndex = -1; // Index of player's latest high score entry
  let isShowingHighScores = false; // Whether high scores popup is visible
  let isShowingAbout = false; // Whether about popup is visible
  let isGameInProgress = false;
  let isGamePaused = false;
  let isShowingWelcomeScreen = true; // Show welcome screen until game starts
  let lastFrameTime = 0;
  let introPhase: 'pending' | 'done' = 'done';

  const game = initGame();

  const saveGameState = () => {
    if (isGameInProgress) {
      game.saveState();
      pauseGame();
    }
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      saveGameState();
    }
  });
  document.addEventListener('beforeunload', () => {
    saveGameState();
  });

  const draw = initDraw(
    getCanvas(),
    SCALE,
    game,
    getLayout(settings.displayMode)
  );
  const sprites = await initSprites(SCALE);
  draw.setSprites(sprites);
  const sound = await initSound(settings.isMusicOn, settings.isSoundOn);

  highScores = loadHighScores();

  const pauseGame = () => {
    isGamePaused = true;
    setState('paused');
  };

  const setState = initHandlers({
    initialSettings: settings,
    shouldMobileControlsPreventDefault: () => introPhase === 'done',
    onStart: () => {
      if (isGameInProgress) {
        stopGame();
        return;
      }
      game.start(settings.level);
      isShowingHighScores = false;
      isShowingAbout = false;
      lastFrameTime = performance.now();
      isGameInProgress = true;
      isGamePaused = false;
      isShowingWelcomeScreen = false;
      setState('running');
    },
    onPause: () => {
      if (!isGameInProgress) return;
      if (!isGamePaused) {
        pauseGame();
      } else {
        isGamePaused = false;
        setState('running');
        isShowingHighScores = false;
        isShowingAbout = false;
        lastFrameTime = performance.now();
      }
    },
    onKeyDown: (key) => {
      if (isGameInProgress && !isGamePaused) {
        game.handleKeyDown(key);
      }
    },
    onClick: () => {
      isShowingHighScores = false;
      isShowingAbout = false;
    },
    onToggleMusic: () => {
      setSetting('isMusicOn', sound?.toggleMusic() ?? false);
      return settings.isMusicOn;
    },
    onToggleSound: () => {
      setSetting('isSoundOn', sound?.toggleSound() ?? false);
      return settings.isSoundOn;
    },
    onShowHighScores: () => {
      if (isShowingHighScores) {
        isShowingHighScores = false;
      } else {
        isShowingAbout = false;
        lastHighScoreIndex = -1; // Don't highlight any entry when viewing manually
        isShowingHighScores = true;
        if (isGameInProgress && !isGamePaused) {
          pauseGame();
        }
      }
    },
    onShowAbout: () => {
      if (isShowingAbout) {
        isShowingAbout = false;
      } else {
        isShowingHighScores = false;
        isShowingAbout = true;
        if (isGameInProgress && !isGamePaused) {
          pauseGame();
        }
      }
    },
    onSelectLevel: (level: Level) => {
      setSetting('level', level);
    },
    onSelectDisplay: async (mode: DisplayMode) => {
      setSetting('displayMode', mode);
      draw.setLayout(getLayout(mode));
      await sprites.setDisplayMode();
    },
  });

  const stopGame = () => {
    isGamePaused = false;
    isGameInProgress = false;
    setState('ready');
    if (isHighScore(highScores, game.getScore())) {
      promptPlayerName((playerName) => {
        lastHighScoreIndex = addHighScore(highScores, {
          name: playerName,
          score: game.getScore(),
        });
        isShowingHighScores = true;
      });
      setTimeout(() => {
        sound?.playSound('highscore');
      }, 1000);
    } else {
      lastHighScoreIndex = -1;
      isShowingHighScores = true;
    }
  };

  const mainLoop = (timestamp: number) => {
    const deltaTime = lastFrameTime === 0 ? 0 : timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (isGameInProgress && !isGamePaused) {
      game.tick(deltaTime);
      for (const event of game.getEvents()) {
        sound?.playSound(event);
      }
      game.clearEvents();
      if (game.isGameOver()) {
        if (!isHighScore(highScores, game.getScore())) {
          sound?.playSound('gameOver');
        }
        stopGame();
      }
    }
    draw.drawWindow({
      isShowingHighScores,
      lastHighScoreIndex,
      isShowingWelcomeScreen,
      isShowingAbout,
      isGameInProgress,
      isGamePaused,
      highScores,
      showIntroPicture: introPhase === 'pending' && !isGameInProgress,
    });
    requestAnimationFrame(mainLoop);
  };

  if (game.getCurrentPiece() !== null) {
    isShowingWelcomeScreen = false;
    isGameInProgress = true;
    pauseGame();
  }
  introPhase = 'pending';
  const start = () => {
    if (introPhase === 'pending') {
      introPhase = 'done';
      if (!isGameInProgress) {
        sound?.playSound('intro');
      }
      sound?.startMusic();
    }
  };
  document.addEventListener('click', start, { once: true });
  document.addEventListener('keydown', start, { once: true });

  // Start main loop
  requestAnimationFrame(mainLoop);
}

document.addEventListener('DOMContentLoaded', init);
