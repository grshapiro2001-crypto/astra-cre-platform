import { User } from 'lucide-react';
import TalismanCompass3D from '@/components/TalismanCompass3D';
import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/types/assistant';

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage = ({ message }: ChatMessageProps) => {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-muted' : ''
        )}
      >
        {isUser ? (
          <User className="h-4 w-4 text-muted-foreground" />
        ) : (
          <TalismanCompass3D size={24} spin={false} speed={0} />
        )}
      </div>

      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md border border-border/60 bg-card'
        )}
      >
        <span className="whitespace-pre-wrap">{message.content}</span>
        {message.isStreaming && (
          <span className="ml-1 inline-block h-4 w-1.5 animate-pulse rounded-full bg-primary/60" />
        )}
      </div>
    </div>
  );
};
