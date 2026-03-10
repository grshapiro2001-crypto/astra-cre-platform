import TalismanCompass3D from '@/components/TalismanCompass3D';
import { useAssistantStore } from '@/store/assistantStore';

export const AssistantToggle = () => {
  const togglePanel = useAssistantStore((s) => s.togglePanel);

  return (
    <button
      onClick={togglePanel}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 50,
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
      aria-label="Toggle Talisman Assistant"
    >
      <TalismanCompass3D size={48} spin={true} speed={1.25} />
    </button>
  );
};
