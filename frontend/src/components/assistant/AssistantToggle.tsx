import { motion } from 'framer-motion';
import { MessageSquare } from 'lucide-react';
import { useAssistantStore } from '@/store/assistantStore';

export const AssistantToggle = () => {
  const togglePanel = useAssistantStore((s) => s.togglePanel);

  return (
    <motion.button
      onClick={togglePanel}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25"
      aria-label="Toggle Talisman Assistant"
    >
      <MessageSquare className="h-6 w-6" />
    </motion.button>
  );
};
