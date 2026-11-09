// Uses synthetic questions only. Never prints credentials, headers, or user conversations.
import assert from 'node:assert/strict';
import { answerCoachQuestion } from '../src/lib/coachAnswer.js';
import { selectCoachKnowledge } from '../src/lib/coachProvider.js';

const basic = await answerCoachQuestion('Chào bạn', { select: async () => null });
assert.equal(basic.knowledge.status, 'conversation');
console.log('Local conversation: OK');
if (process.argv.includes('--providers')) {
  const statuses=[];
  const reply=await selectCoachKnowledge('Tôi cứ tốn rất nhiều phút chỉ để lựa chọn một nước rồi phải đi vội lúc đồng hồ gần cạn. Nên sửa thói quen này ra sao?', {
    signal:AbortSignal.timeout(19000),
    fetcher:async(url,options)=>{
      const host=new URL(url).hostname;
      try {
        const response=await fetch(url,options);
        statuses.push({host,status:response.status});return response;
      }catch(error){statuses.push({host,error:error.name});throw error;}
    }
  });
  console.log(JSON.stringify({statuses,model:reply?.model||null,topics:reply?.knowledgeTopics||[],status:reply?.knowledge.status||'no_match'}));
  if (!reply) process.exitCode=1;
}
