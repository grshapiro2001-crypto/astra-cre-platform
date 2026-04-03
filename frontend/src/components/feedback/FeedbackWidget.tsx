import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useUIStore } from '@/store/uiStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  MessageCircle,
  X,
  Bug,
  Zap,
  HelpCircle,
  Camera,
  Send,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ImagePlus,
} from 'lucide-react';
import { feedbackService, type FeedbackCreatePayload, type FeedbackReport } from '@/services/feedbackService';

type Category = 'bug' | 'feature' | 'other';
type Severity = 'low' | 'medium' | 'high' | 'critical';
type WidgetView = 'closed' | 'form' | 'submissions' | 'success';

const CATEGORY_CONFIG = {
  bug: { label: 'Bug Report', icon: Bug, color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  feature: { label: 'Feature Idea', icon: Zap, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  other: { label: 'Other', icon: HelpCircle, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
};

const SEVERITY_OPTIONS: { value: Severity; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-slate-400' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
  { value: 'high', label: 'High', color: 'text-orange-400' },
  { value: 'critical', label: 'Critical', color: 'text-red-400' },
];

export function FeedbackWidget() {
  const location = useLocation();
  const [view, setView] = useState<WidgetView>('closed');

  // Listen for external trigger from header button
  const feedbackOpen = useUIStore((s) => s.feedbackOpen);
  const setFeedbackOpen = useUIStore((s) => s.setFeedbackOpen);
  useEffect(() => {
    if (feedbackOpen && view === 'closed') {
      setView('form');
      setFeedbackOpen(false);
    }
  }, [feedbackOpen, view, setFeedbackOpen]);
  const [category, setCategory] = useState<Category>('bug');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [myReports, setMyReports] = useState<FeedbackReport[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Capture app state snapshot
  const captureAppState = (): Partial<FeedbackCreatePayload> => {
    const pathParts = location.pathname.split('/');
    let activePropertyId: string | undefined;
    if (pathParts[1] === 'library' && pathParts[2]) {
      activePropertyId = pathParts[2];
    }

    return {
      current_url: window.location.href,
      active_property_id: activePropertyId,
      active_tab: document.querySelector('[data-state="active"][role="tab"]')?.textContent || undefined,
      browser_info: navigator.userAgent.slice(0, 500),
      viewport_size: `${window.innerWidth}x${window.innerHeight}`,
    };
  };

  // In-app screenshot via html2canvas (lazy loaded)
  const captureScreenshot = async () => {
    try {
      const mod = await import('html2canvas');
      const html2canvas = (mod.default ?? mod) as unknown as (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>;
      const canvas = await html2canvas(document.body, {
        scale: 0.5,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });
      setScreenshotDataUrl(canvas.toDataURL('image/png'));
    } catch {
      setError('Screenshot capture failed. Try uploading an image instead.');
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setScreenshotDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Submit feedback
  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Please enter a title.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const appState = captureAppState();
      await feedbackService.createReport({
        category,
        severity,
        title: title.trim(),
        description: description.trim() || undefined,
        screenshot_url: screenshotDataUrl || undefined,
        ...appState,
      });
      setView('success');
      // Reset form
      setTitle('');
      setDescription('');
      setScreenshotDataUrl(null);
      setSeverity('medium');
      setCategory('bug');
    } catch (err: any) {
      if (err?.response?.status === 429) {
        setError('Rate limit reached. Please wait before submitting again.');
      } else {
        setError('Failed to submit feedback. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Load my submissions
  const loadMyReports = async () => {
    setLoadingReports(true);
    try {
      const data = await feedbackService.listReports();
      setMyReports(data.reports);
    } catch {
      // Silently fail — non-critical
    } finally {
      setLoadingReports(false);
    }
  };

  // Auto-close success after 2s
  useEffect(() => {
    if (view === 'success') {
      const t = setTimeout(() => setView('closed'), 2500);
      return () => clearTimeout(t);
    }
  }, [view]);

  if (view === 'closed') {
    return null; // Triggered from header button
  }

  if (view === 'success') {
    return (
      <div className="fixed bottom-6 left-6 z-50 bg-card border border-emerald-500/30 rounded-2xl shadow-2xl p-6 w-80 text-center">
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <p className="text-foreground font-medium">Thank you!</p>
        <p className="text-slate-500 text-xs mt-1">Your feedback has been received.</p>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 left-6 z-50 bg-card border border-border/80 rounded-2xl shadow-2xl w-96 max-h-[80vh] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/60">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {view === 'form' ? 'Send Feedback' : 'My Submissions'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              if (view === 'form') {
                setView('submissions');
                loadMyReports();
              } else {
                setView('form');
              }
            }}
            className="text-xs text-slate-400 hover:text-foreground px-2 py-1 rounded transition-colors"
          >
            {view === 'form' ? 'My Submissions' : 'New'}
          </button>
          <button onClick={() => setView('closed')} className="text-slate-400 hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Form view */}
      {view === 'form' && (
        <div className="p-4 space-y-3 overflow-y-auto">
          {/* Category selector */}
          <div className="flex gap-2">
            {(Object.entries(CATEGORY_CONFIG) as [Category, typeof CATEGORY_CONFIG.bug][]).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    category === key ? cfg.color : 'border-border/40 text-slate-500 hover:border-border'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Severity — only for bugs */}
          {category === 'bug' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-14">Severity:</span>
              <div className="flex gap-1.5">
                {SEVERITY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSeverity(opt.value)}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-all ${
                      severity === opt.value
                        ? `${opt.color} border-current bg-current/10 font-medium`
                        : 'border-border/40 text-slate-600 hover:border-border'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <Input
            placeholder="Short summary..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-sm"
            maxLength={500}
          />

          {/* Description */}
          <textarea
            placeholder="Details (optional)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full min-h-[80px] rounded-lg border border-border/60 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
            maxLength={5000}
          />

          {/* Screenshot */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={captureScreenshot}
            >
              <Camera className="w-3 h-3" />
              Capture Screen
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="w-3 h-3" />
              Upload Image
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            {screenshotDataUrl && (
              <div className="relative">
                <img src={screenshotDataUrl} alt="Screenshot" className="w-10 h-10 object-cover rounded border border-border/40" />
                <button
                  onClick={() => setScreenshotDataUrl(null)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-2.5 h-2.5 text-white" />
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertTriangle className="w-3 h-3" />
              {error}
            </div>
          )}

          {/* Submit */}
          <Button
            className="w-full gap-2"
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit Feedback
          </Button>

          {/* App state disclosure */}
          <p className="text-[10px] text-slate-600 text-center">
            Current page, browser info, and active view are auto-captured to help debug.
          </p>
        </div>
      )}

      {/* Submissions view */}
      {view === 'submissions' && (
        <div className="p-4 space-y-2 overflow-y-auto max-h-[60vh]">
          {loadingReports ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
            </div>
          ) : myReports.length === 0 ? (
            <p className="text-center text-slate-500 text-xs py-8">No submissions yet.</p>
          ) : (
            myReports.map(report => (
              <Card key={report.id} className="bg-card/50 border-border/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    report.status === 'open' ? 'text-amber-400 bg-amber-500/10' :
                    report.status === 'in_progress' ? 'text-blue-400 bg-blue-500/10' :
                    report.status === 'resolved' ? 'text-emerald-400 bg-emerald-500/10' :
                    'text-slate-400 bg-slate-500/10'
                  }`}>
                    {report.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="text-[10px] text-slate-600">
                    {new Date(report.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-foreground font-medium">{report.title}</p>
                {report.description && (
                  <p className="text-xs text-slate-500 line-clamp-2">{report.description}</p>
                )}
                {report.replies.length > 0 && (
                  <div className="border-t border-border/30 pt-1.5 mt-1.5 space-y-1">
                    {report.replies.map(reply => (
                      <div key={reply.id} className="text-xs">
                        <span className="font-medium text-primary">{reply.user_name || reply.user_email || 'Admin'}: </span>
                        <span className="text-slate-400">{reply.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
