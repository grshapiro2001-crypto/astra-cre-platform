import { api } from './api';

/**
 * Client-side event tracking for demo analytics.
 * Batches events and flushes every 10 seconds or on page unload.
 * Session ID is generated per tab/window and persisted in sessionStorage.
 */

interface TrackEvent {
  event_type: string;
  session_id: string;
  event_data_json?: string;
  page_url?: string;
  component?: string;
  duration_ms?: number;
  timestamp?: string;
}

const BATCH_INTERVAL_MS = 10_000; // Flush every 10 seconds
const MAX_BATCH_SIZE = 50;

class EventTracker {
  private queue: TrackEvent[] = [];
  private sessionId: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private isEnabled = true;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.startFlushTimer();
    this.setupUnloadHandler();
  }

  private getOrCreateSessionId(): string {
    const key = 'talisman_session_id';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => this.flush(), BATCH_INTERVAL_MS);
  }

  private setupUnloadHandler() {
    // Use visibilitychange (more reliable than beforeunload)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush(true); // Use beacon API
      }
    });
  }

  track(eventType: string, data?: Record<string, unknown>, component?: string) {
    if (!this.isEnabled) return;

    const event: TrackEvent = {
      event_type: eventType,
      session_id: this.sessionId,
      page_url: window.location.pathname,
      component,
      timestamp: new Date().toISOString(),
    };

    if (data) {
      event.event_data_json = JSON.stringify(data);
    }

    this.queue.push(event);

    // Auto-flush if queue is large
    if (this.queue.length >= MAX_BATCH_SIZE) {
      this.flush();
    }
  }

  trackPageView(path: string) {
    this.track('page_view', { path });
  }

  trackError(error: Error, component?: string, errorInfo?: string) {
    this.track('error', {
      message: error.message,
      stack: error.stack?.slice(0, 500),
      component_stack: errorInfo?.slice(0, 500),
    }, component);
  }

  trackFeatureUsage(feature: string, metadata?: Record<string, unknown>) {
    this.track('feature_usage', { feature, ...metadata });
  }

  async flush(useBeacon = false) {
    if (this.queue.length === 0) return;

    const events = [...this.queue];
    this.queue = [];

    if (useBeacon && navigator.sendBeacon) {
      // Beacon API for page unload — fire-and-forget
      try {
        const blob = new Blob(
          [JSON.stringify({ events })],
          { type: 'application/json' }
        );
        navigator.sendBeacon('/api/v1/events/batch', blob);
      } catch {
        // Silently fail — we're unloading anyway
      }
      return;
    }

    try {
      await api.post('/events/batch', { events });
    } catch {
      // Put events back in queue for retry (but don't grow unbounded)
      if (this.queue.length + events.length < MAX_BATCH_SIZE * 2) {
        this.queue.unshift(...events);
      }
    }
  }

  disable() {
    this.isEnabled = false;
    if (this.flushTimer) clearInterval(this.flushTimer);
  }

  enable() {
    this.isEnabled = true;
    this.startFlushTimer();
  }
}

// Singleton
export const eventTracker = new EventTracker();
