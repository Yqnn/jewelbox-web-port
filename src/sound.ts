// ===========================================
// AUDIO SYSTEM
// ===========================================

// Music: intro (played once) then loop. Each entry is [segmentId, repeatCount].
const MUSIC_INTRO: [string, number][] = [
  ['1000', 4],
  ['1001', 4],
  ['1002', 4],
  ['1000', 5],
  ['1001', 3],
];
const MUSIC_LOOP: [string, number][] = [
  ['1003', 1],
  ['1002', 4],
  ['1000', 4],
  ['1001', 4],
];

function buildSequence(pairs: [string, number][]): string[] {
  const out: string[] = [];
  for (const [id, count] of pairs) {
    for (let i = 0; i < count; i++) out.push(id);
  }
  return out;
}

const INTRO_SEQUENCE = buildSequence(MUSIC_INTRO);
const LOOP_SEQUENCE = buildSequence(MUSIC_LOOP);

const MUSIC_CONFIG = {
  prefix: 'snd',
  segmentIds: ['1000', '1001', '1002', '1003'],
  folder: 'sounds',
};

const SOUND_FILES = {
  clear0: 'sounds/snd_4000.wav',
  clear1: 'sounds/snd_4002.wav',
  clear2: 'sounds/snd_4003.wav',
  clear3: 'sounds/snd_4004.wav',
  clear4: 'sounds/snd_4005.wav',
  clear5: 'sounds/snd_4006.wav',
  clearOnyx: 'sounds/snd_5004.wav',
  highscore: 'sounds/snd_5003.wav',
  gameOver: 'sounds/snd_5005.wav',
  lifeLost: 'sounds/snd_5005.wav',
  wildcard: 'sounds/snd_3001.wav',
  intro: 'sounds/snd_100.wav',
};
export type Sound = keyof typeof SOUND_FILES;

export const initSound = async (
  isMusicOn: boolean,
  isSoundOn: boolean
): Promise<{
  playSound: (name: Sound) => void;
  startMusic: () => Promise<void>;
  stopMusic: () => void;
  getIsPlaying: () => boolean;
  toggleMusic: () => boolean;
  toggleSound: () => boolean;
} | null> => {
  try {
    // Audio
    const audioContext: AudioContext = new window.AudioContext({
      latencyHint: 'interactive',
    });
    const sounds: Partial<Record<Sound, AudioBuffer>> = {};

    // State: segment cache by id, then intro/loop sequence indices
    let segmentCache: Record<string, AudioBuffer | null> = {};
    let phase: 'intro' | 'loop' = 'intro';
    let sequenceIndex = 0;
    let musicSource: AudioBufferSourceNode | null = null;
    let musicGainNode: GainNode | null = null;
    let gMusicOn = isMusicOn;
    let gSoundOn = isSoundOn;
    let isPlaying = false;

    async function loadMusicSegments() {
      segmentCache = {};
      for (const segId of MUSIC_CONFIG.segmentIds) {
        try {
          const response = await fetch(
            `${MUSIC_CONFIG.folder}/${MUSIC_CONFIG.prefix}_${segId}.wav`
          );
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          segmentCache[segId] = audioBuffer;
        } catch (e) {
          console.log(`Failed to load music segment: ${segId}`, e);
          segmentCache[segId] = null;
        }
      }
    }

    async function startMusic() {
      if (!gMusicOn) return;
      if (Object.keys(segmentCache).length === 0) {
        await loadMusicSegments();
      }
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      phase = 'intro';
      sequenceIndex = 0;
      isPlaying = true;
      playMusicSegment();
    }

    function playMusicSegment() {
      if (!isPlaying || !gMusicOn) return;

      const sequence = phase === 'intro' ? INTRO_SEQUENCE : LOOP_SEQUENCE;
      if (sequenceIndex >= sequence.length) {
        if (phase === 'intro') {
          phase = 'loop';
          sequenceIndex = 0;
        } else {
          sequenceIndex = 0;
        }
        playMusicSegment();
        return;
      }

      const segmentId = sequence[sequenceIndex];
      const buffer = segmentCache[segmentId] ?? null;
      sequenceIndex++;

      if (!buffer) {
        playMusicSegment();
        return;
      }

      if (musicSource) {
        try {
          musicSource.onended = null;
          musicSource.stop();
        } catch {
          /**/
        }
      }

      musicSource = audioContext.createBufferSource();
      musicSource.buffer = buffer;
      musicGainNode = audioContext.createGain();
      musicGainNode.gain.value = 0.3;

      musicSource.connect(musicGainNode);
      musicGainNode.connect(audioContext.destination);

      musicSource.onended = () => {
        if (isPlaying && gMusicOn) {
          playMusicSegment();
        }
      };

      musicSource.start(0);
    }

    function stopMusic() {
      isPlaying = false;
      if (musicSource) {
        try {
          musicSource.onended = null;
          musicSource.stop();
        } catch {
          /**/
        }
        musicSource = null;
      }
    }

    function toggleMusic() {
      gMusicOn = !gMusicOn;
      if (!gMusicOn) {
        stopMusic();
      } else {
        startMusic();
      }
      return gMusicOn;
    }

    function toggleSound() {
      gSoundOn = !gSoundOn;
      return gSoundOn;
    }

    function playSound(name: Sound) {
      if (!audioContext || !sounds[name] || !gSoundOn) return;

      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const source = audioContext.createBufferSource();
      source.buffer = sounds[name];

      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.5;

      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      source.start(0);
    }

    async function initAudio() {
      const names = Object.keys(SOUND_FILES) as Sound[];

      for (const name of names) {
        try {
          const path = SOUND_FILES[name];
          const response = await fetch(path);
          if (!response.ok) continue;
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
          sounds[name] = audioBuffer;
        } catch {
          // Missing or undecodable file — skip silently
        }
      }

      // Load default music
      await loadMusicSegments();
    }

    await initAudio();

    return {
      playSound,
      startMusic,
      stopMusic,
      getIsPlaying: () => isPlaying,
      toggleMusic,
      toggleSound,
    };
  } catch (e) {
    console.error('Failed to initialize audio', e);
    return null;
  }
};
