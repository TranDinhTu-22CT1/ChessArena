import { apiUrl } from './config';

export async function askAiCoach({ question, messages = [], context = {} }) {
  const response = await fetch(apiUrl('/api/ai/coach-chat'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, messages, context })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'AI coach request failed.');
  }
  return data;
}
