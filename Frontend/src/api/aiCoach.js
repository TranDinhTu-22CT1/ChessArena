import { apiUrl, handleApiSession } from './config';
import { apiFetch } from './request';

export async function askAiCoach({ question, messages = [], context = {}, signal }) {
  const response = await apiFetch(apiUrl('/api/ai/coach-chat'), {
    timeoutMs: 22000,
    method: 'POST',
    credentials: 'include',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, messages, context })
  });
  handleApiSession(response);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'AI coach request failed.');
  }
  return data;
}
