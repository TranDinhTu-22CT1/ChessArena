import { resolveCoachKnowledge } from './coachKnowledge.js';
import { answerBoardQuestion, isBoardQuestion } from './coachBoardAnswer.js';
import { selectCoachKnowledge } from './coachProvider.js';
import { conversationReply, followupReply, guidedFallback, suggestedQuestions, withoutGreeting } from './coachConversation.js';
import { contextualPlayerListReply as playerListReply, contextualPlayerReferenceReply as playerListReferenceReply,
  getPlayerListState, continuePlayerListState } from './coachPlayerContext.js';
import { scopeReply, sensitiveCoachReply } from './coachScope.js';

export async function answerCoachQuestion(question,options={}) {
  const state = getPlayerListState(options.messages,options.playerListState);
  const reply = await answerCoachTurn(question,{...options,playerListState:state});
  return {...reply,playerListState:reply.playerListState ?? continuePlayerListState(question,state)};
}

async function answerCoachTurn(question,{messages=[],playerListState,gameContext={},websiteSettings={},viewer={},signal,select=selectCoachKnowledge,answerBoard=answerBoardQuestion}={}) {
  signal?.throwIfAborted();
  const sensitive = sensitiveCoachReply(question);
  if (sensitive) return sensitive;
  // Handle separate short questions explicitly, without splitting FEN/PGN or board analysis.
  const parts = question.split(/[?\n]+/).map(part => part.trim()).filter(Boolean);
  if (parts.length > 1 && parts.length <= 3 && !gameContext.hasBoardContext && !/\b(FEN|PGN)\b|\d+\./i.test(question)) {
    const replies = [], history = [...messages];
    let listState = playerListState;
    for (const part of parts) {
      replies.push(await answerCoachQuestion(part, { messages:history, playerListState:listState, gameContext, websiteSettings, viewer, signal, select, answerBoard }));
      listState = replies.at(-1).playerListState;
      history.push({ role:'user', content:part });
    }
    const last = replies.at(-1);
    return { ...last, answer:replies.map((result,i)=>`${i+1}. ${parts[i]}\n${result.answer}`).join('\n\n'),
      sources:[...new Map(replies.flatMap(result=>result.sources||[]).map(source=>[source.url||source.title,source])).values()].slice(0,4),
      knowledge:{...last.knowledge,status:replies.find(result=>['unavailable','insufficient','clarify'].includes(result.knowledge?.status))?.knowledge.status||last.knowledge.status} };
  }
  const scoped = scopeReply(question);
  if (scoped) return scoped;
  const conversation = conversationReply(question, { gameContext, viewer });
  if (conversation) return conversation;
  question = withoutGreeting(question);
  const greetedScope = scopeReply(question);
  if (greetedScope) return greetedScope;
  const greeted = conversationReply(question, { gameContext, viewer });
  if (greeted) return greeted;
  const listReference = playerListReferenceReply(question, { messages, playerListState });
  if (listReference) return listReference;
  const listed = playerListReply(question, { messages, playerListState });
  if (listed) return listed;
  const followup = followupReply(question, { messages, gameContext });
  if (followup) return followup;
  const known=resolveCoachKnowledge(question,{messages,gameContext,websiteSettings});
  if(known)return suggestedQuestions(question, known);
  if(isBoardQuestion(question,gameContext))return suggestedQuestions(question, await answerBoard(question,gameContext,{signal}));
  // A vague message should receive a useful clarification even if a provider is offline.
  if (!/[\p{L}\p{N}]/u.test(question) || /^(?:hmm+|[?]+|khong biet|gi vay)$/i.test(question.trim())) return guidedFallback(question);
  let selected;
  try { selected = await select(question, { signal }); }
  catch (error) { if (signal?.aborted) throw error; }
  return suggestedQuestions(question, selected || guidedFallback(question));
}
