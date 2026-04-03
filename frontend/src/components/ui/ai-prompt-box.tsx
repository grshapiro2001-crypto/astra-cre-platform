// components/ui/ai-prompt-box.tsx
"use client";

import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowUp, Paperclip, Square, X, Mic, MicOff, Globe, BrainCog, ChevronDown, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────────
// Textarea
// ────────────────────────────────────────────────────────
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}
const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      "flex w-full rounded-md border-none bg-transparent px-3 py-2.5 text-base text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px] resize-none scrollbar-hide",
      className
    )}
    ref={ref}
    rows={1}
    {...props}
  />
));
Textarea.displayName = "Textarea";

// ────────────────────────────────────────────────────────
// Tooltip
// ────────────────────────────────────────────────────────
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Content
    ref={ref}
    sideOffset={sideOffset}
    className={cn(
      "z-50 overflow-hidden rounded-md border border-white/[0.08] bg-[#1a1a1e] px-3 py-1.5 text-sm text-white shadow-md animate-in fade-in-0 zoom-in-95",
      className
    )}
    {...props}
  />
));
TooltipContent.displayName = "TooltipContent";

// ────────────────────────────────────────────────────────
// Dialog
// ────────────────────────────────────────────────────────
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in-0", className)}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[90vw] md:max-w-[800px] translate-x-[-50%] translate-y-[-50%] border border-white/[0.06] bg-[#0c0c0f] p-0 shadow-xl rounded-2xl animate-in fade-in-0 zoom-in-95",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full bg-white/[0.06] p-2 hover:bg-white/[0.10] transition-all">
        <X className="h-5 w-5 text-zinc-300 hover:text-white" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title ref={ref} className={cn("text-lg font-semibold text-foreground", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

// ────────────────────────────────────────────────────────
// Internal Button
// ────────────────────────────────────────────────────────
interface InternalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}
const InternalButton = React.forwardRef<HTMLButtonElement, InternalButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default: "bg-white hover:bg-white/80 text-black",
      outline: "border border-white/[0.08] bg-transparent hover:bg-white/[0.04]",
      ghost: "bg-transparent hover:bg-white/[0.04]",
    };
    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-8 px-3 text-sm",
      lg: "h-12 px-6",
      icon: "h-8 w-8 rounded-full",
    };
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          variants[variant], sizes[size], className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
InternalButton.displayName = "InternalButton";

// VoiceRecorder removed -- replaced by SpeechRecognition (speech-to-text)

