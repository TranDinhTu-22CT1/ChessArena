// Retire previous AI chat archives without touching settings or human support tickets.
export function clearLegacyAiChats(storage) {
  try {
    const keys=[];
    for(let index=0;index<storage.length;index++){
      const key=storage.key(index);
      if(key?.startsWith('chessarena.ai-coach.v'))keys.push(key);
    }
    keys.forEach(key=>storage.removeItem(key));
  }catch{/* Browser storage may be disabled. Conversation state never uses it. */}
}
