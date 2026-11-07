import test from 'node:test';
import assert from 'node:assert/strict';
import { issueAppealToken, verifyAppealToken, findAccountBan, findOnlineProfile } from '../src/lib/banPolicy.js';
test('appeal proof is signed, expires, and only identifies one account and ban',()=>{
  const options={key:'test-key',now:1000};
  const token=issueAppealToken('user-a','ban-a',options);
  assert.equal(verifyAppealToken(token,options).scope,'ban-appeal');
  assert.equal(verifyAppealToken(token,options).banId,'ban-a');
  assert.equal(verifyAppealToken(token,{...options,now:901000}),null);
  assert.equal(verifyAppealToken(token,{...options,key:'wrong'}),null);
  assert.equal(verifyAppealToken(token+'.extra',options),null);
  assert.equal(verifyAppealToken(token.replace('eyJ','eyK'),options),null);
});
test('account status lookup fails closed when the database is unavailable',async()=>{
  const query={};for(const name of ['select','eq','or','order','limit'])query[name]=()=>query;
  query.maybeSingle=async()=>({error:{message:'unavailable'}});
  await assert.rejects(findAccountBan({from:()=>query},'user-a'),{status:503});
  await assert.rejects(findOnlineProfile({from:()=>query},'firebase-a'),{status:503});
});
