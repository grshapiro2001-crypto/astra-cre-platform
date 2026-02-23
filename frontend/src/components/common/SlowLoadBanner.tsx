import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const DELAY_MS = 5_000;

/**
 * Renders nothing for the first 5 seconds, then fades in a banner
 * explaining that the backend is cold-starting. Mount this inside any
 * skeleton loading block — it automatically disappears when the parent
 * unmounts (i.e. when data finishes loading).
 */
export const SlowLoadBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.35 }}
          className="flex items-center justify-center gap-2.5 mt-6 px-4 py-3 rounded-xl border border-border bg-muted/50 text-sm text-muted-foreground"
        >
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
          <span>Server is waking up — first load takes ~30 seconds</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
