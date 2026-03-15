import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authSlice';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Terminal,
  AlertTriangle,
  CheckCircle2,
  Clock,
  GitBranch,
  Zap,
  Bug,
  BarChart3,
  Cpu,
  Send,
  Plus,
  ExternalLink,
  Activity,
  Layers,
  Users,
  FileCode,
  TrendingUp,
  Circle,
  Mail,
  Shield,
  ShieldCheck,
  ShieldX,
  UserCheck,
  UserX,
  Loader2,
  MessageCircle,
  Reply,
} from 'lucide-react';
import { adminService, type AdminUser } from '@/services/adminService';
import { feedbackService, type FeedbackReport as FeedbackReportType } from '@/services/feedbackService';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Bug {
  id: string;
  title: string;
  file: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  status: 'Open' | 'Fixed';
  pr?: string;
  impact: string;
}

interface Feature {
  id: string;
  title: string;
  description: string;
  column: 'Backlog' | 'Prioritized' | 'In Flight' | 'Shipped';
  effort: 'Low' | 'Med' | 'High';
  impact: 'Low' | 'Med' | 'High';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

// ─── Static Data ─────────────────────────────────────────────────────────────

const BUGS: Bug[] = [
  { id: 'BUG-001', title: 'Google Maps API loaded multiple times', file: 'App.tsx / index.html', severity: 'Critical', status: 'Fixed', pr: '#117', impact: 'Map rendering instability on every map-bearing page' },
  { id: 'BUG-002', title: 'Google Maps using retired API v3.55', file: 'index.html script tag', severity: 'Critical', status: 'Fixed', pr: '#117', impact: 'Maps could break silently — Google may deprecate at any time' },
  { id: 'BUG-003', title: '"Add Note" silently drops data', file: 'pages/PropertyDetail.tsx ~L1466', severity: 'Critical', status: 'Fixed', pr: '#95-110', impact: 'Users believe note saved; data lost on page reload' },
  { id: 'BUG-004', title: '"Ask Follow-up" button inert', file: 'pages/PropertyDetail.tsx ~L1783', severity: 'Critical', status: 'Fixed', pr: '#95-110', impact: 'Core AI feature appears present but completely non-functional' },
  { id: 'BUG-005', title: 'Kanban moveDeal not persisted', file: 'pages/Dashboard.tsx ~L499', severity: 'High', status: 'Fixed', pr: '#61', impact: 'Pipeline board now saves to DB with org-level templates' },
  { id: 'BUG-006', title: '"Save Comparison" closes without saving', file: 'pages/ComparisonPage.tsx ~L1886', severity: 'High', status: 'Fixed', pr: '#95-110', impact: 'Named comparisons cannot be saved at all' },
  { id: 'BUG-007', title: 'NOI chart shows "---" when T12 null', file: 'pages/PropertyDetail.tsx', severity: 'High', status: 'Fixed', pr: '#95-110', impact: 'Primary financial metric invisible for properties without T12' },
  { id: 'BUG-008', title: 'Settings "Save Changes" hardcoded disabled', file: 'pages/Settings.tsx ~L127', severity: 'High', status: 'Fixed', pr: '#95-110', impact: 'Users cannot update name or email' },
  { id: 'BUG-009', title: 'Dashboard metrics fluctuate on cold start', file: 'pages/Dashboard.tsx', severity: 'Medium', status: 'Open', impact: 'Render.com free tier cold start causes jarring metric flash (PR #41 pending)' },
  { id: 'BUG-010', title: 'Notification bell has no handler', file: 'components/layout/Header.tsx ~L151', severity: 'Medium', status: 'Open', impact: 'Purple dot implies unread notifications — clicking does nothing' },
  { id: 'BUG-011', title: 'Notification prefs only stored locally', file: 'pages/Settings.tsx', severity: 'Medium', status: 'Open', impact: 'Prefs reset on new device/browser' },
  { id: 'BUG-012', title: 'Debug console.logs still in prod', file: 'pages/FolderDetail.tsx, CreateFolderModal.tsx + rent roll parser', severity: 'Low', status: 'Open', impact: 'Log noise; should be gated behind DEBUG env var before demos' },
  { id: 'BUG-013', title: 'Settings API key labeled as placeholder', file: 'pages/Settings.tsx ~L258', severity: 'Low', status: 'Open', impact: 'Confusing until real API access is offered' },
  { id: 'BUG-014', title: 'Stacking viewer debug logging in prod', file: 'backend rent roll parser', severity: 'Low', status: 'Open', impact: 'Python debug prints visible in Render logs — performance overhead' },
  { id: 'BUG-015', title: 'Org invite flow untested at scale', file: 'pages/OrganizationSettings.tsx', severity: 'Medium', status: 'Open', impact: 'Email delivery not verified; invite may fail silently' },
  { id: 'BUG-016', title: 'Floor plan overlay unit marker accuracy', file: 'components/stacking/FloorPlanOverlay.tsx', severity: 'Low', status: 'Open', impact: 'Markers positioned by wing quadrant — approximate, not pixel-perfect' },
];

const FEATURES: Feature[] = [
  { id: 'F-001', title: 'Fix BUG-001/002: Google Maps', description: 'Load Maps API once at root, upgrade to v=weekly', column: 'Shipped', effort: 'Low', impact: 'High' },
  { id: 'F-002', title: 'Fix BUG-003: "Add Note" persistence', description: 'POST notes to /api/v1/properties/{id}/notes', column: 'Shipped', effort: 'Low', impact: 'High' },
  { id: 'F-003', title: 'Fix BUG-004: "Ask Follow-up" wire-up', description: 'Connect to POST /api/v1/chat, stream to AI panel', column: 'Shipped', effort: 'Med', impact: 'High' },
  { id: 'F-004', title: 'Fix BUG-006: Save Comparison', description: 'POST named comparison to backend, confirm to user', column: 'Shipped', effort: 'Low', impact: 'Med' },
  { id: 'F-005', title: 'Merge PR #41: Cold-start Banner', description: '5s skeleton → banner while Render wakes up', column: 'Prioritized', effort: 'Low', impact: 'Med' },
  { id: 'F-006', title: 'Fix BUG-008: Settings Profile Save', description: 'Track dirty state, PUT /api/v1/auth/me on save', column: 'Backlog', effort: 'Med', impact: 'Med' },
  { id: 'F-007', title: 'Notification System (BUG-010/011)', description: 'Bell → panel, persist prefs to backend', column: 'Backlog', effort: 'High', impact: 'Med' },
  { id: 'F-008', title: 'BatchData Real Estate MCP', description: 'Address verification, market comps auto-fetch on upload', column: 'Backlog', effort: 'High', impact: 'High' },
  { id: 'F-009', title: 'Custom Talisman MCP Server', description: 'Expose Talisman DB via MCP — search, pipeline, scoring tools', column: 'Backlog', effort: 'High', impact: 'High' },
  { id: 'F-010', title: 'LOI Generation', description: 'Auto-populate LOI template from property data, e-sign via Lumin', column: 'Backlog', effort: 'High', impact: 'High' },
  { id: 'F-011', title: 'React Query Migration', description: 'Replace direct API calls with React Query for caching', column: 'Backlog', effort: 'High', impact: 'Med' },
  { id: 'F-012', title: 'Deal Analytics Dashboard', description: 'Upload trends, score distribution, pipeline velocity', column: 'Backlog', effort: 'Med', impact: 'High' },
  { id: 'F-013', title: 'Contact Enrichment (ZoomInfo/Clay)', description: 'Auto-enrich property owner from OM, store in contacts table', column: 'Backlog', effort: 'High', impact: 'High' },
  { id: 'F-014', title: '3D Stacking Viewer — Tier 5', description: 'Rent roll diff view, time-slider, occupancy trend animation', column: 'Backlog', effort: 'High', impact: 'Med' },
  { id: 'F-015', title: 'Command Center', description: 'Admin-only CEO dashboard — live project status', column: 'Shipped', effort: 'Med', impact: 'High' },
  { id: 'F-016', title: '3D Stacking Viewer', description: '4-tier investor-grade 3D building model, floor plan overlay', column: 'Shipped', effort: 'High', impact: 'High' },
  { id: 'F-017', title: 'Organizations & Team Workspaces', description: 'Multi-user orgs, invite flow, org-level context', column: 'Shipped', effort: 'High', impact: 'High' },
  { id: 'F-018', title: 'Market Research Extraction + Layer 2', description: 'PDF → AI sentiment scoring for Layer 2 deal score', column: 'Shipped', effort: 'Med', impact: 'High' },
  { id: 'F-019', title: 'Kanban Persistence (BUG-005)', description: 'Pipeline stage now saves to DB', column: 'Shipped', effort: 'Low', impact: 'High' },
  { id: 'F-020', title: 'T12 Excel Upload + Fuzzy Extraction', description: 'Fuzzy matching T12 engine with Claude AI fallback', column: 'Shipped', effort: 'High', impact: 'High' },
  { id: 'F-021', title: 'AI Chat Assistant Panel', description: 'Floating SSE-streaming pipeline analyst — wired to Claude with full deal context', column: 'Shipped', effort: 'Med', impact: 'High' },
  { id: 'F-022', title: 'Talisman IO Rebrand', description: 'Full codebase rebrand from ASTRA CRE → Talisman IO, new favicon and meta', column: 'Shipped', effort: 'Low', impact: 'High' },
  { id: 'F-023', title: 'Design System v2 — Champagne Gold', description: 'Cinzel + Questrial fonts, Champagne Gold (#D4A853) accent, crystal compass brand identity', column: 'Shipped', effort: 'Med', impact: 'High' },
  { id: 'F-024', title: 'Property Detail 7-tab Redesign', description: 'Restructured property detail into 7 tabs; compact two-row header replacing Street View hero', column: 'Shipped', effort: 'Med', impact: 'High' },
  { id: 'F-025', title: 'TalismanCompass3D Navigation', description: 'Interactive Three.js 3D compass in sidebar + chat toggle with emissive gold glow', column: 'Shipped', effort: 'Med', impact: 'Med' },
];

const ANALYTICS = {
  properties: 3,
  folders: 4,
  totalPRs: 122,
  prsSinceFeb26: 75,
  deployments: 47,
  openBugs: 8,
  fixedBugs: 8,
  criticalBugs: 0,
  newServices: 7,
  newComponents: 20,
  linesOfCode: '~22,000',
};

const RECENT_PRS = [
  { id: '#122', title: 'UW Engine — millage rate fix, other income per-unit, growth table Set All, T12 refs, blur orbs removed', date: 'Mar 14', status: 'Merged' },
  { id: '#121', title: 'AI deal summary localStorage cache with 24h TTL', date: 'Mar 13', status: 'Merged' },
  { id: '#120', title: 'UW Engine tax calc, pricing modes, input formatting, trailing financials, output tables', date: 'Mar 13', status: 'Merged' },
  { id: '#119', title: 'Hotfix — extraction_log.py property_id type mismatch', date: 'Mar 12', status: 'Merged' },
  { id: '#118', title: 'UW Engine V1 — institutional proforma, DCF, and IRR analysis', date: 'Mar 12', status: 'Merged' },
  { id: '#107', title: 'Chat panel logos → TalismanCompass3D, sidebar auto-collapses on chat open', date: 'Mar 11', status: 'Merged' },
  { id: '#106', title: 'Stacking model unit colors updated from Astra purple to Talisman gold', date: 'Mar 11', status: 'Merged' },
  { id: '#105', title: 'Fix compass emissive glow at small sizes so gold reads on dark bg', date: 'Mar 11', status: 'Merged' },
  { id: '#104', title: 'Add TalismanCompass3D — replace sidebar logo and chat toggle', date: 'Mar 11', status: 'Merged' },
  { id: '#103', title: 'Redesign property detail header — compact two-row layout, remove Street View hero', date: 'Mar 11', status: 'Merged' },
  { id: '#102', title: 'Restructure property detail page into 7-tab interface', date: 'Mar 11', status: 'Merged' },
  { id: '#101', title: 'Design system v2 — Cinzel/Questrial fonts, Champagne Gold accent', date: 'Mar 11', status: 'Merged' },
  { id: '#100', title: 'Rebrand: ASTRA CRE → Talisman IO across entire codebase', date: 'Mar 11', status: 'Merged' },
  { id: '#99', title: 'Fix AI chat panel — include NULL org properties in deal context', date: 'Mar 11', status: 'Merged' },
  { id: '#98', title: 'Add AI assistant chat panel with SSE streaming', date: 'Mar 11', status: 'Merged' },
];

// ─── Agent Intelligence ───────────────────────────────────────────────────────

function getAgentResponse(input: string): string {
  const q = input.toLowerCase().trim();

  if (q.includes('critical') || q.includes('urgent')) {
    const crits = BUGS.filter(b => b.severity === 'Critical' && b.status === 'Open');
    return `⚠️ You have ${crits.length} critical bugs open:\n\n${crits.map(b => `• **${b.id}** — ${b.title}\n  File: ${b.file}`).join('\n\n')}\n\nAll 4 are UI lies — buttons that appear functional but do nothing or silently lose data. Recommended fix order: BUG-003 → BUG-004 → BUG-001/002.`;
  }

  if (q.includes('bug') && (q.includes('how many') || q.includes('count') || q.includes('total'))) {
    const open = BUGS.filter(b => b.status === 'Open');
    const crit = open.filter(b => b.severity === 'Critical');
    const high = open.filter(b => b.severity === 'High');
    return `📊 Bug Summary:\n• **${open.length} total open** bugs\n• ${crit.length} Critical, ${high.length} High, ${open.filter(b => b.severity === 'Medium').length} Medium, ${open.filter(b => b.severity === 'Low').length} Low\n• 1 resolved (BUG-005, Kanban persistence — PR #61)`;
  }

  if (q.includes('pr') || q.includes('pull request') || q.includes('merged')) {
    return `🔀 PR Activity:\n• **107 total PRs** merged all-time\n• **60+ PRs merged** since Feb 26 audit\n• Latest: PR #107 — compass in chat panel + sidebar auto-collapse\n• Most active area: 3D Stacking Viewer (PRs #62–94, ~30 PRs)\n• Production deploys: 32 total`;
  }

  if (q.includes('what shipped') || q.includes('recent') || q.includes('latest')) {
    return `🚀 Recently Shipped (Mar 8 → Mar 11):\n\n1. **AI Chat Panel** (PRs #97–99) — SSE streaming pipeline analyst with deal context\n2. **Talisman IO Rebrand** (PR #100) — full rename from ASTRA CRE\n3. **Design System v2** (PR #101) — Champagne Gold + Cinzel/Questrial fonts\n4. **Property Detail 7-tab Redesign** (PR #102) — new tab layout, compact header\n5. **TalismanCompass3D** (PR #104) — Three.js compass in sidebar + chat toggle\n6. **Stacking model gold colors** (PR #106) — unified with Talisman brand\n7. **Command Center** (PR #95/96) — this dashboard\n\nAll-time highlights: 3D Stacking Viewer (Tiers 1–4), Organizations, Market Research Layer 2, T12 Excel Upload.\n\nTotal: 60+ PRs since Feb 26.`;
  }

  if (q.includes('feature') && (q.includes('next') || q.includes('priority') || q.includes('backlog'))) {
    const prioritized = FEATURES.filter(f => f.column === 'Prioritized');
    return `📋 Prioritized Features:\n\n${prioritized.map(f => `• **${f.id}** — ${f.title}\n  ${f.description}`).join('\n\n')}\n\nAll are quick wins (Low/Med effort) that fix critical user-facing bugs. Recommend shipping these before starting any new features.`;
  }

  if (q.includes('health') || q.includes('status') || q.includes('production')) {
    return `💚 App Health (Mar 11, 2026):\n\n• Production: https://talisman-io-platform.vercel.app\n• Latest deploy: PR #107 — READY ✅\n• Backend: Render.com (free tier — cold starts expected)\n• TypeScript: Clean\n• All 7 core API endpoints: 200 OK\n• Deals in DB: 3 (The Skylark, Adley City Springs, 1160 Hammond)\n• Brand: Talisman IO (rebranded Mar 11 from ASTRA CRE)\n• Design: Champagne Gold (#D4A853) + Cinzel/Questrial fonts\n\n⚠️ Watch: BUG-009 — metrics fluctuate on cold start. BUG-001/002 — Google Maps API needs upgrade.`;
  }

  if (q.includes('stacking') || q.includes('3d') || q.includes('three')) {
    return `🏗 3D Stacking Viewer:\n\nFull 4-tier feature shipped across PRs #62–94:\n• Tier 1: Base 3D geometry (5 building shapes)\n• Tier 2: Visual overhaul — exploded view, animation, stats overlay\n• Tier 3: Fullscreen, floor isolation, keyboard shortcuts\n• Tier 4: Analyst workflow — unit click → side panel, multi-compare\n• Floor Plan Overlay: 2D mode with unit markers (PR #94)\n• Proportional unit sizing by sqft (PR #93)\n• Rent roll parser rewrite (PRs #69–73, #83, #86)\n\nComponent: StackingViewer3D.tsx (~2,000+ lines)`;
  }

  if (q.includes('fix') && q.includes('note')) {
    return `🔧 Fixing BUG-003 ("Add Note"):\n\n**Current behavior:** onClick calls console.log() then clears input. Data is lost.\n\n**Fix steps:**\n1. Add notes endpoint to backend: POST /api/v1/properties/{id}/notes\n2. Create PropertyNote model in DB\n3. Wire UI to call API on submit\n4. Append returned note to notes list\n\nUse the talisman-io:fix skill with prompt: "Fix BUG-003 — Add Note persistence in PropertyDetail.tsx"`;
  }

  if (q.includes('fix') && (q.includes('follow') || q.includes('ask'))) {
    return `🔧 Fixing BUG-004 ("Ask Follow-up"):\n\n**Current behavior:** Button has no onClick — completely inert.\n\n**Fix steps:**\n1. Wire button onClick to existing POST /api/v1/chat endpoint\n2. Pass property context (id, name, key financials) as system context\n3. Stream response into AI Insights panel (same pattern as pipeline analyst)\n\nUse the talisman-io:fix skill with prompt: "Fix BUG-004 — wire Ask Follow-up button to chat API in PropertyDetail.tsx"`;
  }

  if (q.includes('cost') || q.includes('api cost') || q.includes('llm')) {
    return `💰 API Cost Overview:\n\n• Claude API: ~$0.50–$2.00 per document upload/extraction\n• Cached reads: $0 (all views are DB-only, no LLM calls)\n• LLM call triggers: upload, re-analyze, data-bank Excel, chat, market research, floor plan extraction\n• Current DB: 3 deals → minimal cost\n• At 100 deals: ~$100–200 in extraction costs (one-time)\n\nCost optimization rule: **LLM only on explicit user action, never on view.**`;
  }

  if (q.includes('rebrand') || q.includes('talisman') || q.includes('brand')) {
    return `🪄 Rebrand — ASTRA CRE → Talisman IO (PR #100–101, Mar 11):\n\n• **Name:** Talisman IO (was "ASTRA CRE")\n• **Tagline:** AI-native CRE deal intelligence\n• **Colors:** Champagne Gold (#D4A853) replaces purple accent\n• **Fonts:** Cinzel (display/headings) + Questrial (body)\n• **Logo:** TalismanCompass3D — interactive Three.js 3D compass with emissive gold glow (PR #104)\n• **Favicon + meta tags:** Updated in index.html\n• **Design tokens:** bg-primary now maps to gold, not purple\n• **Scope:** All pages, components, docs, and deployment configs rebranded`;
  }

  if (q.includes('chat') || q.includes('assistant') || q.includes('ai panel')) {
    return `💬 AI Chat Assistant Panel (PRs #97–99, #107, Mar 11):\n\n• Floating sidebar panel — SSE streaming responses\n• Powered by POST /api/v1/chat (streaming endpoint)\n• Full deal context injected: all 3 properties, pipeline stages, key financials\n• Toggle: TalismanCompass3D button in header (sidebar auto-collapses on open)\n• Conversation history persisted in backend\n• Logo/branding updated to compass (PR #107)\n\n**Note:** BUG-004 (PropertyDetail "Ask Follow-up" button) is still open — this is the new floating panel, not the per-property follow-up in PropertyDetail.`;
  }

  if (q.includes('compass') || q.includes('logo') || q.includes('3d logo')) {
    return `🧭 TalismanCompass3D (PR #104–105, Mar 11):\n\nCustom Three.js component — an animated 3D compass rose:\n• 8 cardinal/intercardinal direction points in Champagne Gold\n• Emissive glow effect (boosted at small sizes — PR #105 fix)\n• Used in: sidebar header, AI chat panel toggle button\n• Auto-rotates and responds to hover\n• Component: components/TalismanCompass3D.tsx`;
  }

  if (q.includes('architecture') || q.includes('stack') || q.includes('tech')) {
    return `🏛 Architecture:\n\n**Frontend:** React 18 + TypeScript + Vite + Tailwind + shadcn/ui + Zustand\n**Backend:** FastAPI + Python + SQLAlchemy + Pydantic\n**DB:** SQLite (dev) / PostgreSQL (prod via Render)\n**AI:** Claude claude-sonnet-4-5-20250929 via Anthropic SDK\n**Deploy:** Vercel (frontend) + Render.com (backend, free tier)\n**Maps:** Google Maps API (⚠️ needs upgrade from v3.55)\n**3D:** Three.js (r128) for stacking viewer\n**PDF:** pdfplumber + ReportLab`;
  }

  if (q.includes('hello') || q.includes('hi ') || q === 'hi' || q.includes('hey')) {
    return `👋 Hey Griffin. I'm your Talisman PM agent.\n\nI have full context on the project: 107 PRs, 14 open bugs, current deployments, feature pipeline, and architecture. Brand is now Talisman IO with Champagne Gold design system.\n\nTry asking:\n• "What are the critical bugs?"\n• "What shipped recently?"\n• "What should we fix next?"\n• "How do I fix the Add Note bug?"\n• "What's the production health status?"`;
  }

  if (q.includes('next') && (q.includes('build') || q.includes('work') || q.includes('do'))) {
    return `🎯 My Recommendation — What To Do Next:\n\n**Immediate (this week):**\n1. Fix BUG-001/002 (Google Maps API loaded multiple times + retire v3.55) — 30 min\n2. Fix BUG-003 (Add Note persistence in PropertyDetail) — 1 hour\n3. Fix BUG-004 (Ask Follow-up button — wire to existing chat API) — 1 hour\n4. Fix BUG-007 (NOI chart "---" fallback: T12 null → T3 → Y1) — 30 min\n\n**Short term:**\n5. Fix BUG-006 (Save Comparison — POST to /api/v1/comparisons)\n6. Fix BUG-008 (Settings Save Changes — PUT /api/v1/auth/me)\n\nAll 4 critical bugs are "UI lies" — buttons that appear functional but silently fail. Fix these before any new features for demo readiness.\n\n**New feature to consider:** BatchData MCP (auto-fetch market comps on upload) — highest impact backlog item.`;
  }

  return `I understand you're asking about "${input}". I have context on Talisman's bugs, PRs, features, architecture, and deployment status.\n\nTry being more specific:\n• "What critical bugs are open?"\n• "What shipped since Feb 26?"\n• "What's the production health?"\n• "How do I fix the Add Note bug?"\n• "What's next to build?"`;
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Bug['severity'] }) {
  const colors: Record<Bug['severity'], string> = {
    Critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    High: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    Medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    Low: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${colors[severity]}`}>
      {severity}
    </span>
  );
}

function EffortBadge({ effort }: { effort: 'Low' | 'Med' | 'High' }) {
  const colors = { Low: 'text-emerald-400', Med: 'text-yellow-400', High: 'text-red-400' };
  return <span className={`text-xs font-mono ${colors[effort]}`}>Effort:{effort}</span>;
}

function ImpactBadge({ impact }: { impact: 'Low' | 'Med' | 'High' }) {
  const colors = { Low: 'text-slate-400', Med: 'text-blue-400', High: 'text-primary' };
  return <span className={`text-xs font-mono ${colors[impact]}`}>Impact:{impact}</span>;
}

// ─── Main Command Center Page ─────────────────────────────────────────────────

export function CommandCenter() {
  const user = useAuthStore(state => state.user);
  const [bugFilter, setBugFilter] = useState<'All' | 'Critical' | 'High' | 'Medium' | 'Low'>('All');
  const [bugStatusFilter, setBugStatusFilter] = useState<'All' | 'Open' | 'Fixed'>('Open');
  const [newBugForm, setNewBugForm] = useState({ id: '', title: '', file: '', severity: 'High' as Bug['severity'], impact: '' });
  const [localBugs, setLocalBugs] = useState<Bug[]>(BUGS);
  const [showBugForm, setShowBugForm] = useState(false);
  const [agentMessages, setAgentMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `👋 Hey Griffin. I'm your Talisman PM agent — fully briefed on 107 PRs, 14 open bugs, all deployments, and the full roadmap.\n\nRecent highlights: AI chat panel, Talisman IO rebrand, Champagne Gold design system, property detail 7-tab redesign, and TalismanCompass3D.\n\nAsk me anything about the project.`,
      timestamp: new Date().toLocaleTimeString(),
    }
  ]);
  const [agentInput, setAgentInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── Users tab state ───
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const data = await adminService.listUsers();
      setAdminUsers(data.users);
    } catch {
      setUsersError('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const handleStatusChange = async (userId: string, newStatus: 'active' | 'suspended' | 'pending') => {
    setUpdatingUserId(userId);
    try {
      await adminService.updateUserStatus(userId, newStatus);
      setAdminUsers(prev =>
        prev.map(u => u.id === userId ? { ...u, account_status: newStatus } : u)
      );
    } catch {
      setUsersError('Failed to update user status');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const getOnboardingEmail = (targetUser: AdminUser) => {
    return `Subject: Welcome to Talisman IO — You're In!

Hey ${targetUser.full_name || targetUser.email.split('@')[0]},

Great news — your Talisman IO account is now active.

Here's how to get started:
1. Log in at https://talisman-io.vercel.app
2. Upload your first Offering Memorandum or Rent Roll
3. Watch Talisman extract financials, score the deal, and build your stacking model

You're one of our first demo users, so your feedback is incredibly valuable. Use the feedback widget (bottom-left of the app) to report bugs or suggest features.

If anything feels off or you get stuck, reach out directly — I'm watching every submission.

— Griffin
CEO, Talisman IO`;
  };

  const copyOnboardingEmail = (targetUser: AdminUser) => {
    navigator.clipboard.writeText(getOnboardingEmail(targetUser));
    setCopiedEmail(targetUser.id);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // ─── Feedback tab state ───
  const [feedbackReports, setFeedbackReports] = useState<FeedbackReportType[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackReplyText, setFeedbackReplyText] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const fetchFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const data = await feedbackService.listReports();
      setFeedbackReports(data.reports);
    } catch {
      // silently fail
    } finally {
      setFeedbackLoading(false);
    }
  }, []);

  const handleReply = async (reportId: string) => {
    const msg = feedbackReplyText[reportId]?.trim();
    if (!msg) return;
    setReplyingTo(reportId);
    try {
      await feedbackService.addReply(reportId, msg);
      setFeedbackReplyText(prev => ({ ...prev, [reportId]: '' }));
      await fetchFeedback(); // Refresh to show new reply
    } catch {
      // silently fail
    } finally {
      setReplyingTo(null);
    }
  };

  const handleFeedbackStatusChange = async (reportId: string, newStatus: string) => {
    try {
      await feedbackService.updateStatus(reportId, newStatus);
      setFeedbackReports(prev =>
        prev.map(r => r.id === reportId ? { ...r, status: newStatus as FeedbackReportType['status'] } : r)
      );
    } catch {
      // silently fail
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages]);

  // Admin gate — only show for Griffin's accounts
  const ADMIN_EMAILS = ['griffinshapiro11182001@gmail.com', 'grshap2001@gmail.com'];
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Terminal className="w-8 h-8 text-primary" />
          </div>
          <p className="text-slate-400 text-sm">Access restricted</p>
        </div>
      </div>
    );
  }

  const filteredBugs = localBugs
    .filter(b => bugFilter === 'All' || b.severity === bugFilter)
    .filter(b => bugStatusFilter === 'All' || b.status === bugStatusFilter);

  const sendAgentMessage = () => {
    if (!agentInput.trim()) return;
    const userMsg: ChatMessage = { role: 'user', content: agentInput, timestamp: new Date().toLocaleTimeString() };
    const response = getAgentResponse(agentInput);
    const assistantMsg: ChatMessage = { role: 'assistant', content: response, timestamp: new Date().toLocaleTimeString() };
    setAgentMessages(prev => [...prev, userMsg, assistantMsg]);
    setAgentInput('');
  };

  const logNewBug = () => {
    if (!newBugForm.title || !newBugForm.file) return;
    const bug: Bug = {
      id: newBugForm.id || `BUG-${localBugs.length + 1}`,
      title: newBugForm.title,
      file: newBugForm.file,
      severity: newBugForm.severity,
      status: 'Open',
      impact: newBugForm.impact,
    };
    setLocalBugs(prev => [bug, ...prev]);
    setNewBugForm({ id: '', title: '', file: '', severity: 'High', impact: '' });
    setShowBugForm(false);
  };

  const columnOrder: Feature['column'][] = ['Backlog', 'Prioritized', 'In Flight', 'Shipped'];
  const columnColors: Record<Feature['column'], string> = {
    Backlog: 'border-slate-700',
    Prioritized: 'border-orange-500/40',
    'In Flight': 'border-blue-500/40',
    Shipped: 'border-emerald-500/40',
  };
  const columnHeaderColors: Record<Feature['column'], string> = {
    Backlog: 'text-slate-400',
    Prioritized: 'text-orange-400',
    'In Flight': 'text-blue-400',
    Shipped: 'text-emerald-400',
  };

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-yellow-800 flex items-center justify-center shadow-lg shadow-amber-900/30">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground font-['Syne']">Command Center</h1>
            <p className="text-xs text-slate-500">CEO view · Admin only · Last updated Mar 11, 2026</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
            <Circle className="w-2 h-2 fill-emerald-400" /> Production READY
          </span>
          <a
            href="https://talisman-io.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-primary transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Live App
          </a>
        </div>
      </div>

      {/* ── Vitals Strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total PRs', value: ANALYTICS.totalPRs, icon: GitBranch, color: 'text-primary' },
          { label: 'PRs Since Feb 26', value: `${ANALYTICS.prsSinceFeb26}+`, icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Open Bugs', value: ANALYTICS.openBugs, icon: Bug, color: 'text-orange-400' },
          { label: 'Critical Bugs', value: ANALYTICS.criticalBugs, icon: AlertTriangle, color: 'text-red-400' },
          { label: 'Fixed Bugs', value: ANALYTICS.fixedBugs, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'New Services', value: ANALYTICS.newServices, icon: Layers, color: 'text-cyan-400' },
          { label: 'Lines of Code', value: ANALYTICS.linesOfCode, icon: FileCode, color: 'text-slate-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-card/50 border-border/60 p-3">
            <div className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-none">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5 truncate">{label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Main Tabs ── */}
      <Tabs defaultValue="bugs" className="space-y-4">
        <TabsList className="bg-card/60 border border-border/60">
          <TabsTrigger value="bugs" className="gap-1.5"><Bug className="w-3.5 h-3.5" />Bugs</TabsTrigger>
          <TabsTrigger value="features" className="gap-1.5"><Zap className="w-3.5 h-3.5" />Features</TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="w-3.5 h-3.5" />Analytics</TabsTrigger>
          <TabsTrigger value="agent" className="gap-1.5"><Cpu className="w-3.5 h-3.5" />PM Agent</TabsTrigger>
          <TabsTrigger value="activity" className="gap-1.5"><Activity className="w-3.5 h-3.5" />Git Activity</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5" onClick={() => { if (adminUsers.length === 0) fetchUsers(); }}><Users className="w-3.5 h-3.5" />Users</TabsTrigger>
          <TabsTrigger value="feedback" className="gap-1.5" onClick={() => { if (feedbackReports.length === 0) fetchFeedback(); }}><MessageCircle className="w-3.5 h-3.5" />Feedback</TabsTrigger>
        </TabsList>

        {/* ────── BUGS TAB ────── */}
        <TabsContent value="bugs" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex flex-wrap gap-2">
              {(['All', 'Critical', 'High', 'Medium', 'Low'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setBugFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    bugFilter === f
                      ? 'bg-primary border-primary text-white'
                      : 'border-border/60 text-slate-400 hover:border-primary/50'
                  }`}
                >
                  {f}
                </button>
              ))}
              <span className="w-px h-6 bg-border/60 self-center" />
              {(['All', 'Open', 'Fixed'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setBugStatusFilter(f)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                    bugStatusFilter === f
                      ? 'bg-primary border-primary text-white'
                      : 'border-border/60 text-slate-400 hover:border-primary/50'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowBugForm(v => !v)}
              className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
            >
              <Plus className="w-3.5 h-3.5" /> Log Bug
            </Button>
          </div>

          {/* Bug Logger Form */}
          {showBugForm && (
            <Card className="bg-card/60 border-primary/30 p-4 space-y-3">
              <p className="text-sm font-semibold text-primary">Log New Bug</p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Bug ID (e.g. BUG-017)"
                  value={newBugForm.id}
                  onChange={e => setNewBugForm(p => ({ ...p, id: e.target.value }))}
                  className="text-sm bg-background/60"
                />
                <select
                  value={newBugForm.severity}
                  onChange={e => setNewBugForm(p => ({ ...p, severity: e.target.value as Bug['severity'] }))}
                  className="text-sm bg-background/60 border border-border rounded-md px-3 text-foreground"
                >
                  {(['Critical', 'High', 'Medium', 'Low'] as const).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Input
                  placeholder="Title"
                  value={newBugForm.title}
                  onChange={e => setNewBugForm(p => ({ ...p, title: e.target.value }))}
                  className="text-sm bg-background/60 col-span-2"
                />
                <Input
                  placeholder="File / location"
                  value={newBugForm.file}
                  onChange={e => setNewBugForm(p => ({ ...p, file: e.target.value }))}
                  className="text-sm bg-background/60"
                />
                <Input
                  placeholder="Impact description"
                  value={newBugForm.impact}
                  onChange={e => setNewBugForm(p => ({ ...p, impact: e.target.value }))}
                  className="text-sm bg-background/60"
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={logNewBug} className="bg-primary hover:bg-amber-700">Save Bug</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowBugForm(false)}>Cancel</Button>
              </div>
            </Card>
          )}

          {/* Bug Table */}
          <div className="space-y-2">
            {filteredBugs.length === 0 && (
              <p className="text-center text-slate-500 text-sm py-8">No bugs match the current filter.</p>
            )}
            {filteredBugs.map(bug => (
              <div
                key={bug.id}
                className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                  bug.status === 'Fixed'
                    ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60'
                    : 'bg-card/40 border-border/60 hover:border-primary/30'
                }`}
              >
                <div className="flex flex-col items-start gap-1 min-w-[80px]">
                  <span className="text-xs font-mono text-slate-500">{bug.id}</span>
                  {bug.status === 'Fixed' ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" /> Fixed {bug.pr}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-orange-400">
                      <Clock className="w-3 h-3" /> Open
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{bug.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">{bug.file}</p>
                  {bug.impact && <p className="text-xs text-slate-400 mt-1">{bug.impact}</p>}
                </div>
                <SeverityBadge severity={bug.severity} />
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ────── FEATURES TAB ────── */}
        <TabsContent value="features">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {columnOrder.map(col => (
              <div key={col} className={`rounded-xl border ${columnColors[col]} bg-card/30 p-4 space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-semibold ${columnHeaderColors[col]}`}>{col}</h3>
                  <span className="text-xs text-slate-500 bg-background/60 rounded px-2 py-0.5">
                    {FEATURES.filter(f => f.column === col).length}
                  </span>
                </div>
                <div className="space-y-2">
                  {FEATURES.filter(f => f.column === col).map(feature => (
                    <div key={feature.id} className="bg-background/60 border border-border/40 rounded-lg p-3 space-y-2">
                      <p className="text-xs font-medium text-foreground leading-snug">{feature.title}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{feature.description}</p>
                      <div className="flex items-center gap-2">
                        <EffortBadge effort={feature.effort} />
                        <ImpactBadge impact={feature.impact} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ────── ANALYTICS TAB ────── */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bug Distribution */}
            <Card className="bg-card/50 border-border/60 col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">Bug Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(['Critical', 'High', 'Medium', 'Low'] as const).map(s => {
                  const count = localBugs.filter(b => b.severity === s && b.status === 'Open').length;
                  const total = localBugs.filter(b => b.status === 'Open').length;
                  const pct = total ? Math.round((count / total) * 100) : 0;
                  const barColors: Record<string, string> = {
                    Critical: 'bg-red-500', High: 'bg-orange-500', Medium: 'bg-yellow-500', Low: 'bg-slate-500'
                  };
                  return (
                    <div key={s} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">{s}</span>
                        <span className="text-foreground font-medium">{count}</span>
                      </div>
                      <div className="h-1.5 bg-border/40 rounded-full">
                        <div className={`h-full ${barColors[s]} rounded-full`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* PR Velocity */}
            <Card className="bg-card/50 border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">PR Velocity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'Total PRs (all time)', value: '94', color: 'text-primary' },
                  { label: 'PRs since Feb 26', value: '47+', color: 'text-blue-400' },
                  { label: 'Avg PRs/day (since Feb 26)', value: '~4.7', color: 'text-cyan-400' },
                  { label: 'Largest feature sprint', value: 'Stacking (30 PRs)', color: 'text-orange-400' },
                  { label: 'Vercel deployments (recent)', value: '20', color: 'text-emerald-400' },
                  { label: 'Latest PR', value: '#94', color: 'text-foreground' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">{label}</span>
                    <span className={`text-xs font-semibold ${color}`}>{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Feature Breakdown */}
            <Card className="bg-card/50 border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground">Feature Pipeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {columnOrder.map(col => {
                  const count = FEATURES.filter(f => f.column === col).length;
                  return (
                    <div key={col} className="flex justify-between items-center">
                      <span className={`text-xs ${columnHeaderColors[col]}`}>{col}</span>
                      <span className="text-xs font-semibold text-foreground">{count} features</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* App Health */}
          <Card className="bg-card/50 border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Production Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Frontend (Vercel)', status: '✅ READY', url: 'https://talisman-io.vercel.app' },
                  { label: 'Backend (Render)', status: '⚠️ Free tier (cold starts)', url: 'https://talisman-io-backend.onrender.com' },
                  { label: 'TypeScript', status: '✅ Clean (Feb 26)' },
                  { label: 'API Endpoints', status: '✅ 7/7 returning 200' },
                ].map(({ label, status, url }) => (
                  <div key={label} className="space-y-1">
                    <p className="text-xs text-slate-500">{label}</p>
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline block truncate">
                        {status}
                      </a>
                    ) : (
                      <p className="text-xs text-foreground">{status}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border/40">
                <p className="text-xs text-slate-500 mb-2">Deals in Database</p>
                <div className="flex gap-3">
                  {['The Skylark', 'Adley City Springs', '1160 Hammond'].map(deal => (
                    <span key={deal} className="text-xs bg-primary/10 border border-primary/20 text-primary px-2 py-1 rounded-md">
                      {deal}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analytics Coming Soon Banner */}
          <Card className="bg-gradient-to-r from-amber-900/20 to-yellow-900/10 border-primary/20">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Real User Analytics — Not Yet Instrumented</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Integrate <span className="text-amber-300">PostHog</span> or <span className="text-amber-300">Mixpanel</span> to track:
                    uploads/week, page views, deal pipeline velocity, session duration, feature adoption.
                    This is Feature F-012 in the backlog.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────── PM AGENT TAB ────── */}
        <TabsContent value="agent">
          <div className="flex flex-col gap-4" style={{ height: '60vh' }}>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {agentMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-br-sm'
                        : 'bg-card/70 border border-border/60 text-foreground rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                    <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-amber-200' : 'text-slate-500'}`}>
                      {msg.timestamp}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Suggested prompts */}
            <div className="flex flex-wrap gap-2">
              {[
                'What are the critical bugs?',
                'What shipped since Feb 26?',
                'What should I fix next?',
                "How's production health?",
              ].map(prompt => (
                <button
                  key={prompt}
                  onClick={() => { setAgentInput(prompt); }}
                  className="text-xs px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                value={agentInput}
                onChange={e => setAgentInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendAgentMessage()}
                placeholder="Ask about bugs, PRs, features, production status..."
                className="bg-card/60 border-border/60 flex-1"
              />
              <Button onClick={sendAgentMessage} className="bg-primary hover:bg-amber-700 gap-1.5">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ────── GIT ACTIVITY TAB ────── */}
        <TabsContent value="activity" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Recent PRs */}
            <Card className="bg-card/50 border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-primary" /> Recent Merged PRs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {RECENT_PRS.map(pr => (
                  <div key={pr.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-background/60 transition-colors">
                    <span className="text-xs font-mono text-primary flex-shrink-0 mt-0.5">{pr.id}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">{pr.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{pr.date}</p>
                    </div>
                    <span className="text-xs text-emerald-400 flex-shrink-0">✓</span>
                  </div>
                ))}
                <a
                  href="https://github.com/grshapiro2001-crypto/talisman-io/pulls?q=is%3Apr+is%3Amerged"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-primary hover:underline pt-2"
                >
                  <ExternalLink className="w-3 h-3" /> View all PRs on GitHub
                </a>
              </CardContent>
            </Card>

            {/* Uncommitted Files */}
            <Card className="bg-card/50 border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-yellow-400" /> Uncommitted / Untracked
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { file: '.ai/04-CURRENT-WORK.md', type: 'Modified', note: 'Updated this session' },
                  { file: 'QA-AUDIT.md', type: 'Modified', note: 'Updated this session' },
                  { file: 'frontend/package-lock.json', type: 'Modified', note: 'Dependency lockfile' },
                  { file: 'backend/alembic/versions/48227cc781d4_merge...', type: 'Untracked', note: 'Migration merge file' },
                  { file: 'claude-code-bugfix-prompt.md', type: 'Untracked', note: 'Session prompt file' },
                  { file: 'dashboard-mockup-v1–v5.html', type: 'Untracked', note: 'Command center mockups' },
                ].map(({ file, type, note }) => (
                  <div key={file} className="flex items-start gap-3">
                    <span className={`text-xs font-mono flex-shrink-0 mt-0.5 ${type === 'Modified' ? 'text-yellow-400' : 'text-blue-400'}`}>
                      {type === 'Modified' ? 'M' : '?'}
                    </span>
                    <div>
                      <p className="text-xs font-mono text-foreground truncate">{file}</p>
                      <p className="text-xs text-slate-500">{note}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Feature Area Summary */}
            <Card className="bg-card/50 border-border/60 lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-400" /> New Code Areas Since Feb 26
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      area: '3D Stacking Viewer',
                      prs: 'PRs #62–94 (~30 PRs)',
                      files: '9 new components + 3 backend services',
                      description: 'Three.js building model, rent roll parser, floor plan overlay, satellite extraction',
                      color: 'border-primary/30 bg-primary/5',
                    },
                    {
                      area: 'Organizations',
                      prs: 'PRs #46–49',
                      files: '1 new page + 1 component + 1 route + 1 model',
                      description: 'Team workspaces, invite flow, org context on Dashboard/Library',
                      color: 'border-blue-500/30 bg-blue-500/5',
                    },
                    {
                      area: 'AI Extraction & Scoring',
                      prs: 'PRs #50, #55–60',
                      files: '4 new backend services',
                      description: 'Market research extraction, Layer 2 sentiment scoring, T12 Excel fuzzy matching, async re-analyze',
                      color: 'border-cyan-500/30 bg-cyan-500/5',
                    },
                  ].map(({ area, prs, files, description, color }) => (
                    <div key={area} className={`rounded-xl border p-4 space-y-2 ${color}`}>
                      <p className="text-sm font-semibold text-foreground">{area}</p>
                      <p className="text-xs font-mono text-slate-400">{prs}</p>
                      <p className="text-xs text-slate-400">{files}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ────── USERS TAB ────── */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">User Management</h2>
              <p className="text-xs text-slate-500">Approve, suspend, and onboard demo users</p>
            </div>
            <Button size="sm" variant="outline" onClick={fetchUsers} disabled={usersLoading}>
              {usersLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Refresh
            </Button>
          </div>

          {usersError && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
              {usersError}
            </div>
          )}

          {usersLoading && adminUsers.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Pending users first, then active, then suspended */}
              {[...adminUsers]
                .sort((a, b) => {
                  const order = { pending: 0, active: 1, suspended: 2 };
                  return (order[a.account_status] ?? 3) - (order[b.account_status] ?? 3);
                })
                .map(u => (
                  <Card key={u.id} className={`bg-card/50 border-border/60 ${
                    u.account_status === 'pending' ? 'border-l-4 border-l-amber-500' :
                    u.account_status === 'suspended' ? 'border-l-4 border-l-red-500/60 opacity-60' : ''
                  }`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        {/* User info */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                            u.account_status === 'active' ? 'bg-emerald-500/15' :
                            u.account_status === 'pending' ? 'bg-amber-500/15' : 'bg-red-500/15'
                          }`}>
                            {u.account_status === 'active' ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> :
                             u.account_status === 'pending' ? <Shield className="w-4 h-4 text-amber-400" /> :
                             <ShieldX className="w-4 h-4 text-red-400" />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">
                                {u.full_name || u.email.split('@')[0]}
                              </p>
                              {u.is_admin && (
                                <span className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 truncate">{u.email}</p>
                            <p className="text-[10px] text-slate-600">
                              Joined {new Date(u.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {/* Status badge + actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[10px] font-mono px-2 py-1 rounded-full ${
                            u.account_status === 'active' ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' :
                            u.account_status === 'pending' ? 'text-amber-400 bg-amber-500/10 border border-amber-500/20' :
                            'text-red-400 bg-red-500/10 border border-red-500/20'
                          }`}>
                            {u.account_status.toUpperCase()}
                          </span>

                          {!u.is_admin && (
                            <>
                              {u.account_status === 'pending' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                  disabled={updatingUserId === u.id}
                                  onClick={() => handleStatusChange(u.id, 'active')}
                                >
                                  {updatingUserId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                                  Approve
                                </Button>
                              )}
                              {u.account_status === 'active' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                                  disabled={updatingUserId === u.id}
                                  onClick={() => handleStatusChange(u.id, 'suspended')}
                                >
                                  {updatingUserId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserX className="w-3 h-3" />}
                                  Suspend
                                </Button>
                              )}
                              {u.account_status === 'suspended' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                  disabled={updatingUserId === u.id}
                                  onClick={() => handleStatusChange(u.id, 'active')}
                                >
                                  {updatingUserId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />}
                                  Reactivate
                                </Button>
                              )}

                              {/* Onboarding email button — only for active users */}
                              {u.account_status === 'active' && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs gap-1 text-slate-400 hover:text-foreground"
                                  onClick={() => copyOnboardingEmail(u)}
                                >
                                  {copiedEmail === u.id ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Mail className="w-3 h-3" />}
                                  {copiedEmail === u.id ? 'Copied!' : 'Copy Welcome Email'}
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

              {adminUsers.length === 0 && !usersLoading && (
                <div className="text-center py-12 text-slate-500 text-sm">
                  No users found. Click Refresh to load.
                </div>
              )}
            </div>
          )}

          {/* Onboarding Email Template Preview */}
          <Card className="bg-card/30 border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Mail className="w-4 h-4" /> Onboarding Email Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-slate-500 whitespace-pre-wrap font-mono leading-relaxed bg-background/50 rounded-lg p-4 border border-border/30">
{`Subject: Welcome to Talisman IO — You're In!

Hey [Name],

Great news — your Talisman IO account is now active.

Here's how to get started:
1. Log in at https://talisman-io.vercel.app
2. Upload your first Offering Memorandum or Rent Roll
3. Watch Talisman extract financials, score the deal, and build your stacking model

You're one of our first demo users, so your feedback is incredibly valuable.
Use the feedback widget (bottom-left of the app) to report bugs or suggest features.

If anything feels off or you get stuck, reach out directly — I'm watching every submission.

— Griffin
CEO, Talisman IO`}
              </pre>
              <p className="text-[10px] text-slate-600 mt-2">
                Click "Copy Welcome Email" on any active user to copy a personalized version.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ────── FEEDBACK TAB ────── */}
        <TabsContent value="feedback" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Feedback Reports</h2>
              <p className="text-xs text-slate-500">Bug reports, feature requests, and user feedback</p>
            </div>
            <Button size="sm" variant="outline" onClick={fetchFeedback} disabled={feedbackLoading}>
              {feedbackLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Refresh
            </Button>
          </div>

          {feedbackLoading && feedbackReports.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : feedbackReports.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">
              No feedback reports yet. Click Refresh to load.
            </div>
          ) : (
            <div className="space-y-3">
              {feedbackReports.map(report => (
                <Card key={report.id} className={`bg-card/50 border-border/60 ${
                  report.severity === 'critical' ? 'border-l-4 border-l-red-500' :
                  report.severity === 'high' ? 'border-l-4 border-l-orange-500' :
                  report.category === 'feature' ? 'border-l-4 border-l-blue-500' : ''
                }`}>
                  <div className="p-4 space-y-3">
                    {/* Header row */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          report.category === 'bug' ? 'text-red-400 bg-red-500/10' :
                          report.category === 'feature' ? 'text-blue-400 bg-blue-500/10' :
                          'text-slate-400 bg-slate-500/10'
                        }`}>
                          {report.category.toUpperCase()}
                        </span>
                        {report.category === 'bug' && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            report.severity === 'critical' ? 'text-red-400 bg-red-500/10' :
                            report.severity === 'high' ? 'text-orange-400 bg-orange-500/10' :
                            report.severity === 'medium' ? 'text-yellow-400 bg-yellow-500/10' :
                            'text-slate-400 bg-slate-500/10'
                          }`}>
                            {report.severity.toUpperCase()}
                          </span>
                        )}
                        <span className="text-xs text-slate-500">
                          by {report.user_name || report.user_email || 'Unknown'}
                        </span>
                        <span className="text-[10px] text-slate-600">
                          {new Date(report.created_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Status dropdown */}
                      <select
                        value={report.status}
                        onChange={(e) => handleFeedbackStatusChange(report.id, e.target.value)}
                        className={`text-[10px] font-mono px-2 py-1 rounded border bg-background cursor-pointer ${
                          report.status === 'open' ? 'text-amber-400 border-amber-500/30' :
                          report.status === 'in_progress' ? 'text-blue-400 border-blue-500/30' :
                          report.status === 'resolved' ? 'text-emerald-400 border-emerald-500/30' :
                          'text-slate-400 border-slate-500/30'
                        }`}
                      >
                        <option value="open">OPEN</option>
                        <option value="in_progress">IN PROGRESS</option>
                        <option value="resolved">RESOLVED</option>
                        <option value="closed">CLOSED</option>
                      </select>
                    </div>

                    {/* Title + description */}
                    <p className="text-sm font-medium text-foreground">{report.title}</p>
                    {report.description && (
                      <p className="text-xs text-slate-400 leading-relaxed">{report.description}</p>
                    )}

                    {/* Screenshot */}
                    {report.screenshot_url && (
                      <img
                        src={report.screenshot_url}
                        alt="Screenshot"
                        className="rounded-lg border border-border/40 max-h-40 object-contain"
                      />
                    )}

                    {/* App state context */}
                    {(report.current_url || report.active_tab || report.viewport_size) && (
                      <div className="flex flex-wrap gap-2">
                        {report.current_url && (
                          <span className="text-[10px] font-mono text-slate-600 bg-background/50 px-2 py-0.5 rounded border border-border/30">
                            {report.current_url.replace(/https?:\/\/[^/]+/, '')}
                          </span>
                        )}
                        {report.active_tab && (
                          <span className="text-[10px] font-mono text-slate-600 bg-background/50 px-2 py-0.5 rounded border border-border/30">
                            Tab: {report.active_tab}
                          </span>
                        )}
                        {report.viewport_size && (
                          <span className="text-[10px] font-mono text-slate-600 bg-background/50 px-2 py-0.5 rounded border border-border/30">
                            {report.viewport_size}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Replies */}
                    {report.replies.length > 0 && (
                      <div className="border-t border-border/30 pt-2 space-y-2">
                        {report.replies.map(reply => (
                          <div key={reply.id} className="flex gap-2 text-xs">
                            <Reply className="w-3 h-3 text-slate-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <span className="font-medium text-primary">{reply.user_name || reply.user_email}: </span>
                              <span className="text-slate-400">{reply.message}</span>
                              <span className="text-[10px] text-slate-600 ml-2">
                                {new Date(reply.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Reply input */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Reply to this report..."
                        value={feedbackReplyText[report.id] || ''}
                        onChange={(e) => setFeedbackReplyText(prev => ({ ...prev, [report.id]: e.target.value }))}
                        className="text-xs h-8"
                        onKeyDown={(e) => e.key === 'Enter' && handleReply(report.id)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3"
                        disabled={!feedbackReplyText[report.id]?.trim() || replyingTo === report.id}
                        onClick={() => handleReply(report.id)}
                      >
                        {replyingTo === report.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