// ────────────────────────────────────────────────────────
// Image View Dialog
// ────────────────────────────────────────────────────────
const ImageViewDialog: React.FC<{ imageUrl: string | null; onClose: () => void }> = ({ imageUrl, onClose }) => {
  if (!imageUrl) return null;
  return (
    <Dialog open={!!imageUrl} onOpenChange={onClose}>
      <DialogContent className="p-0 border-none bg-transparent shadow-none">
        <DialogTitle className="sr-only">Image Preview</DialogTitle>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-[#0c0c0f] rounded-2xl overflow-hidden shadow-2xl">
          <img src={imageUrl} alt="Preview" className="w-full max-h-[80vh] object-contain rounded-2xl" />
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

// ────────────────────────────────────────────────────────
// Prompt Input Context
// ────────────────────────────────────────────────────────
interface PromptInputContextType {
  isLoading: boolean;
  value: string;
  setValue: (v: string) => void;
  maxHeight: number | string;
  onSubmit?: () => void;
  disabled?: boolean;
}
const PromptInputContext = React.createContext<PromptInputContextType>({
  isLoading: false, value: "", setValue: () => {}, maxHeight: 240, onSubmit: undefined, disabled: false,
});
const usePromptInput = () => React.useContext(PromptInputContext);

// ────────────────────────────────────────────────────────
// Prompt Input Wrapper
// ────────────────────────────────────────────────────────
interface PromptInputProps {
  isLoading?: boolean;
  value?: string;
  onValueChange?: (v: string) => void;
  maxHeight?: number | string;
  onSubmit?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}
const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  ({ className, isLoading = false, maxHeight = 240, value, onValueChange, onSubmit, children, disabled = false, onDragOver, onDragLeave, onDrop }, ref) => {
    const [internalValue, setInternalValue] = React.useState(value || "");
    const handleChange = (v: string) => { setInternalValue(v); onValueChange?.(v); };
    return (
      <TooltipProvider>
        <PromptInputContext.Provider value={{ isLoading, value: value ?? internalValue, setValue: onValueChange ?? handleChange, maxHeight, onSubmit, disabled }}>
          <div ref={ref} className={cn("rounded-3xl border border-white/[0.08] bg-[#0c0c0f] p-2 shadow-[0_8px_30px_rgba(0,0,0,0.24)] transition-all duration-300", isLoading && "border-red-500/70", className)}
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
            {children}
          </div>
        </PromptInputContext.Provider>
      </TooltipProvider>
    );
  }
);
PromptInput.displayName = "PromptInput";

// ────────────────────────────────────────────────────────
// Prompt Textarea (auto-resizing)
// ────────────────────────────────────────────────────────
const PromptInputTextarea: React.FC<{ disableAutosize?: boolean; placeholder?: string } & React.ComponentProps<typeof Textarea>> = ({
  className, onKeyDown, disableAutosize = false, placeholder, ...props
}) => {
  const { value, setValue, maxHeight, onSubmit, disabled } = usePromptInput();
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (disableAutosize || !ref.current) return;
    ref.current.style.height = "auto";
    ref.current.style.height = typeof maxHeight === "number"
      ? `${Math.min(ref.current.scrollHeight, maxHeight)}px`
      : `min(${ref.current.scrollHeight}px, ${maxHeight})`;
  }, [value, maxHeight, disableAutosize]);

  return (
    <Textarea ref={ref} value={value} onChange={e => setValue(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit?.(); } onKeyDown?.(e); }}
      className={cn("text-base", className)} disabled={disabled} placeholder={placeholder} {...props} />
  );
};

// ────────────────────────────────────────────────────────
// Action wrappers
// ────────────────────────────────────────────────────────
const PromptInputActions: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className, ...props }) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>{children}</div>
);

const PromptInputAction: React.FC<{ tooltip: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" } & React.ComponentProps<typeof Tooltip>> = ({
  tooltip, children, side = "top", ...props
}) => {
  const { disabled } = usePromptInput();
  return (
    <Tooltip {...props}>
      <TooltipTrigger asChild disabled={disabled}>{children}</TooltipTrigger>
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  );
};

// ────────────────────────────────────────────────────────
// Custom Divider
// ────────────────────────────────────────────────────────
const CustomDivider: React.FC = () => (
  <div className="relative h-6 w-[1.5px] mx-1">
    <div className="absolute inset-0 bg-gradient-to-t from-transparent via-[#9b87f5]/70 to-transparent rounded-full"
      style={{ clipPath: "polygon(0% 0%, 100% 0%, 100% 40%, 140% 50%, 100% 60%, 100% 100%, 0% 100%, 0% 60%, -40% 50%, 0% 40%)" }} />
  </div>
);

// ────────────────────────────────────────────────────────
// Toggle Button (Search / Think / Canvas)
// ────────────────────────────────────────────────────────
const ToggleButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  activeColor: string;
  disabled?: boolean;
}> = ({ active, onClick, icon: Icon, label, activeColor, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled}
    className={cn("rounded-full transition-all flex items-center gap-1 px-2 py-1 border h-8",
      active ? `bg-[${activeColor}]/15 border-[${activeColor}] text-[${activeColor}]` : "bg-transparent border-transparent text-[#9CA3AF] hover:text-[#D1D5DB]"
    )}
    style={active ? { backgroundColor: `${activeColor}26`, borderColor: activeColor, color: activeColor } : {}}
  >
    <div className="w-5 h-5 flex items-center justify-center shrink-0">
      <motion.div animate={{ rotate: active ? 360 : 0, scale: active ? 1.1 : 1 }}
        whileHover={{ rotate: active ? 360 : 15, scale: 1.1, transition: { type: "spring", stiffness: 300, damping: 10 } }}
        transition={{ type: "spring", stiffness: 260, damping: 25 }}>
        <Icon className="w-4 h-4" style={active ? { color: activeColor } : {}} />
      </motion.div>
    </div>
    <AnimatePresence>
      {active && (
        <motion.span initial={{ width: 0, opacity: 0 }} animate={{ width: "auto", opacity: 1 }} exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2 }} className="text-xs overflow-hidden whitespace-nowrap shrink-0" style={{ color: activeColor }}>
          {label}
        </motion.span>
      )}
    </AnimatePresence>
  </button>
);

