import { getSupabaseAdmin } from './supabaseAdmin';

const DEFAULT_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'chessarena';
const MIME_EXTENSIONS = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
  ['video/quicktime', 'mov'],
  ['application/x-chess-pgn', 'pgn'],
  ['text/plain', 'txt']
]);

function safeSegment(value, fallback = 'file') {
  return String(value || fallback)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || fallback;
}

export function parseDataUrl(dataUrl, allowedTypes = MIME_EXTENSIONS.keys()) {
  const match = /^data:([^;,]+);base64,([a-z0-9+/=\r\n]+)$/i.exec(String(dataUrl || '').trim());
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const allowed = allowedTypes instanceof Set ? allowedTypes : new Set(allowedTypes);
  if (!allowed.has(mimeType)) return null;
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length) return null;
  return { mimeType, bytes };
}

export async function uploadDataAsset({
  ownerUserId = null,
  dataUrl,
  mimeType,
  originalName = 'file',
  purpose = 'general',
  maxBytes = 10 * 1024 * 1024
}) {
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error('Supabase Storage is not configured.');

  const parsed = parseDataUrl(dataUrl, new Set([mimeType]));
  if (!parsed) throw new Error('Invalid uploaded file.');
  if (parsed.bytes.length > maxBytes) throw new Error('Uploaded file is too large.');

  const extension = MIME_EXTENSIONS.get(parsed.mimeType) || safeSegment(originalName).split('.').pop() || 'bin';
  const owner = safeSegment(ownerUserId || 'system');
  const folder = safeSegment(purpose, 'general');
  const baseName = safeSegment(String(originalName).replace(/\.[^.]+$/, ''), 'file');
  const objectPath = `${folder}/${owner}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${baseName}.${extension}`;
  const { error } = await supabase.storage
    .from(DEFAULT_BUCKET)
    .upload(objectPath, parsed.bytes, {
      contentType: parsed.mimeType,
      cacheControl: '31536000',
      upsert: false
    });
  if (error) throw error;

  const { data: publicData } = supabase.storage.from(DEFAULT_BUCKET).getPublicUrl(objectPath);
  const publicUrl = publicData?.publicUrl;
  if (!publicUrl) throw new Error('Could not create a public file URL.');

  const asset = {
    owner_user_id: ownerUserId,
    bucket: DEFAULT_BUCKET,
    object_path: objectPath,
    public_url: publicUrl,
    mime_type: parsed.mimeType,
    original_name: String(originalName || 'file').slice(0, 160),
    size_bytes: parsed.bytes.length,
    purpose: folder
  };
  const { data: storedAsset, error: metadataError } = await supabase
    .from('media_assets')
    .insert(asset)
    .select('*')
    .single();
  if (metadataError) {
    await supabase.storage.from(DEFAULT_BUCKET).remove([objectPath]);
    throw metadataError;
  }

  return {
    id: storedAsset.id,
    name: storedAsset.original_name,
    mimeType: storedAsset.mime_type,
    size: storedAsset.size_bytes,
    url: storedAsset.public_url,
    objectPath: storedAsset.object_path,
    createdAt: storedAsset.created_at
  };
}

export async function uploadDataAssets(items, options = {}) {
  const assets = [];
  for (const item of Array.isArray(items) ? items : []) {
    assets.push(await uploadDataAsset({
      ...options,
      dataUrl: item.dataUrl || item.url,
      mimeType: item.mimeType || item.type,
      originalName: item.name || 'file'
    }));
  }
  return assets;
}
