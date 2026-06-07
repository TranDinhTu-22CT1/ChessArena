import React from 'react';
import { chessSoundEvent, chessSoundProfile, playChessSound, preloadChessSounds } from '../game/chessAudio';

export function useGameAudio({ pieceSet = 'neo', theme = {} } = {}) {
  const audioContextRef = React.useRef(null);

  const ensureAudioContext = React.useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
      preloadChessSounds(audioContextRef.current);
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  const playTone = React.useCallback((partials) => {
    const context = ensureAudioContext();
    if (!context) return;

    const now = context.currentTime;
    partials.forEach((partial) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = now + (partial.delay || 0);
      const duration = partial.duration || 0.1;

      oscillator.type = partial.type || 'sine';
      oscillator.frequency.setValueAtTime(partial.from, start);
      oscillator.frequency.exponentialRampToValueAtTime(partial.to || partial.from, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(partial.volume || 0.14, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    });
  }, [ensureAudioContext]);

  const playMoveSound = React.useCallback((move = {}) => {
    playChessSound(
      ensureAudioContext(),
      chessSoundEvent(move),
      chessSoundProfile(pieceSet, theme)
    );
  }, [ensureAudioContext, pieceSet, theme]);

  const playUiSound = React.useCallback((tone = 'tap') => {
    const tones = {
      tap: [{ type: 'triangle', from: 720, to: 520, duration: 0.045, volume: 0.07 }],
      start: [
        { type: 'triangle', from: 420, to: 520, duration: 0.07, volume: 0.1 },
        { type: 'sine', from: 520, to: 680, delay: 0.06, duration: 0.08, volume: 0.09 }
      ],
      error: [{ type: 'sawtooth', from: 190, to: 120, duration: 0.12, volume: 0.08 }]
    };
    playTone(tones[tone] || tones.tap);
  }, [playTone]);

  const speakCoachText = React.useCallback((text) => {
    const cleanText = String(text || '').replace(/\s+/g, ' ').trim();
    if (!cleanText || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang?.toLowerCase().startsWith('vi')) ?? null;
    utterance.lang = 'vi-VN';
    utterance.rate = 1.03;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeech = React.useCallback(() => {
    window.speechSynthesis?.cancel?.();
  }, []);

  return {
    ensureAudioContext,
    playMoveSound,
    playUiSound,
    speakCoachText,
    stopSpeech
  };
}
