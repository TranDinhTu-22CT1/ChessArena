import React from 'react';
import { BOT_CHAT_LINES } from '../data/bots';

export function useBotAssistance({
  activeBotPersona,
  history,
  game,
  playerColor,
  isCoachGame,
  botGameStarted,
  coachSpeechText,
  latestAnalyzedPlayerMoveIndex,
  speakCoachText,
  botOptions,
  stockfishReview
}) {
  const [botChatLine, setBotChatLine] = React.useState(activeBotPersona.chat);
  const botChatHistoryRef = React.useRef([]);
  const botFeedbackPlyRef = React.useRef(0);
  const lastSpokenCoachRef = React.useRef('');

  const sayBotLine = React.useCallback((group = 'playerMove') => {
    const lines = BOT_CHAT_LINES[group] ?? BOT_CHAT_LINES.playerMove;
    const recent = botChatHistoryRef.current.slice(-2);
    const candidates = lines.filter((line) => !recent.includes(line));
    const pool = candidates.length ? candidates : lines;
    const nextLine = pool[Math.floor(Math.random() * pool.length)] ?? activeBotPersona.chat;

    botChatHistoryRef.current = [...botChatHistoryRef.current, nextLine].slice(-4);
    setBotChatLine(nextLine);
  }, [activeBotPersona.chat]);

  const resetBotAssistance = React.useCallback((nextLine = activeBotPersona.chat) => {
    botChatHistoryRef.current = [];
    botFeedbackPlyRef.current = 0;
    lastSpokenCoachRef.current = '';
    setBotChatLine(nextLine);
  }, [activeBotPersona.chat]);

  React.useEffect(() => {
    resetBotAssistance(activeBotPersona.chat);
  }, [activeBotPersona.chat, resetBotAssistance]);

  React.useEffect(() => {
    if (history.length === 0 || game.isGameOver()) return;
    const latest = history.at(-1);
    if (!latest) return;

    if (latest.color === playerColor) {
      sayBotLine('playerMove');
    } else {
      sayBotLine('botMove');
    }
  }, [game, history, history.length, playerColor, sayBotLine]);

  React.useEffect(() => {
    if (!isCoachGame || !botGameStarted || !coachSpeechText) return;
    const speechKey = `${latestAnalyzedPlayerMoveIndex}-${coachSpeechText}`;
    if (lastSpokenCoachRef.current === speechKey) return;
    lastSpokenCoachRef.current = speechKey;
    speakCoachText(coachSpeechText);
  }, [botGameStarted, coachSpeechText, isCoachGame, latestAnalyzedPlayerMoveIndex, speakCoachText]);

  React.useEffect(() => {
    if (!botOptions.moveFeedback || history.length === 0) return;
    const latest = history.at(-1);
    const analysis = stockfishReview[history.length - 1];
    if (botFeedbackPlyRef.current === history.length) return;
    if (!latest || latest.color !== playerColor || !analysis?.tone) return;
    botFeedbackPlyRef.current = history.length;
    sayBotLine(analysis.tone);
  }, [botOptions.moveFeedback, history, history.length, playerColor, sayBotLine, stockfishReview]);

  return {
    botChatLine,
    resetBotAssistance
  };
}
