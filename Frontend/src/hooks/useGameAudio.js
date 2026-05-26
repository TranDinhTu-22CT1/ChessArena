import React from 'react';

export function useGameAudio() {
  const audioContextRef = React.useRef(null);

  const ensureAudioContext = React.useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  const playMoveSound = React.useCallback(() => {
    const context = ensureAudioContext();
    if (!context) return;

    const now = context.currentTime;
    const gain = context.createGain();
    const tap = context.createOscillator();
    const body = context.createOscillator();

    tap.type = 'triangle';
    body.type = 'sine';
    tap.frequency.setValueAtTime(520, now);
    tap.frequency.exponentialRampToValueAtTime(220, now + 0.035);
    body.frequency.setValueAtTime(140, now);
    body.frequency.exponentialRampToValueAtTime(95, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

    tap.connect(gain);
    body.connect(gain);
    gain.connect(context.destination);
    tap.start(now);
    body.start(now);
    tap.stop(now + 0.12);
    body.stop(now + 0.12);
  }, [ensureAudioContext]);

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
    speakCoachText,
    stopSpeech
  };
}
