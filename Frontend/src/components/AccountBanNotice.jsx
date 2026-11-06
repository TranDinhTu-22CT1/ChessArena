import React from 'react';
import { ShieldAlert, Send, RefreshCw, X, CheckCircle2 } from 'lucide-react';
import Modal from './Modal';
import { apiUrl } from '../api/config';
import './account-ban.css';

const date=value=>value?new Date(value).toLocaleString('vi-VN'):'Không đặt thời hạn';
export default function AccountBanNotice({ notice, onClose }) {
  const [message,setMessage]=React.useState('');
  const [appeal,setAppeal]=React.useState(null);
  const [busy,setBusy]=React.useState(false);
  const [error,setError]=React.useState('');
  const controller=React.useRef(null);
  const perform=React.useCallback(async(body)=>{
    controller.current?.abort();
    const task=new AbortController();controller.current=task;setBusy(true);setError('');
    try {
      const response=await fetch(apiUrl('/api/auth/ban-appeal'),{
        method:body?'POST':'GET',signal:task.signal,cache:'no-store',
        headers:{Authorization:`Bearer ${notice.appealToken}`,'Content-Type':'application/json'},
        body:body?JSON.stringify(body):undefined
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error || 'Chưa kết nối được bộ phận hỗ trợ.');
      if(!task.signal.aborted)setAppeal(data.appeal);
    }catch(err){if(!task.signal.aborted)setError(err.message);}
    finally{if(!task.signal.aborted)setBusy(false);}
  },[notice.appealToken]);
  React.useEffect(()=>{perform();return()=>controller.current?.abort();},[perform]);
  const decision=appeal?.context?.decision;
  return <Modal open onClose={onClose} aria-labelledby="account-ban-title" className="account-ban-modal">
    <section className="account-ban-card">
      <button type="button" className="account-ban-close" onClick={onClose} aria-label="Đóng thông báo"><X size={20}/></button>
      <div className="account-ban-icon"><ShieldAlert size={30}/></div>
      <span className="account-ban-eyebrow">THÔNG BÁO TÀI KHOẢN</span>
      <h2 id="account-ban-title">Tài khoản đang bị khóa</h2>
      <p>Bạn chưa thể đăng nhập bằng tài khoản này. Nếu cho rằng có nhầm lẫn, hãy gửi nội dung giải thích để admin xem xét.</p>
      <dl><div><dt>Lý do</dt><dd>{notice.ban.reason}</dd></div><div><dt>Thời điểm khóa</dt><dd>{date(notice.ban.createdAt)}</dd></div><div><dt>Mở lại dự kiến</dt><dd>{date(notice.ban.expiresAt)}</dd></div></dl>
      {appeal ? <div className="account-ban-receipt" role="status"><CheckCircle2 size={22}/><div><strong>{decision==='approved'?'Admin đã duyệt yêu cầu':decision==='rejected'?'Yêu cầu chưa được chấp thuận':'Đã chuyển yêu cầu đến admin'}</strong><p>Mã yêu cầu: #{appeal.id.slice(0,8)}</p><p>{appeal.admin_note || 'Tài khoản vẫn bị khóa trong thời gian chờ xem xét.'}</p>{decision==='approved'&&<p>Hãy đóng thông báo và đăng nhập lại. Các lệnh khóa khác, nếu có, vẫn được kiểm tra.</p>}</div></div>
        : <form onSubmit={event=>{event.preventDefault();if(!busy)perform({message});}}>
          <label htmlFor="ban-appeal-message">Nội dung xin xem xét</label>
          <textarea id="ban-appeal-message" required minLength={20} maxLength={2000} rows={4} value={message} onChange={event=>setMessage(event.target.value)} placeholder="Hãy mô tả sự việc và lý do bạn đề nghị xem xét lại lệnh khóa…"/>
          <small>Gửi yêu cầu không tự gỡ khóa hoặc tạo phiên đăng nhập.</small>
          <button type="submit" disabled={busy||message.trim().length<20}><Send size={16}/>{busy?'Đang xử lý…':'Gửi yêu cầu đến Hỗ trợ'}</button>
        </form>}
      {error&&<p className="account-ban-error" role="alert">{error}</p>}
      {(appeal||error)&&<button className="account-ban-refresh" type="button" onClick={()=>perform()} disabled={busy}><RefreshCw size={16}/>Kiểm tra phản hồi</button>}
    </section>
  </Modal>;
}
