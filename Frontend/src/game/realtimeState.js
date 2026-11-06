export function mergeOnlineChatMessages(current, incoming) {
  const byId = new Map((current || []).map((message) => [String(message.id), message]));
  for (const message of Array.isArray(incoming) ? incoming : [incoming]) {
    if (message?.id != null) byId.set(String(message.id), message);
  }
  return [...byId.values()]
    .sort((left, right) => Date.parse(left.createdAt || 0) - Date.parse(right.createdAt || 0)
      || String(left.id).localeCompare(String(right.id)))
    .slice(-100);
}

export function chooseNewestGameSnapshot(current, incoming) {
  if (!incoming) return current;
  if (!current || current.id !== incoming.id) return incoming;
  const currentVersion = Number(current.stateVersion || 0);
  const incomingVersion = Number(incoming.stateVersion || 0);
  if (currentVersion && incomingVersion) {
    if (incomingVersion < currentVersion) return current;
    if (incomingVersion > currentVersion) return incoming;
  }
  const currentPly = current.moves?.length || 0;
  const incomingPly = incoming.moves?.length || 0;
  if (incomingPly < currentPly) return current;
  const currentUpdatedAt = Date.parse(current.updatedAt || '');
  const incomingUpdatedAt = Date.parse(incoming.updatedAt || '');
  if (incomingPly === currentPly && Number.isFinite(currentUpdatedAt)
    && Number.isFinite(incomingUpdatedAt) && incomingUpdatedAt < currentUpdatedAt) return current;
  return incoming;
}