// ════════════════════════════════════════════════════════
// MAIN COMPONENT: PromptInputBox
// ════════════════════════════════════════════════════════
// ────────────────────────────────────────────────────────
// Model Selector
// ────────────────────────────────────────────────────────
const MODELS = [
  { id: 'claude-sonnet-4-5-20250929', label: 'Sonnet 4.5', badge: 'Active' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', badge: null },
] as const;

const ModelSelector: React.FC<{ value: string; onChange: (id: string) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const current = MODELS.find(m => m.id === value) || MODELS[0];

  // Close on click outside
  React.useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(p => !p)}
        disabled={disabled}
        className={cn(
          "rounded-full transition-all flex items-center gap-1.5 px-2.5 py-1 border h-8",
          open ? "bg-white/[0.06] border-white/[0.12] text-zinc-200" : "bg-transparent border-transparent text-zinc-500 hover:text-zinc-300"
        )}
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span className="text-xs whitespace-nowrap">{current.label}</span>
        <ChevronDown className={cn("w-3 h-3 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-0 mb-2 z-50 w-52 rounded-xl border border-white/[0.08] bg-[#0c0c0f] shadow-2xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-white/[0.04]">
              <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-zinc-600">Model</span>
            </div>
            {MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => { onChange(m.id); setOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 text-left transition-all hover:bg-white/[0.04]",
                  m.id === value && "bg-white/[0.03]"
                )}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className={cn("w-3.5 h-3.5", m.id === value ? "text-white" : "text-zinc-600")} />
                  <span className={cn("text-xs font-medium", m.id === value ? "text-white" : "text-zinc-400")}>{m.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {m.badge && <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-400/[0.08] text-emerald-400">{m.badge}</span>}
                  {m.id === value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            ))}
            <div className="px-3 py-2 border-t border-white/[0.04]">
              <p className="text-[9px] text-zinc-700">Model selection not yet wired to backend</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ════════════════════════════════════════════════════════
// SpeechRecognition type declarations
// ════════════════════════════════════════════════════════
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: Event) => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

// ════════════════════════════════════════════════════════
// MAIN COMPONENT: PromptInputBox
// ════════════════════════════════════════════════════════
export interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>((props, ref) => {
  const { onSend = () => {}, isLoading = false, placeholder = "Ask Talisman about deals, markets, or your portfolio...", className } = props;
  const [input, setInput] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [filePreviews, setFilePreviews] = React.useState<Record<string, string>>({});
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [isListening, setIsListening] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [showThink, setShowThink] = React.useState(false);
  const [selectedModel, setSelectedModel] = React.useState<string>(MODELS[0].id);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const promptBoxRef = React.useRef<HTMLDivElement>(null);
  const recognitionRef = React.useRef<SpeechRecognitionInstance | null>(null);

  const processFile = React.useCallback((file: File) => {
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) return;
    setFiles([file]);
    const reader = new FileReader();
    reader.onload = (e) => setFilePreviews({ [file.name]: e.target?.result as string });
    reader.readAsDataURL(file);
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDragLeave = React.useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); }, []);
  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const img = Array.from(e.dataTransfer.files).find(f => f.type.startsWith("image/"));
    if (img) processFile(img);
  }, [processFile]);

  // Paste handler
  React.useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) { e.preventDefault(); processFile(file); break; }
        }
      }
    };
    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [processFile]);

  // Speech-to-text
  const toggleSpeechToText = React.useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      // Append to existing input
      setInput(prev => {
        const base = prev.trimEnd();
        return base ? `${base} ${transcript}` : transcript;
      });
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => { recognitionRef.current?.abort(); };
  }, []);

  const handleSubmit = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }
    if (!input.trim() && files.length === 0) return;
    let prefix = "";
    if (showSearch) prefix = "[Search] ";
    else if (showThink) prefix = "[Think] ";
    onSend(prefix + input, files);
    setInput(""); setFiles([]); setFilePreviews({});
  };

  const hasContent = input.trim() !== "" || files.length > 0;
  const hasSpeech = !!getSpeechRecognition();

  return (
    <>
      <PromptInput
        value={input} onValueChange={setInput} isLoading={isLoading} onSubmit={handleSubmit}
        className={cn("w-full bg-[#0c0c0f] border-white/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.24)]", isListening && "border-emerald-500/40", className)}
        disabled={isLoading} ref={ref || promptBoxRef}
        onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
      >
        {/* Image previews */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 pb-1">
            {files.map((file, idx) => file.type.startsWith("image/") && filePreviews[file.name] && (
              <div key={idx} className="relative group">
                <div className="w-16 h-16 rounded-xl overflow-hidden cursor-pointer" onClick={() => setSelectedImage(filePreviews[file.name])}>
                  <img src={filePreviews[file.name]} alt={file.name} className="h-full w-full object-cover" />
                  <button onClick={e => { e.stopPropagation(); setFiles([]); setFilePreviews({}); }}
                    className="absolute top-1 right-1 rounded-full bg-black/70 p-0.5"><X className="h-3 w-3 text-white" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <PromptInputTextarea placeholder={
          isListening ? "Listening..." : showSearch ? "Search the web..." : showThink ? "Think deeply..." : placeholder
        } />

        {/* Listening indicator */}
        {isListening && (
          <div className="flex items-center gap-2 px-3 pb-1">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400 font-medium">Listening -- speak now</span>
          </div>
        )}

        {/* Actions */}
        <PromptInputActions className="flex items-center justify-between gap-2 pt-2">
          <div className="flex items-center gap-1">
            {/* Upload */}
            <PromptInputAction tooltip="Upload image">
              <button onClick={() => uploadInputRef.current?.click()}
                className="flex h-8 w-8 text-zinc-500 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-white/[0.06] hover:text-zinc-300">
                <Paperclip className="h-5 w-5" />
                <input ref={uploadInputRef} type="file" className="hidden" accept="image/*"
                  onChange={e => { if (e.target.files?.[0]) processFile(e.target.files[0]); if (e.target) e.target.value = ""; }} />
              </button>
            </PromptInputAction>

            {/* Mode toggles */}
            <div className="flex items-center">
              <ToggleButton active={showSearch} onClick={() => { setShowSearch(p => !p); setShowThink(false); }}
                icon={Globe} label="Search" activeColor="#1EAEDB" />
              <CustomDivider />
              <ToggleButton active={showThink} onClick={() => { setShowThink(p => !p); setShowSearch(false); }}
                icon={BrainCog} label="Think" activeColor="#8B5CF6" />
              <CustomDivider />
              <ModelSelector value={selectedModel} onChange={setSelectedModel} />
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Speech-to-text */}
            {hasSpeech && (
              <PromptInputAction tooltip={isListening ? "Stop listening" : "Speech to text"}>
                <button
                  onClick={toggleSpeechToText}
                  className={cn("flex h-8 w-8 items-center justify-center rounded-full transition-all",
                    isListening ? "bg-emerald-400/[0.12] text-emerald-400" : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
                  )}
                >
                  {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
              </PromptInputAction>
            )}

            {/* Send / Stop */}
            <PromptInputAction tooltip={isLoading ? "Stop" : "Send"}>
              <InternalButton variant="default" size="icon"
                className={cn("h-8 w-8 rounded-full transition-all duration-200",
                  hasContent ? "bg-white hover:bg-white/80 text-[#0c0c0f]" : "bg-transparent hover:bg-white/[0.06] text-zinc-600"
                )}
                onClick={handleSubmit}
                disabled={(isLoading && !hasContent) || !hasContent}>
                {isLoading ? <Square className="h-4 w-4 fill-current animate-pulse" /> : <ArrowUp className="h-4 w-4" />}
              </InternalButton>
            </PromptInputAction>
          </div>
        </PromptInputActions>
      </PromptInput>

      <ImageViewDialog imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
    </>
  );
});
PromptInputBox.displayName = "PromptInputBox";
