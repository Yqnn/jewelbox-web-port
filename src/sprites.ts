const SPRITES = {
  highScores: 'sprites/pict_5002.png',
  about: 'sprites/pict_5001.png',
  welcome: 'sprites/pict_5000.png',
  introPicture: 'sprites/pict_1999.png',
  background: 'sprites/pict_130.png',
};

export type SpriteKey = keyof typeof SPRITES;

// Pre-rendered piece block images (16x16 canvas for each color)
const ORIGINAL_BLOCK = 24;

const getSpritesForMode = (): Record<SpriteKey, string> => {
  return SPRITES;
};

const initMainSprites = async (): Promise<
  Record<SpriteKey, HTMLImageElement>
> => {
  const promises = Object.entries(getSpritesForMode()).map(([id, sprite]) => {
    return new Promise<[string, HTMLImageElement]>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve([id, image]);
      image.onerror = () => reject(new Error(`Could not load sprite ${id}`));
      image.src = sprite;
    });
  });
  return Object.fromEntries(await Promise.all(promises)) as Record<
    SpriteKey,
    HTMLImageElement
  >;
};

const initPiecesImage = async (scale: number): Promise<HTMLCanvasElement[]> => {
  const srcFile = 'sprites/pict_131.png';
  const srcBlockSize = ORIGINAL_BLOCK;

  return new Promise<HTMLCanvasElement[]>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvases: HTMLCanvasElement[] = [];
      for (let j = 0; j < 12; j++) {
        const blockCanvas = document.createElement('canvas');
        const blockCtx = blockCanvas.getContext('2d');
        if (!blockCtx) {
          reject(new Error(`Could not get context for piece ${j}`));
          return;
        }
        if (j === 11) {
          blockCanvas.width = 130 * scale;
          blockCanvas.height = 44 * scale;
          blockCtx.imageSmoothingEnabled = false;
          blockCtx.drawImage(
            img,
            2,
            243,
            130,
            44,
            0,
            0,
            130 * scale,
            44 * scale
          );
          canvases.push(blockCanvas);
          continue;
        }
        blockCanvas.width = srcBlockSize * scale;
        blockCanvas.height = srcBlockSize * scale;
        blockCtx.imageSmoothingEnabled = false;
        blockCtx.drawImage(
          img,
          28 + j * (srcBlockSize + 2),
          2,
          srcBlockSize,
          srcBlockSize,
          0,
          0,
          srcBlockSize * scale,
          srcBlockSize * scale
        );
        canvases.push(blockCanvas);
      }
      resolve(canvases);
    };
    img.onerror = () => reject(new Error(`Could not load pieces ${srcFile}`));
    img.src = srcFile;
  });
};

export const initSprites = async (scale: number) => {
  const [mainSprites, piecesImages] = await Promise.all([
    initMainSprites(),
    initPiecesImage(scale),
  ]);
  return {
    getMainSprite: (name: SpriteKey) => mainSprites[name],
    getPiecesImage: (index: number) => piecesImages[index],
    setDisplayMode: async () => {
      const [newMain, newPieces] = await Promise.all([
        initMainSprites(),
        initPiecesImage(scale),
      ]);
      for (const key of Object.keys(newMain) as SpriteKey[]) {
        mainSprites[key] = newMain[key];
      }
      piecesImages.splice(0, piecesImages.length, ...newPieces);
    },
  };
};
