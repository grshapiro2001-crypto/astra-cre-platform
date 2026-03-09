import { motion } from 'framer-motion';
import { useAssistantStore } from '@/store/assistantStore';
import TalismanCompass3D from '@/components/ui/TalismanCompass3D';

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
      <TalismanCompass3D size={40} speed={1.25} />
    </motion.button>
  );
};
