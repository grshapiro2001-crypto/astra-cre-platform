import { TalismanLogo } from '@/components/ui/TalismanLogo';
import { useAssistantStore } from '@/store/assistantStore';

export const AssistantToggle = () => {
  const togglePanel = useAssistantStore((s) => s.togglePanel);

  return (
    <button
      onClick={togglePanel}
      className="fixed bottom-6 right-6 z-50 p-2.5 rounded-full bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.10] transition-all shadow-lg hover:shadow-xl"
      aria-label="Toggle Talisman Assistant"
    >
      <TalismanLogo size={28} />
    </button>
  );
};
