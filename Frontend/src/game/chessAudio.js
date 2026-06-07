const SOUND_URLS = {
  move: new URL('../assets/audio/chess/move.wav', import.meta.url).href,
  capture: new URL('../assets/audio/chess/capture.wav', import.meta.url).href,
  check: new URL('../assets/audio/chess/check.wav', import.meta.url).href,
  checkmate: new URL('../assets/audio/chess/checkmate.wav', import.meta.url).href,
  castle: new URL('../assets/audio/chess/castle.wav', import.meta.url).href
};

const decodedBuffers = new Map();
const pendingBuffers = new Map();

function hexBrightness(value) {
  const match = String(value || '').match(/^#([\da-f]{6})$/i);
  if (!match) return 0.5;
  const number = Number.parseInt(match[1], 16);
  const red = (number >> 16) & 255;
  const green = (number >> 8) & 255;
  const blue = number & 255;
  return (red * 0.299 + green * 0.587 + blue * 0.114) / 255;
}

export function chessSoundEvent(move = {}) {
  if (move.san?.includes('#')) return 'checkmate';
  if (move.san?.includes('+')) return 'check';
  if (/[kq]/i.test(move.flags || '') || /^(?:O|0)-(?:O|0)(?:-(?:O|0))?/.test(move.san || '')) {
    return 'castle';
  }
  if (move.captured) return 'capture';
  return 'move';
}

export function chessSoundProfile(pieceSet, theme = {}) {
  const profiles = {
    wood3d: 'wood',
    staunton: 'wood',
    gothic: 'wood',
    metal: 'metal',
    glass: 'crystal',
    space: 'crystal',
    eightBit: 'retro',
    neo: 'classic',
    tournament: 'classic'
  };
  const brightness = (hexBrightness(theme.lightSquare) + hexBrightness(theme.darkSquare)) / 2;
  return {
    type: profiles[pieceSet] || 'classic',
    pitch: 0.96 + brightness * 0.08
  };
}

async function loadSoundBuffer(context, event) {
  const cacheKey = `${context.sampleRate}:${event}`;
  if (decodedBuffers.has(cacheKey)) return decodedBuffers.get(cacheKey);
  if (pendingBuffers.has(cacheKey)) return pendingBuffers.get(cacheKey);

  const pending = fetch(SOUND_URLS[event] || SOUND_URLS.move)
    .then((response) => {
      if (!response.ok) throw new Error(`Sound asset failed with ${response.status}`);
      return response.arrayBuffer();
    })
    .then((bytes) => context.decodeAudioData(bytes))
    .then((buffer) => {
      decodedBuffers.set(cacheKey, buffer);
      pendingBuffers.delete(cacheKey);
      return buffer;
    })
    .catch((error) => {
      pendingBuffers.delete(cacheKey);
      throw error;
    });

  pendingBuffers.set(cacheKey, pending);
  return pending;
}

function profilePlaybackRate(profile) {
  const materialRate = {
    wood: 0.94,
    classic: 1,
    metal: 1.07,
    crystal: 1.13,
    retro: 0.88
  };
  return (materialRate[profile.type] || 1) * (profile.pitch || 1);
}

function eventGain(event) {
  return {
    move: 2.5,
    capture: 2.9,
    castle: 2.75,
    check: 2.85,
    checkmate: 3.05
  }[event] || 2.5;
}

function connectOutput(context, event, profile) {
  const gain = context.createGain();
  const filter = context.createBiquadFilter();
  const limiter = context.createDynamicsCompressor();
  const now = context.currentTime;

  gain.gain.setValueAtTime(eventGain(event), now);
  filter.type = profile.type === 'wood' ? 'lowpass' : profile.type === 'crystal' ? 'highshelf' : 'peaking';
  filter.frequency.setValueAtTime(profile.type === 'wood' ? 4200 : profile.type === 'crystal' ? 2200 : 1100, now);
  filter.Q.setValueAtTime(profile.type === 'metal' ? 1.3 : 0.65, now);
  filter.gain.setValueAtTime(profile.type === 'crystal' ? 2.5 : profile.type === 'metal' ? 1.4 : 0, now);
  limiter.threshold.setValueAtTime(-4, now);
  limiter.knee.setValueAtTime(1, now);
  limiter.ratio.setValueAtTime(18, now);
  limiter.attack.setValueAtTime(0.001, now);
  limiter.release.setValueAtTime(0.1, now);

  gain.connect(filter);
  filter.connect(limiter);
  limiter.connect(context.destination);
  return gain;
}

export function preloadChessSounds(context) {
  if (!context) return Promise.resolve();
  return Promise.allSettled(Object.keys(SOUND_URLS).map((event) => loadSoundBuffer(context, event)));
}

export function playChessSound(context, event, profile = { type: 'classic', pitch: 1 }) {
  if (!context) return;
  if (context.state === 'suspended') context.resume().catch(() => {});

  loadSoundBuffer(context, event)
    .then((buffer) => {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.setValueAtTime(profilePlaybackRate(profile), context.currentTime);
      source.connect(connectOutput(context, event, profile));
      source.start();
    })
    .catch(() => {});
}
