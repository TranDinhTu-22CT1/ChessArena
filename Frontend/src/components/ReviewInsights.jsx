import React from 'react';
import { Activity, GitBranch } from 'lucide-react';
import './review-studio.css';

export function formatEvaluation(score,mate=null) {
  if(mate!=null&&mate!==0)return `${mate>0?'':'−'}M${Math.abs(mate)}`;
  if(!Number.isFinite(score))return '—';
  if(Math.abs(score)>=90000)return score>0?'Trắng chiếu hết':'Đen chiếu hết';
  return `${score>0?'+':''}${(score/100).toFixed(2)}`;
}
export function ReviewTimeline({results,moveCount,selectedPly,onSelect}) {
  const values=Array.from({length:moveCount},(_,i)=>results[i]||null);
  const x=index=>moveCount>1?index/(moveCount-1)*600:300;
  const y=score=>60-Math.tanh(score/450)*47;
  let path='',previous=false;
  values.forEach((item,i)=>{if(!item||!Number.isFinite(item.whiteScore)){previous=false;return;}path+=`${previous?'L':'M'}${x(i)} ${y(item.whiteScore)} `;previous=true;});
  const active=values[selectedPly-1];
  return <section className="review-timeline" aria-label="Diễn biến đánh giá ván đấu">
    <div className="review-section-label"><span><Activity size={14}/>Diễn biến thế trận</span><strong>{active?formatEvaluation(active.whiteScore,active.whiteMate):'Chọn một nước'}</strong></div>
    <svg viewBox="0 0 600 120" role="img" aria-label="Đánh giá từ phía Trắng; phía trên có lợi cho Trắng, phía dưới có lợi cho Đen">
      <rect width="600" height="60" fill="currentColor" opacity=".035"/><path d="M0 60 H600" stroke="currentColor" strokeDasharray="4 6" opacity=".2"/>
      <path d={path} stroke="#507936" strokeWidth="2.5" fill="none"/>
      {values.map((item,index)=>item&&<g key={index} role="button" tabIndex="0" aria-label={`Xem nước ${index+1}: ${item.san}, ${formatEvaluation(item.whiteScore,item.whiteMate)}`} onClick={()=>onSelect(index+1)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(index+1);}}}>
        <rect x={x(index)-Math.max(3,300/Math.max(1,moveCount))} y="0" width={Math.max(6,600/Math.max(1,moveCount))} height="120" fill="transparent"/>
        <circle cx={x(index)} cy={y(item.whiteScore)} r={index+1===selectedPly?5:['blunder','mistake','miss'].includes(item.tone)?3:1.5} fill={['blunder','mistake','miss'].includes(item.tone)?'#e59b7d':'#638645'}/>
      </g>)}
      {active&&<line x1={x(selectedPly-1)} y1="0" x2={x(selectedPly-1)} y2="120" stroke="#e8eee4" opacity=".35" pointerEvents="none"/>}
    </svg>
    <div className="review-chart-caption"><span>Ưu thế Trắng ↑ · Đen ↓</span><span>{moveCount} nửa nước</span></div>
  </section>;
}
export function ReviewVariations({analysis}) {
  if(!analysis)return null;
  const variations=analysis.variations?.length?analysis.variations:[{score:analysis.bestScore,san:analysis.continuationSan||[analysis.bestSan||analysis.bestMove],depth:analysis.depth}];
  return <section className="review-variations"><div className="review-section-label"><span><GitBranch size={14}/>Các biến từ trước nước đi</span><small>Sâu {analysis.depth||'—'}</small></div>
    {variations.map((line,index)=><div className="review-variation" key={index}><b>{formatEvaluation(line.score,line.mate)}</b><p>{line.san?.slice(0,8).join('  →  ')||'Chưa có biến hợp lệ'}</p></div>)}
    <small>Điểm tính theo bên đang đi ở vị trí này. Các biến giả định đối thủ đáp tốt.</small>
  </section>;
}
