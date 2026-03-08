import type { ChatRequest } from '@/types/assistant';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export async function streamChat(
  request: ChatRequest,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
): Promise<void> {
  const token = localStorage.getItem('access_token');

  try {
    const response = await fetch(`${API_URL}/assistant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      onError(`Request failed with status ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError('No response stream available');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      // Keep the last incomplete part in the buffer
      buffer = parts.pop() || '';

      for (const part of parts) {
        const lines = part.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const dataStr = line.slice(6).trim();
          if (!dataStr) continue;

          try {
            const data = JSON.parse(dataStr);
            if (data.type === 'text_delta') {
              onChunk(data.content);
            } else if (data.type === 'done') {
              onDone();
              return;
            } else if (data.type === 'error') {
              onError(data.content || 'Unknown error');
              return;
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }
    }

    // Stream ended without explicit done signal
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err.message : 'Network error');
  }
}
