export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

export interface ChatRequest {
  message: string;
  conversation_history: { role: string; content: string }[];
  deal_folder_id?: number;
  property_id?: number;
}
