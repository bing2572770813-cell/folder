const MUSIC = new Set(['opening-bgm', 'level23-bgm', 'level45-bgm', 'level67-bgm', 'ending-bgm']);

export function createAudioSystem(assets = {}) {
  const sounds = new Map();
  let music = null;
  let musicName = null;
  let muted = false;
  let volume = .7;
  const source = name => assets[name];
  function audio(name, loop = false) {
    const uri = source(name);
    if (!uri || typeof Audio === 'undefined') return null;
    const item = new Audio(uri);
    item.preload = 'auto';
    item.loop = loop;
    item.volume = muted ? 0 : volume * (MUSIC.has(name) ? 1 : .5);
    return item;
  }
  function play(name) {
    if (muted) return;
    const item = audio(name);
    if (!item) return;
    item.play().catch(() => {});
  }
  function playMusic(name) {
    if (!MUSIC.has(name) || musicName === name) return;
    music?.pause();
    music = audio(name, true);
    musicName = music ? name : null;
    if (!music) return;
    if (!muted) music.play().catch(() => {});
  }
  function stopMusic() { music?.pause(); music = null; musicName = null; }
  function setMuted(next) {
    muted = !!next;
    if (music) { music.volume = muted ? 0 : volume; if (!muted) music.play().catch(() => {}); }
  }
  function setVolume(next) {
    volume = Math.max(0, Math.min(1, Number(next) || 0));
    if (music) music.volume = muted ? 0 : volume;
  }
  return { play, playMusic, stopMusic, setMuted, setVolume, isMuted: () => muted };
}
