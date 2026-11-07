import test from 'node:test';
import assert from 'node:assert/strict';
import {clearLegacyAiChats} from '../src/api/chatSession.js';
test('retiring AI archives removes old accounts and versions while preserving unrelated data',()=>{
  const items=new Map([['chessarena.ai-coach.v3:a','chat'],['chessarena.ai-coach.v2:b','chat'],['theme','dark'],['support-ticket','draft']]);
  const storage={get length(){return items.size;},key:index=>[...items.keys()][index],removeItem:key=>items.delete(key)};
  clearLegacyAiChats(storage);
  assert.deepEqual([...items.keys()],['theme','support-ticket']);
  assert.doesNotThrow(()=>clearLegacyAiChats(null));
});
