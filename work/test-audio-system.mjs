import assert from 'node:assert/strict';
import test from 'node:test';
import {createAudioSystem} from './audio-system.mjs';

const assets={
  'opening-bgm':'data:audio/mpeg;base64,opening',
  'ending-bgm':'data:audio/mpeg;base64,ending',
  footstep:'data:audio/mpeg;base64,step',
};

class FakeAudio {
  static instances=[];
  constructor(src){this.src=src;this.loop=false;this.volume=1;this.paused=true;this.playCount=0;FakeAudio.instances.push(this);}
  play(){this.paused=false;this.playCount++;return Promise.resolve();}
  pause(){this.paused=true;}
}

test('audio system is a no-op when browser Audio is unavailable',()=>{
  const previous=globalThis.Audio;
  try {
    delete globalThis.Audio;
    const audio=createAudioSystem(assets);
    assert.doesNotThrow(()=>audio.play('footstep'));
    assert.doesNotThrow(()=>audio.playMusic('opening-bgm'));
  } finally {
    if(previous)globalThis.Audio=previous;
  }
});

test('audio system plays effects and keeps one looping music track',()=>{
  const previous=globalThis.Audio;
  FakeAudio.instances=[];
  globalThis.Audio=FakeAudio;
  try {
    const audio=createAudioSystem(assets);
    audio.play('footstep');
    assert.equal(FakeAudio.instances.length,1);
    assert.equal(FakeAudio.instances[0].src,assets.footstep);
    audio.playMusic('opening-bgm');
    const opening=FakeAudio.instances[1];
    assert.equal(opening.loop,true);
    audio.playMusic('ending-bgm');
    const ending=FakeAudio.instances[2];
    assert.equal(opening.paused,true);
    assert.equal(ending.src,assets['ending-bgm']);
    assert.equal(ending.loop,true);
    audio.playMusic('ending-bgm');
    assert.equal(FakeAudio.instances.length,3);
  } finally {
    if(previous)globalThis.Audio=previous;else delete globalThis.Audio;
  }
});

test('audio system applies mute and clamped volume to music',()=>{
  const previous=globalThis.Audio;
  FakeAudio.instances=[];
  globalThis.Audio=FakeAudio;
  try {
    const audio=createAudioSystem(assets);
    audio.setVolume(2);
    audio.playMusic('opening-bgm');
    const music=FakeAudio.instances[0];
    assert.equal(music.volume,1);
    audio.setMuted(true);
    assert.equal(audio.isMuted(),true);
    assert.equal(music.volume,0);
    audio.setMuted(false);
    assert.equal(music.volume,1);
    audio.setVolume(-1);
    assert.equal(music.volume,0);
  } finally {
    if(previous)globalThis.Audio=previous;else delete globalThis.Audio;
  }
});
