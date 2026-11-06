import React from 'react';
import { Bot, BookOpen, Swords, UsersRound } from 'lucide-react';

const MODES = {
  bot: { title: 'Chơi với bot', detail: 'Chọn đối thủ. Tìm nhịp chơi của bạn.', Icon: Bot },
  coach: { title: 'Play Coach', detail: 'Luyện cờ cùng hướng dẫn tiếng Việt.', Icon: BookOpen },
  local: { title: 'Chơi cùng máy', detail: 'Hai người, một bàn cờ.', Icon: UsersRound },
  online: { title: 'Chơi online', detail: 'Tìm đối thủ phù hợp hoặc mời bạn bè.', Icon: Swords }
};
export default function PlayPageHeader({ mode, status }) {
  const { title, detail, Icon } = MODES[mode] || MODES.bot;
  return <header className="play-page-header"><span className="play-page-icon"><Icon size={21} /></span><div><h1>{title}</h1><p>{detail}</p></div>{status && <span className="play-page-status">{status}</span>}</header>;
}
