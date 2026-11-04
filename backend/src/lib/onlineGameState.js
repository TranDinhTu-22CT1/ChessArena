// Read-through acceleration only. PostgreSQL still atomically validates each
// turn/ply and commits every move before it is sent to either player.
export function createOnlineGameStateCache({ttlMs=30000,maxEntries=200,now=Date.now}={}) {
  const snapshots=new Map();
  const get=id=>{
    const entry=snapshots.get(id);
    if(!entry)return null;
    if(entry.expiresAt<=now()){snapshots.delete(id);return null;}
    return entry.snapshot;
  };
  const remember=(game,moves)=>{
    if(!game?.id || !Array.isArray(moves))return;
    const current=get(game.id);
    if(current && (Number(current.game.state_version)>Number(game.state_version)
      || current.moves.length>moves.length))return;
    snapshots.delete(game.id);
    snapshots.set(game.id,{snapshot:{game,moves},expiresAt:now()+ttlMs});
    while(snapshots.size>maxEntries)snapshots.delete(snapshots.keys().next().value);
  };
  return {get,remember,remove:id=>snapshots.delete(id)};
}
const key=Symbol.for('chessarena.onlineGameState');
export const onlineGameState=globalThis[key] ||= createOnlineGameStateCache();
