import { CHESS_PLAYERS } from '../data/chessPlayers.js';
import { normalizeKnowledgeText as norm } from './chessKnowledge.js';
import { knowledgeReply, resolveCoachKnowledge } from './coachKnowledge.js';
import { withoutGreeting } from './coachConversation.js';
import { listAnswer } from './coachPlayerLists.js';

const players = new Map(CHESS_PLAYERS.filter(p => p.fideId && p.gmYear && !p.died).map(p => [p.fideId, p]));
const countries = ['', ...new Set([...players.values()].map(p => norm(p.country)))];
const genders = ['', 'nu', 'male'];
const keyOf = value => `${value.country}|${value.gender}`;
const counts = {mot:1,hai:2,ba:3,bon:4,nam:5,sau:6,bay:7,tam:8,chin:9,muoi:10,nhat:1,tu:4};
const textOf = question => norm(withoutGreeting(question));
const acknowledgement = text => /^(?:cam on(?: ban| nhieu)?|thanks|ok|okay|vang|da|hieu roi)(?: nhe| nha)?$/.test(text);
const fresh = () => ({version:1, seen:{}, last:null});

// This is a bounded selection preference, NOT authentication or factual evidence.
// Browser-provided names, biography text, titles and URLs are never accepted.
export function sanitizePlayerListState(value) {
  const state = fresh();
  if (!value || typeof value !== 'object' || value.version !== 1) return state;
  const ids = list => Array.isArray(list) ? [...new Set(list.slice(0, players.size).filter(id => typeof id === 'string' && players.has(id)))] : [];
  for (const country of countries) for (const gender of genders) {
    const key = keyOf({country,gender});
    const selected = ids(value.seen?.[key]);
    if (selected.length) state.seen[key] = selected;
  }
  const last = value.last;
  if (last && countries.includes(last.country) && genders.includes(last.gender)
      && Number.isInteger(last.requested) && last.requested >= 1 && last.requested <= 1e6) {
    const selected = ids(last.ids).filter(id => {
      const p = players.get(id);
      return (!last.country || norm(p.country) === last.country)
        && (!last.gender || p.gender === (last.gender === 'nu' ? 'female' : 'male'));
    });
    state.last = {country:last.country,gender:last.gender,requested:last.requested,ids:selected};
  }
  return state;
}

function followup(text) {
  if (/^(?:ke them|con ai nua|tiep tuc danh sach|nguoi khac|mot nguoi khac|doi nguoi khac|ten khac|another one|someone else)$/.test(text)) return {kind:'next'};
  const more = text.match(/^(?:ke |cho toi |cho minh )?them (\d+|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi|vai) (?:nguoi|ky thu|gm|dai kien tuong)(?: nua| khac)?$/);
  if (more) return {kind:'next',count:more[1] === 'vai' ? 3 : counts[more[1]] ?? Number(more[1])};
  const filter = text.match(/^con (?:o )?(.+?)(?: thi sao)?$/);
  return filter ? {kind:'filter',value:filter[1]} : null;
}

function requestList(question, state) {
  const operation = followup(textOf(question));
  let query = withoutGreeting(question);
  if (operation) {
    if (!state.last) return null;
    const last = state.last;
    const gender = operation.kind === 'filter' && ['nu','nam'].includes(operation.value)
      ? operation.value === 'nu' ? 'nu' : 'male' : last.gender;
    const country = operation.kind === 'filter' && !['nu','nam'].includes(operation.value) ? operation.value : last.country;
    query = `ke ten ${operation.count ?? last.requested} ${gender} gm ${country}`;
  }
  // Parse/validate all requested qualifiers before applying seen-ID preferences.
  const base = listAnswer(query);
  if (!base) return null;
  if (!base.playerList) return {...base, playerListState:{...state,last:null}};
  const {requested,country,gender} = base.playerList;
  const key = keyOf({country,gender});
  const seen = state.seen[key] || [];
  const reply = listAnswer(query,0,seen);
  const ids = reply.playerList?.ids || [];
  return {...reply, playerListState:{version:1,seen:{...state.seen,[key]:[...new Set([...seen,...ids])]},
    last:{requested:Math.min(requested,1e6),country,gender,ids}}};
}

function reference(question, state) {
  const text = textOf(question);
  const ordinal = text.match(/^(?:nguoi|ky thu) (?:(?:thu|so) )?(\d+|nhat|hai|ba|tu|bon|nam|sau|bay|tam|chin|muoi|dau tien|cuoi cung)(?: |$)/);
  const pronoun = /^(?:ong ay|anh ay|co ay|ba ay|nguoi do)(?: |$)/.test(text);
  if (!ordinal && !pronoun) return null;
  const ids = state.last?.ids || [];
  if (!ids.length) return ordinal ? {reply:knowledgeReply('Mình chưa có danh sách gần nhất để xác định người bạn nói tới. Bạn hãy ghi tên kỳ thủ hoặc yêu cầu một danh sách trước nhé.',[],'clarify')} : null;
  const number = ordinal ? ({'dau tien':1,'cuoi cung':ids.length,...counts}[ordinal[1]] ?? Number(ordinal[1])) : ids.length === 1 ? 1 : 0;
  if (number < 1 || number > ids.length) return {reply:knowledgeReply(`Danh sách vừa rồi có ${ids.length} người. Bạn muốn hỏi về ai?`,[],'clarify',
    {suggestions:ids.slice(0,3).map(id=>`${players.get(id).name} là ai?`)})};
  return {id:ids[number-1]};
}

export function getPlayerListState(messages = [], supplied) {
  if (supplied !== undefined && supplied !== null) return sanitizePlayerListState(supplied);
  // Backwards compatibility: reconstruct only from user requests, never assistant prose.
  let state = fresh();
  for (const message of messages.filter(m => m?.role === 'user').slice(-12)) {
    const question = String(message.content || '').slice(0,900);
    const result = requestList(question,state);
    if (result) { state = result.playerListState; continue; }
    const ref = reference(question,state);
    if (ref?.id) state = {...state,last:{...state.last,ids:[ref.id]}};
    else if (!acknowledgement(textOf(question))) state = {...state,last:null};
  }
  return state;
}

export function continuePlayerListState(question,state) {
  return acknowledgement(textOf(question)) ? state : {...state,last:null};
}

export function contextualPlayerListReply(question,{messages = [],playerListState} = {}) {
  return requestList(question,getPlayerListState(messages,playerListState));
}

export function contextualPlayerReferenceReply(question,{messages = [],playerListState} = {}) {
  const state = getPlayerListState(messages,playerListState);
  const ref = reference(question,state);
  if (ref?.reply) return {...ref.reply,playerListState:state};
  if (!ref?.id) return null;
  const reply = resolveCoachKnowledge(`${question} (${players.get(ref.id).name})`);
  return reply ? {...reply,playerListState:{...state,last:{...state.last,ids:[ref.id]}}} : null;
}
