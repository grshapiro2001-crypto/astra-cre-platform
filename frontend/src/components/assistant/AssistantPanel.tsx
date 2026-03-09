import { useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAssistantStore } from '@/store/assistantStore';
import { streamChat } from '@/services/assistantService';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import type { ChatRequest } from '@/types/assistant';

const SUGGESTIONS = [
  "What's my best performing deal?",
  'Compare NOI across my properties',
  'Explain loss-to-lease',
];

export const AssistantPanel = () => {
  const {
    isOpen,
    messages,
    isLoading,
    scopedPropertyId,
    scopedFolderId,
    setOpen,
    addMessage,
    updateLastAssistant,
    finalizeLastAssistant,
    setLoading,
    clearMessages,
  } = useAssistantStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(
    (text: string) => {
      // Add user message
      addMessage({
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
        timestamp: new Date(),
      });

      // Add empty assistant placeholder
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      });

      setLoading(true);

      // Build request
      const conversationHistory = useAssistantStore
        .getState()
        .messages.filter((m) => m.content) // exclude the empty placeholder
        .map((m) => ({ role: m.role, content: m.content }));

      const request: ChatRequest = {
        message: text,
        conversation_history: conversationHistory,
        ...(scopedPropertyId != null && { property_id: scopedPropertyId }),
        ...(scopedFolderId != null && { deal_folder_id: scopedFolderId }),
      };

      let accumulated = '';

      streamChat(
        request,
        (chunk) => {
          accumulated += chunk;
          updateLastAssistant(accumulated);
        },
        () => {
          finalizeLastAssistant();
          setLoading(false);
        },
        (error) => {
          updateLastAssistant(accumulated ? accumulated + '\n\nError: ' + error : 'Error: ' + error);
          finalizeLastAssistant();
          setLoading(false);
        },
      );
    },
    [
      addMessage,
      updateLastAssistant,
      finalizeLastAssistant,
      setLoading,
      scopedPropertyId,
      scopedFolderId,
    ],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed right-0 top-0 z-[60] flex h-full w-full max-w-md flex-col border-l border-border/60 bg-background shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="font-display text-lg font-semibold">Talisman AI</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {scopedPropertyId
                  ? `Analyzing: Property #${scopedPropertyId}`
                  : 'All Deals'}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                className="h-8 w-8 p-0"
                aria-label="Clear conversation"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                className="h-8 w-8 p-0"
                aria-label="Close assistant"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-display text-base font-semibold">
                  Ask me anything about your deals
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  I can analyze financials, compare properties, explain metrics, and more.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      className="rounded-full border border-border/60 bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <ChatInput onSend={handleSend} disabled={isLoading} />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
