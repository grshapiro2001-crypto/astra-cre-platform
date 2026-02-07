# AI Chatbot Feature - Astra CRE Platform

**Purpose:** Specification for context-aware AI chatbot integrated throughout the platform
**Priority:** 9/10 - Golden Feature
**Last Updated:** February 7, 2026
**Status:** Ready for Implementation

---

## Executive Summary

The AI Chatbot is a persistent, context-aware assistant accessible from anywhere in the Astra CRE platform. It acts as a "lazy interface" for quick queries about deals, portfolios, market research, and general CRE questions. The chatbot:

1. **Always Available** - Animated icon in fixed position (bottom-right)
2. **Context-Aware** - Knows current page, deal being viewed, portfolio selection
3. **Powerful Query Engine** - Can answer questions about deals, portfolio analysis, market research
4. **Multi-Modal Search** - Searches internal data AND web (market research)
5. **Natural Language** - Uses Claude Sonnet 4 for conversational AI
6. **Design-System Compatible** - Purple/emerald gradient theme matching existing UI
7. **Persistence** - Maintains chat history per session

---

## 1. UI/UX Design

### 1.1 Animated Icon (Persistent Entry Point)

**Visual Design:**
```
┌─────────────────────────────────────────────────────┐
│                   Astra CRE Platform                │
├─────────────────────────────────────────────────────┤
│                                                  ╭──┐│
│   [Content Area]                                │⊙ ││ <- Animated Icon
│                                                  ╰──┘│
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Specifications:**
- **Position:** Fixed bottom-right corner (z-index: 400, below modals but above most content)
- **Size:** 56px × 56px circular button
- **Background:** Gradient (emerald-500 to emerald-700) with subtle glow
- **Icon:** Sparkle or message icon (animated pulse when AI is processing)
- **Animation States:**
  - **Idle:** Subtle rotation pulse (360° over 3s)
  - **Hovering:** Scale 1.1, glow increases
  - **Active/Chat Open:** Pulse with emerald glow
  - **Processing:** Icon spins gently, input field shows typing indicator
  - **Unread Message:** Bouncing animation with notification badge

**Accessibility:**
- Tab-reachable with keyboard
- Screen reader label: "Open AI Assistant"
- ARIA labels for all interactive states
- Focus ring visible and contrasted

### 1.2 Chat Panel Layout

**When Closed:**
- Only the animated icon visible
- Icon shows unread count badge if new messages

**When Opened:**
```
┌─────────────────────────────────┐
│  ⊙ AI Assistant           [×]   │  <- Header with close button
├─────────────────────────────────┤
│                                 │
│  [Chat messages area]           │
│  - Assistant messages (left)    │
│  - User messages (right)        │
│                                 │
│                                 │
├─────────────────────────────────┤
│ [Input field with send button]  │  <- Message input
│ "Ask me anything..."            │
└─────────────────────────────────┘
```

**Panel Specifications:**
- **Dimensions:** 400px wide × 600px tall (responsive: 90vw × 70vh on mobile)
- **Position:** Fixed bottom-right, 20px from edges
- **Background:** Semi-transparent dark (rgba with backdrop blur)
- **Border:** Subtle emerald gradient border
- **Shadow:** Drop shadow for depth
- **Z-index:** 401 (above most UI, below modals)
- **Animation:** Slide up from bottom + fade in (200ms)

**Header:**
- Close button (X) on right
- Title: "AI Assistant"
- Optional: Settings icon (future: tone, capabilities toggle)

**Message Area:**
- Scrollable container with auto-scroll to latest message
- Supports markdown rendering (bold, italic, code blocks, lists)
- Code syntax highlighting
- Links are clickable

**Input Area:**
- Text input field with placeholder: "Ask about deals, portfolio, market..."
- Send button (arrow icon) or Shift+Enter to send
- Growing textarea (expands as you type, max 5 lines)
- Shows character count on long inputs
- Disables input while processing

### 1.3 Context Display

Inside the chat, show current context prominently:

```
┌─────────────────────────────────┐
│  ⊙ AI Assistant                 │
├─────────────────────────────────┤
│  📍 Context: Deal View           │
│  📌 "Prose Gainesville - 50 units"
│                                 │
│  [Chat messages below]          │
```

**Context Bar Shows:**
- Current page/section
- Current deal (if in deal view)
- Current portfolio (if portfolio analysis)
- Quick filter: Can say "Only this deal" or "All portfolio"

---

## 2. Technical Architecture

### 2.1 Frontend Component Structure

```
src/
├── components/
│   └── chatbot/
│       ├── ChatbotIcon.tsx              # Persistent animated button
│       ├── ChatPanel.tsx                # Main chat UI panel
│       ├── MessageList.tsx              # Message display area
│       ├── MessageItem.tsx              # Individual message component
│       ├── ChatInput.tsx                # Input field + send button
│       ├── ContextBar.tsx               # Shows current context
│       └── ChatbotProvider.tsx          # Context provider
│
├── store/
│   └── chatbotStore.ts                 # Zustand store for chat state
│
├── services/
│   └── chatbotService.ts               # API calls to backend
│
├── hooks/
│   └── useChatbot.ts                   # Custom hook for chatbot logic
│
└── types/
    └── chatbot.ts                      # TypeScript types
```

### 2.2 Frontend State Management (Zustand)

```typescript
// store/chatbotStore.ts
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: {
    page: string;
    dealId?: string;
    portfolioId?: string;
  };
}

interface ChatbotState {
  // UI State
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  toggleChat: () => void;

  // Chat History
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  clearHistory: () => void;

  // Loading State
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Context
  currentContext: {
    page: string;
    dealId?: string;
    portfolioId?: string;
    viewData?: any;
  };
  setContext: (context: any) => void;

  // Unread Count
  unreadCount: number;
  incrementUnread: () => void;
  clearUnread: () => void;
}

export const useChatbotStore = create<ChatbotState>()(
  persist(
    (set) => ({
      isOpen: false,
      setIsOpen: (open) => set({ isOpen: open }),
      toggleChat: () => set((state) => ({ isOpen: !state.isOpen })),

      messages: [],
      addMessage: (message) =>
        set((state) => ({ messages: [...state.messages, message] })),
      clearHistory: () => set({ messages: [] }),

      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),

      currentContext: { page: 'dashboard' },
      setContext: (context) => set({ currentContext: context }),

      unreadCount: 0,
      incrementUnread: () =>
        set((state) => ({ unreadCount: state.unreadCount + 1 })),
      clearUnread: () => set({ unreadCount: 0 }),
    }),
    {
      name: 'astra-chatbot-storage',
      partialize: (state) => ({
        messages: state.messages.slice(-50), // Keep last 50 messages
        currentContext: state.currentContext,
      }),
    }
  )
);
```

### 2.3 Context Awareness System

**How It Works:**
1. Each main page component updates the chatbot context when mounted
2. When viewing a specific deal, the dealId is added to context
3. When in portfolio view, portfolioId is added
4. Context is automatically included in every chat message to backend

**Implementation Pattern:**

```typescript
// In Dashboard.tsx
useEffect(() => {
  useChatbotStore.setState({
    currentContext: {
      page: 'dashboard',
      viewData: { /* summary stats */ }
    }
  });
}, []);

// In DealDetail.tsx
useEffect(() => {
  useChatbotStore.setState({
    currentContext: {
      page: 'deal-detail',
      dealId: dealId,
      viewData: { deal, properties, metrics }
    }
  });
}, [dealId]);

// In PortfolioAnalysis.tsx
useEffect(() => {
  useChatbotStore.setState({
    currentContext: {
      page: 'portfolio-analysis',
      portfolioId: portfolioId,
      viewData: { portfolio, deals, summaryMetrics }
    }
  });
}, [portfolioId]);
```

**Context Bar Component:**

```typescript
// components/chatbot/ContextBar.tsx
export const ContextBar: React.FC = () => {
  const context = useChatbotStore((s) => s.currentContext);

  const contextLabel = {
    dashboard: '📊 Dashboard',
    'deal-detail': `🏢 ${context.viewData?.deal?.name || 'Deal View'}`,
    'property-detail': `🏘️ ${context.viewData?.property?.address || 'Property'}`,
    'portfolio-analysis': '📈 Portfolio Analysis',
    'comparison': '⚖️ Comparison View',
  };

  return (
    <div className="px-4 py-2 bg-emerald-900/30 border-b border-emerald-700/50 text-xs text-emerald-300">
      <div className="flex items-center gap-2">
        <span>{contextLabel[context.page]}</span>
        {context.dealId && (
          <Badge variant="secondary" className="text-emerald-200">
            Deal #{context.dealId.slice(0, 8)}
          </Badge>
        )}
      </div>
    </div>
  );
};
```

### 2.4 Frontend Components Detail

**ChatbotIcon.tsx:**

```typescript
export interface ChatbotIconProps {
  animated?: boolean;
  unreadCount?: number;
  onClick?: () => void;
}

export const ChatbotIcon: React.FC<ChatbotIconProps> = ({
  animated = true,
  unreadCount = 0,
  onClick,
}) => {
  const isOpen = useChatbotStore((s) => s.isOpen);

  return (
    <button
      onClick={onClick}
      className={`
        fixed bottom-6 right-6
        w-14 h-14 rounded-full
        bg-gradient-to-br from-emerald-500 to-emerald-700
        hover:from-emerald-400 hover:to-emerald-600
        shadow-lg hover:shadow-emerald-500/50
        flex items-center justify-center
        text-white transition-all z-400
        ${animated && !isOpen && 'animate-pulse'}
        ${isOpen && 'ring-2 ring-emerald-300'}
        focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2
      `}
      aria-label="Open AI Assistant"
      title="Ask AI Assistant"
    >
      <Sparkles className="w-6 h-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
};
```

**ChatPanel.tsx:**

```typescript
export const ChatPanel: React.FC = () => {
  const { isOpen, messages, toggleChat } = useChatbotStore();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      timestamp: new Date(),
      context: useChatbotStore.getState().currentContext,
    };

    useChatbotStore.setState((state) => ({
      messages: [...state.messages, userMessage],
    }));

    setInput('');

    // Call backend
    try {
      const response = await chatbotService.sendMessage(userMessage);
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
      };
      useChatbotStore.setState((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
      }));
    } catch (error) {
      console.error('Chat error:', error);
      // Show error message in chat
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-slate-950/95 backdrop-blur rounded-lg shadow-2xl border border-emerald-500/20 flex flex-col z-401 animate-in slide-in-from-bottom">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-emerald-700/30">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          AI Assistant
        </h3>
        <button
          onClick={toggleChat}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Context Bar */}
      <ContextBar />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 text-sm">
            <Sparkles className="w-8 h-8 mb-2 text-emerald-400" />
            <p>Ask me about deals, portfolio, or market research</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageItem key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput onSend={handleSendMessage} />
    </div>
  );
};
```

---

## 3. Backend API Architecture

### 3.1 Backend Route Structure

```
app/
├── api/
│   └── routes/
│       ├── chatbot.py              # NEW: All chatbot endpoints
│       └── ... (existing routes)
│
├── services/
│   ├── chatbot_service.py          # NEW: Chatbot business logic
│   ├── deal_query_service.py       # NEW: Deal/portfolio queries
│   ├── web_search_service.py       # NEW: Web search integration
│   └── ... (existing services)
│
├── models/
│   └── chatbot.py                  # NEW: Chat history model
│
└── schemas/
    └── chatbot.py                  # NEW: Pydantic schemas
```

### 3.2 FastAPI Routes

```python
# app/api/routes/chatbot.py
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from app.schemas.chatbot import ChatMessageRequest, ChatMessageResponse, ChatContextRequest
from app.services.chatbot_service import ChatbotService
from app.api.deps import get_current_user

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])

@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    request: ChatMessageRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Send a message to the AI assistant.

    - Includes context (current page, deal ID, etc.)
    - AI processes query against internal data + web search
    - Returns structured response with citations
    """
    service = ChatbotService()
    response = await service.process_message(
        user_id=current_user["id"],
        message=request.message,
        context=request.context,
        chat_history=request.chat_history,
    )
    return response

@router.get("/history")
async def get_chat_history(
    limit: int = Query(50, le=100),
    current_user: dict = Depends(get_current_user),
):
    """Get chat history for current user (last N messages)."""
    service = ChatbotService()
    history = await service.get_chat_history(user_id=current_user["id"], limit=limit)
    return {"messages": history}

@router.delete("/history")
async def clear_chat_history(
    current_user: dict = Depends(get_current_user),
):
    """Clear all chat history for current user."""
    service = ChatbotService()
    await service.clear_chat_history(user_id=current_user["id"])
    return {"status": "cleared"}

@router.post("/context")
async def update_context(
    request: ChatContextRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Update current context (page, deal, portfolio).
    Called when user navigates.
    """
    service = ChatbotService()
    context = await service.update_context(
        user_id=current_user["id"],
        context=request.context,
    )
    return {"context": context}

@router.post("/query-deals")
async def query_deals(
    query: str = Query(...),
    portfolio_id: Optional[str] = None,
    deal_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    """
    Query deals directly (for AI to use internally).
    Examples:
    - "Show all deals with IRR > 15%"
    - "Which multifamily deals are in the pipeline?"
    - "What's the average cap rate?"
    """
    service = ChatbotService()
    results = await service.query_deals(
        user_id=current_user["id"],
        query=query,
        portfolio_id=portfolio_id,
        deal_id=deal_id,
    )
    return {"results": results}

@router.post("/analyze-portfolio")
async def analyze_portfolio(
    portfolio_id: str,
    analysis_type: str = Query("summary"),  # summary, risk, returns, market
    current_user: dict = Depends(get_current_user),
):
    """
    Analyze portfolio (for AI to use).
    Analysis types: summary, risk, returns, market
    """
    service = ChatbotService()
    analysis = await service.analyze_portfolio(
        user_id=current_user["id"],
        portfolio_id=portfolio_id,
        analysis_type=analysis_type,
    )
    return {"analysis": analysis}

@router.post("/web-search")
async def web_search(
    query: str = Query(...),
    limit: int = Query(5, le=10),
    current_user: dict = Depends(get_current_user),
):
    """
    Web search for market research.
    Used by AI to find current market data, trends, etc.
    """
    service = ChatbotService()
    results = await service.web_search(
        query=query,
        limit=limit,
    )
    return {"results": results}
```

### 3.3 Pydantic Schemas

```python
# app/schemas/chatbot.py
from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class ChatContext(BaseModel):
    """Current context: where user is in app"""
    page: str  # dashboard, deal-detail, portfolio-analysis, etc.
    deal_id: Optional[str] = None
    portfolio_id: Optional[str] = None
    view_data: Optional[dict] = None  # Actual data displayed to user

class ChatMessageRequest(BaseModel):
    """User message sent to AI"""
    message: str
    context: ChatContext
    chat_history: Optional[List[dict]] = None  # Previous messages for context

class ChatMessageResponse(BaseModel):
    """AI response"""
    id: str
    role: str = "assistant"
    content: str
    timestamp: datetime
    citations: Optional[List[dict]] = None  # Sources (deals, web articles)
    suggested_actions: Optional[List[str]] = None  # Follow-up queries
    error: Optional[str] = None

class ChatContextRequest(BaseModel):
    """Update context"""
    context: ChatContext

class DealQueryResult(BaseModel):
    """Result from deal query"""
    deal_id: str
    name: str
    status: str
    metrics: dict
    match_score: Optional[float] = None

class PortfolioAnalysis(BaseModel):
    """Portfolio analysis result"""
    portfolio_id: str
    total_deals: int
    total_value: float
    average_metrics: dict
    analysis: str
```

### 3.4 Chatbot Service

```python
# app/services/chatbot_service.py
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from anthropic import Anthropic

class ChatbotService:
    def __init__(self):
        self.client = Anthropic()
        self.model = "claude-3-5-sonnet-20241022"

    async def process_message(
        self,
        user_id: str,
        message: str,
        context: Dict[str, Any],
        chat_history: Optional[List] = None,
    ) -> Dict[str, Any]:
        """
        Process user message through Claude Sonnet 4.

        1. Build system prompt with context
        2. Execute tool_use for deal queries/web search if needed
        3. Return response with citations
        """

        # Build system prompt
        system_prompt = self._build_system_prompt(user_id, context)

        # Build messages array with history
        messages = chat_history or []
        messages.append({
            "role": "user",
            "content": message
        })

        # Define tools for Claude
        tools = [
            {
                "name": "query_deals",
                "description": "Query deals by criteria (IRR, cap rate, location, etc)",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Natural language query about deals"
                        },
                        "portfolio_id": {
                            "type": "string",
                            "description": "Optional: restrict to specific portfolio"
                        }
                    },
                    "required": ["query"]
                }
            },
            {
                "name": "analyze_portfolio",
                "description": "Get portfolio analysis and metrics",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "portfolio_id": {
                            "type": "string",
                            "description": "Portfolio to analyze"
                        },
                        "analysis_type": {
                            "type": "string",
                            "enum": ["summary", "risk", "returns", "market"],
                            "description": "Type of analysis"
                        }
                    },
                    "required": ["portfolio_id"]
                }
            },
            {
                "name": "web_search",
                "description": "Search web for market research and news",
                "input_schema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query for market research"
                        }
                    },
                    "required": ["query"]
                }
            }
        ]

        # Call Claude with tool_use
        response = await self._call_claude_with_tools(
            system_prompt=system_prompt,
            messages=messages,
            tools=tools,
        )

        # Process response and handle tool calls
        final_response = await self._process_response(
            response=response,
            user_id=user_id,
            context=context,
        )

        # Save to chat history
        await self._save_chat_history(
            user_id=user_id,
            messages=[
                {"role": "user", "content": message},
                {"role": "assistant", "content": final_response["content"]}
            ]
        )

        return final_response

    def _build_system_prompt(self, user_id: str, context: Dict[str, Any]) -> str:
        """Build Claude system prompt with context"""
        context_text = f"""
You are an expert CRE (Commercial Real Estate) AI Assistant for the Astra CRE platform.
You help users analyze deals, portfolios, and market research.

## Current Context
- Page: {context.get('page', 'unknown')}
- Deal: {context.get('deal_id', 'None')}
- Portfolio: {context.get('portfolio_id', 'None')}

## Your Capabilities
1. **Deal Queries**: Query deals by metrics (IRR, cap rate, location, property type, status)
2. **Portfolio Analysis**: Analyze portfolios for risk, returns, composition
3. **Market Research**: Search web for market trends, economic data, comparable deals
4. **Explanations**: Explain CRE concepts, metrics, investment strategies

## Style
- Be concise but thorough
- Use the user's current context when relevant
- Suggest follow-up queries for deeper analysis
- Always cite sources for facts
- Use metrics from the actual deals when available
- Provide actionable insights, not just data

## Important
- When user asks about "this deal", use the current deal_id in context
- When asking portfolio questions, use current portfolio_id if available
- Use tools for any factual queries
- Always be specific with metrics and numbers
"""
        return context_text.strip()

    async def _call_claude_with_tools(
        self,
        system_prompt: str,
        messages: List[dict],
        tools: List[dict],
    ) -> Any:
        """Call Claude API with tool_use capability"""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            system=system_prompt,
            tools=tools,
            messages=messages,
        )
        return response

    async def _process_response(
        self,
        response: Any,
        user_id: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Process Claude response, handling tool calls"""
        # Handle tool_use blocks
        text_parts = []
        citations = []

        for block in response.content:
            if hasattr(block, 'text'):
                text_parts.append(block.text)
            elif hasattr(block, 'type') and block.type == 'tool_use':
                # Execute tool and get results
                tool_result = await self._execute_tool(
                    block.name,
                    block.input,
                    user_id,
                    context,
                )
                # Tool results are incorporated back into conversation
                if tool_result.get('citations'):
                    citations.extend(tool_result['citations'])

        return {
            "id": response.id,
            "role": "assistant",
            "content": "\n".join(text_parts),
            "timestamp": datetime.now(),
            "citations": citations or None,
        }

    async def _execute_tool(
        self,
        tool_name: str,
        tool_input: Dict[str, Any],
        user_id: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Execute tool and return results"""
        if tool_name == "query_deals":
            return await self._query_deals_impl(tool_input, user_id, context)
        elif tool_name == "analyze_portfolio":
            return await self._analyze_portfolio_impl(tool_input, user_id, context)
        elif tool_name == "web_search":
            return await self._web_search_impl(tool_input)
        else:
            return {"error": f"Unknown tool: {tool_name}"}

    async def _query_deals_impl(
        self,
        input_data: Dict[str, Any],
        user_id: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Query deals based on natural language"""
        # This would use DealQueryService to search deals
        # Returns: list of matching deals with scores
        from app.services.deal_query_service import DealQueryService

        service = DealQueryService()
        results = await service.query_deals(
            query=input_data.get("query"),
            portfolio_id=input_data.get("portfolio_id") or context.get("portfolio_id"),
            user_id=user_id,
        )

        return {
            "results": results,
            "citations": [{"type": "deal", "deals": results}]
        }

    async def _analyze_portfolio_impl(
        self,
        input_data: Dict[str, Any],
        user_id: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Analyze portfolio"""
        from app.services.deal_query_service import DealQueryService

        service = DealQueryService()
        analysis = await service.analyze_portfolio(
            portfolio_id=input_data.get("portfolio_id"),
            analysis_type=input_data.get("analysis_type", "summary"),
            user_id=user_id,
        )

        return {
            "results": analysis,
            "citations": []
        }

    async def _web_search_impl(
        self,
        input_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Web search for market research"""
        from app.services.web_search_service import WebSearchService

        service = WebSearchService()
        results = await service.search(
            query=input_data.get("query"),
            limit=5,
        )

        return {
            "results": results,
            "citations": [{"type": "web", "results": results}]
        }

    async def get_chat_history(
        self,
        user_id: str,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Retrieve chat history"""
        # TODO: Query ChatHistory table from database
        pass

    async def clear_chat_history(self, user_id: str):
        """Clear chat history"""
        # TODO: Delete ChatHistory records for user
        pass

    async def update_context(
        self,
        user_id: str,
        context: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Update user's current context"""
        # TODO: Save to cache/session
        return context

    async def _save_chat_history(
        self,
        user_id: str,
        messages: List[Dict[str, Any]],
    ):
        """Save conversation to database"""
        # TODO: Save to ChatHistory table
        pass
```

### 3.5 Database Model for Chat History

```python
# app/models/chatbot.py
from sqlalchemy import Column, String, Text, DateTime, Integer, JSON
from sqlalchemy.sql import func
from app.database import Base
from uuid import uuid4

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String, nullable=False, index=True)
    role = Column(String, nullable=False)  # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    context = Column(JSON)  # Stores page, deal_id, portfolio_id, etc.
    citations = Column(JSON)  # Sources/citations
    created_at = Column(DateTime, server_default=func.now(), index=True)

    __table_args__ = (
        # Index for fast user history queries
        ('idx_user_created', 'user_id', 'created_at'),
    )
```

### 3.6 Deal Query Service

```python
# app/services/deal_query_service.py
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from app.models.property import Property
from app.models.deal_folder import DealFolder
from app.database import get_session

class DealQueryService:
    """Service for querying deals with natural language"""

    async def query_deals(
        self,
        query: str,
        user_id: str,
        portfolio_id: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Query deals using natural language.
        Examples:
        - "Show all multifamily deals with IRR > 15%"
        - "Which deals are in the pipeline?"
        - "List value-add opportunities"
        """
        # Parse query using Claude to extract criteria
        criteria = await self._parse_query_criteria(query)

        # Build SQLAlchemy query based on criteria
        async with get_session() as session:
            stmt = select(Property)

            # Apply filters based on parsed criteria
            if criteria.get('property_types'):
                stmt = stmt.where(
                    Property.property_type.in_(criteria['property_types'])
                )

            if criteria.get('min_irr'):
                stmt = stmt.where(Property.irr >= criteria['min_irr'])

            if criteria.get('status'):
                stmt = stmt.where(Property.status == criteria['status'])

            if portfolio_id:
                stmt = stmt.where(Property.portfolio_id == portfolio_id)

            result = await session.execute(stmt)
            deals = result.scalars().all()

            return [self._format_deal(d) for d in deals]

    async def analyze_portfolio(
        self,
        portfolio_id: str,
        analysis_type: str,
        user_id: str,
    ) -> Dict[str, Any]:
        """
        Analyze portfolio by type:
        - summary: overview of portfolio
        - risk: concentration, diversification
        - returns: IRR, equity multiple, cash-on-cash
        - market: geographic, property type, economic exposure
        """
        async with get_session() as session:
            # Get all deals in portfolio
            stmt = select(Property).where(
                Property.portfolio_id == portfolio_id
            )
            result = await session.execute(stmt)
            deals = result.scalars().all()

            if analysis_type == "summary":
                return self._analyze_summary(deals)
            elif analysis_type == "risk":
                return self._analyze_risk(deals)
            elif analysis_type == "returns":
                return self._analyze_returns(deals)
            elif analysis_type == "market":
                return self._analyze_market(deals)

    async def _parse_query_criteria(self, query: str) -> Dict[str, Any]:
        """Use Claude to parse natural language query into criteria"""
        # Simple implementation - can be enhanced with few-shot prompting
        criteria = {}
        query_lower = query.lower()

        # Extract property types
        if any(x in query_lower for x in ['multifamily', 'apartment', 'residential']):
            criteria['property_types'] = ['Multifamily']

        # Extract IRR thresholds
        import re
        irr_match = re.search(r'irr\s*[>>=<]*\s*(\d+)', query_lower)
        if irr_match:
            criteria['min_irr'] = float(irr_match.group(1))

        # Extract status
        if 'pipeline' in query_lower:
            criteria['status'] = 'Pipeline'

        return criteria

    def _format_deal(self, deal: Property) -> Dict[str, Any]:
        """Format deal for response"""
        return {
            "id": deal.id,
            "name": deal.name,
            "property_type": deal.property_type,
            "location": deal.location,
            "status": deal.status,
            "purchase_price": deal.purchase_price,
            "irr": deal.irr,
            "equity_multiple": deal.equity_multiple,
            "cap_rate": deal.cap_rate,
        }

    def _analyze_summary(self, deals: List[Property]) -> Dict[str, Any]:
        """Portfolio summary analysis"""
        return {
            "total_deals": len(deals),
            "total_value": sum(d.purchase_price or 0 for d in deals),
            "avg_irr": sum(d.irr or 0 for d in deals) / len(deals) if deals else 0,
            "property_types": list(set(d.property_type for d in deals)),
            "by_status": self._group_by_status(deals),
        }

    def _analyze_risk(self, deals: List[Property]) -> Dict[str, Any]:
        """Risk analysis"""
        # Concentration analysis, diversification, etc.
        pass

    def _analyze_returns(self, deals: List[Property]) -> Dict[str, Any]:
        """Returns analysis"""
        pass

    def _analyze_market(self, deals: List[Property]) -> Dict[str, Any]:
        """Market exposure analysis"""
        pass

    def _group_by_status(self, deals: List[Property]) -> Dict[str, int]:
        """Group deals by status"""
        groups = {}
        for deal in deals:
            status = deal.status or "Unknown"
            groups[status] = groups.get(status, 0) + 1
        return groups
```

### 3.7 Web Search Service

```python
# app/services/web_search_service.py
from typing import List, Dict, Any
import httpx
import os

class WebSearchService:
    """
    Service for web search (market research, economic data, trends).

    Use case: User asks "What's the outlook for multifamily in 2024?"
    -> Service searches web for recent articles/data
    -> Returns formatted results with citations
    """

    def __init__(self):
        # You can use: Google Search API, Bing, DuckDuckGo, or news APIs
        # For MVP, use DuckDuckGo (free) or Google (API key required)
        self.api_key = os.getenv("SEARCH_API_KEY")
        self.search_engine = os.getenv("SEARCH_ENGINE", "google")  # or 'ddg', 'serpapi'

    async def search(
        self,
        query: str,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Search web and return formatted results.
        """
        if self.search_engine == "google":
            return await self._google_search(query, limit)
        elif self.search_engine == "serpapi":
            return await self._serpapi_search(query, limit)
        else:
            return await self._ddg_search(query, limit)

    async def _google_search(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Use Google Custom Search API"""
        from google.auth.transport.requests import Request
        from google.oauth2.service_account import Credentials

        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://www.googleapis.com/customsearch/v1",
                params={
                    "q": query,
                    "key": self.api_key,
                    "num": limit,
                }
            )
            results = response.json().get("items", [])

            return [
                {
                    "title": r.get("title"),
                    "url": r.get("link"),
                    "snippet": r.get("snippet"),
                    "source": "google",
                }
                for r in results
            ]

    async def _serpapi_search(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Use SerpAPI (covers Google, Bing, etc.)"""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://serpapi.com/search",
                params={
                    "q": query,
                    "api_key": self.api_key,
                    "num": limit,
                }
            )
            results = response.json().get("organic_results", [])

            return [
                {
                    "title": r.get("title"),
                    "url": r.get("link"),
                    "snippet": r.get("snippet"),
                    "source": "serpapi",
                }
                for r in results
            ]

    async def _ddg_search(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Use DuckDuckGo (free, no API key needed)"""
        from duckduckgo_search import AsyncDDGS

        async with AsyncDDGS() as ddgs:
            results = await ddgs.text(query, max_results=limit)

            return [
                {
                    "title": r.get("title"),
                    "url": r.get("href"),
                    "snippet": r.get("body"),
                    "source": "ddg",
                }
                for r in results
            ]
```

---

## 4. Implementation Phases

### Phase 1: Core Chat Interface (Week 1)
- [x] Animated icon component
- [x] Chat panel UI (messages, input)
- [x] Zustand store for chat state
- [x] Context awareness system
- [x] Basic message send/receive
- [ ] Backend routes (message, history, context)
- [ ] Claude API integration

**Deliverable:** User can open chat, type messages, see responses (connected to Claude)

### Phase 2: Internal Data Integration (Week 2)
- [ ] Deal query service
- [ ] Portfolio analysis service
- [ ] ChatHistory database model
- [ ] Tool_use integration (Claude can call tools)
- [ ] Context-aware deal queries

**Deliverable:** User can ask about deals/portfolio, AI accesses internal data

### Phase 3: Web Search & Enhancement (Week 3)
- [ ] Web search service
- [ ] Market research queries
- [ ] Citation/source formatting
- [ ] Suggested follow-up questions
- [ ] Error handling & edge cases

**Deliverable:** Full-featured AI assistant with market research

### Phase 4: Polish & Optimization (Week 4)
- [ ] Performance optimization
- [ ] Streaming responses (for long outputs)
- [ ] Regenerate response button
- [ ] Copy message to clipboard
- [ ] Export chat history
- [ ] Settings (tone, capabilities)
- [ ] Mobile optimization

**Deliverable:** Production-ready feature

---

## 5. Code Examples

### 5.1 Complete Frontend Component

```typescript
// src/components/chatbot/ChatPanel.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Send, X, Sparkles, Loader2 } from 'lucide-react';
import { useChatbotStore } from '../../store/chatbotStore';
import { chatbotService } from '../../services/chatbotService';
import { MessageItem } from './MessageItem';
import { ContextBar } from './ContextBar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

export const ChatPanel: React.FC = () => {
  const {
    isOpen,
    toggleChat,
    messages,
    addMessage,
    currentContext,
    isLoading,
    setIsLoading,
  } = useChatbotStore();

  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    setError(null);

    // Add user message immediately
    const userMessageId = Date.now().toString();
    addMessage({
      id: userMessageId,
      role: 'user',
      content: text,
      timestamp: new Date(),
      context: currentContext,
    });

    setInput('');
    setIsLoading(true);

    try {
      // Call backend API
      const response = await chatbotService.sendMessage({
        message: text,
        context: currentContext,
        chat_history: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      // Add assistant response
      addMessage({
        id: response.id,
        role: 'assistant',
        content: response.content,
        timestamp: response.timestamp,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send message'
      );
      console.error('Chat error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(input);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 right-6 w-96 h-[600px] bg-slate-950/95 backdrop-blur-sm rounded-xl shadow-2xl border border-emerald-500/20 flex flex-col z-401 animate-in slide-in-from-bottom duration-300">
      {/* Header */}
      <div className="flex justify-between items-center p-4 border-b border-emerald-700/30">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          AI Assistant
        </h3>
        <button
          onClick={toggleChat}
          className="text-gray-400 hover:text-white transition-colors p-1 hover:bg-slate-800 rounded"
          aria-label="Close chat"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Context Bar */}
      <ContextBar context={currentContext} />

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
            <Sparkles className="w-8 h-8 mb-3 text-emerald-400" />
            <p className="text-sm font-medium mb-1">Ask me anything</p>
            <p className="text-xs text-gray-500">
              About deals, portfolio, or market research
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                  <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-400 italic">
                    Thinking...
                  </p>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-emerald-700/30 p-4 bg-gradient-to-t from-slate-950/50">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about deals, portfolio, or market..."
            disabled={isLoading}
            rows={1}
            className={cn(
              'flex-1 bg-slate-900/50 border border-slate-700 rounded px-3 py-2',
              'text-white text-sm placeholder-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
              'resize-none max-h-20',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
          <Button
            onClick={() => handleSendMessage(input)}
            disabled={isLoading || !input.trim()}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
```

### 5.2 Backend Message Handler

```python
# app/api/routes/chatbot.py (snippet)
from fastapi import APIRouter, Depends, HTTPException
from app.schemas.chatbot import ChatMessageRequest, ChatMessageResponse
from app.services.chatbot_service import ChatbotService
from app.api.deps import get_current_user
from datetime import datetime
import uuid

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])

@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    request: ChatMessageRequest,
    current_user: dict = Depends(get_current_user),
) -> ChatMessageResponse:
    """
    Send a message to AI assistant.

    Request includes:
    - message: User's query
    - context: Current page/deal/portfolio
    - chat_history: Previous messages for context

    Response includes:
    - content: AI response
    - citations: Sources for facts
    - id: Message ID for tracking
    """
    try:
        service = ChatbotService()

        # Process message through Claude
        response = await service.process_message(
            user_id=current_user["id"],
            message=request.message,
            context=request.context.dict(),
            chat_history=request.chat_history,
        )

        # Convert to response model
        return ChatMessageResponse(
            id=str(uuid.uuid4()),
            role="assistant",
            content=response["content"],
            timestamp=datetime.now(),
            citations=response.get("citations"),
            error=None,
        )
    except Exception as e:
        # Return error in response (don't raise - let frontend handle)
        return ChatMessageResponse(
            id=str(uuid.uuid4()),
            role="assistant",
            content="",
            timestamp=datetime.now(),
            error=str(e),
        )
```

### 5.3 Integration in Main Layout

```typescript
// src/components/layout/MainLayout.tsx
import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useChatbotStore } from '../../store/chatbotStore';
import { ChatbotIcon } from '../chatbot/ChatbotIcon';
import { ChatPanel } from '../chatbot/ChatPanel';

export const MainLayout: React.FC = () => {
  const { toggleChat, unreadCount } = useChatbotStore();

  return (
    <div className="flex h-screen bg-slate-950">
      {/* Sidebar, Header, etc. */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="border-b border-emerald-700/20 bg-slate-900/50 backdrop-blur">
          {/* Header content */}
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Chatbot UI */}
      <ChatbotIcon
        onClick={toggleChat}
        unreadCount={unreadCount}
        animated={true}
      />
      <ChatPanel />
    </div>
  );
};
```

---

## 6. Data Model Additions

### ChatHistory Table

```sql
CREATE TABLE chat_history (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  role VARCHAR(20) NOT NULL,  -- 'user' or 'assistant'
  content TEXT NOT NULL,
  context JSON,  -- {page, deal_id, portfolio_id, view_data}
  citations JSON,  -- [{type, source_id, data}, ...]
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_user_created (user_id, created_at)
);
```

### ChatSessions Table (Optional, for advanced features)

```sql
CREATE TABLE chat_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  title VARCHAR(255),  -- User-given title
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_message_at DATETIME,
  message_count INT DEFAULT 0,

  INDEX idx_user_id (user_id),
  INDEX idx_created_at (started_at)
);
```

---

## 7. Configuration & Environment Variables

### Backend (.env)

```bash
# Claude API
ANTHROPIC_API_KEY=sk-...

# Web Search (choose one)
SEARCH_ENGINE=google  # or 'ddg', 'serpapi'
GOOGLE_SEARCH_API_KEY=...  # if using Google
SERPAPI_API_KEY=...  # if using SerpAPI

# Feature Flags
ENABLE_WEB_SEARCH=true
ENABLE_PORTFOLIO_ANALYSIS=true
CHAT_MAX_HISTORY=100
CHAT_MESSAGE_TIMEOUT=30
```

### Frontend (.env)

```bash
VITE_API_BASE_URL=http://localhost:8000
VITE_CHATBOT_ENABLED=true
```

---

## 8. API Response Examples

### Send Message Request
```json
{
  "message": "Show me all multifamily deals with IRR > 15%",
  "context": {
    "page": "dashboard",
    "portfolio_id": "port_123",
    "view_data": {
      "total_deals": 45,
      "portfolio_name": "2024 Acquisitions"
    }
  },
  "chat_history": [
    {
      "role": "user",
      "content": "What's in my portfolio?"
    },
    {
      "role": "assistant",
      "content": "You have 45 deals across..."
    }
  ]
}
```

### Send Message Response
```json
{
  "id": "msg_abc123",
  "role": "assistant",
  "content": "I found 12 multifamily deals with IRR > 15%:\n\n1. **Prose Gainesville** - 50 units, 18.5% IRR\n2. **Sunset Village** - 120 units, 16.2% IRR\n\n[Full list with metrics...]",
  "timestamp": "2024-02-07T10:30:45Z",
  "citations": [
    {
      "type": "deal",
      "deals": [
        {
          "id": "prop_123",
          "name": "Prose Gainesville",
          "irr": 18.5
        }
      ]
    }
  ]
}
```

---

## 9. Security & Privacy Considerations

### Data Protection
1. **Chat History Encryption:** Store sensitive deal data encrypted at rest
2. **User Isolation:** Each user can only see their own chat history and deals
3. **API Rate Limiting:** Limit requests to prevent abuse
4. **Input Validation:** Sanitize all user inputs before Claude processing

### Authorization
1. Require `get_current_user` dependency on all endpoints
2. Validate user owns the deal/portfolio being queried
3. Log all AI queries for audit trail

### AI Safety
1. Claude's constitutional AI provides safety guardrails
2. Limit Claude to CRE domain (investment language)
3. No sensitive data (passwords, API keys) in context
4. Review web search results before passing to user

---

## 10. Error Handling & Resilience

### Graceful Degradation
```typescript
// If Claude is down, still show basic UI
if (!response || response.error) {
  return {
    content: "I'm temporarily unavailable. Please try again in a moment.",
    error: response.error,
  };
}
```

### Timeout Handling
```python
# 30 second timeout for Claude API
try:
    response = client.messages.create(
        ...,
        timeout=30,
    )
except asyncio.TimeoutError:
    return {"error": "Request timed out. Please try again."}
```

### Fallback Responses
```python
# If web search fails, continue with internal data
try:
    web_results = await web_search(query)
except Exception:
    # Continue without web results
    citations = [{"type": "internal_only"}]
```

---

## 11. Performance Optimization

### Frontend
1. **Lazy Load Chat Component:** Load only when first opened
2. **Message Virtualization:** If > 500 messages, use virtualized list
3. **Debounce Input:** Debounce typing indicator (100ms)
4. **Memoize Components:** Prevent unnecessary re-renders

### Backend
1. **Cache Deal Queries:** Cache common queries (5 min TTL)
2. **Stream Long Responses:** Use streaming for responses > 1000 chars
3. **Batch Database Queries:** Use eager loading for relationships
4. **Connection Pooling:** SQLAlchemy connection pool (5-10 connections)

### API
```python
# Streaming response for long outputs
from fastapi.responses import StreamingResponse

@router.post("/message/stream")
async def send_message_stream(request: ChatMessageRequest):
    async def generate():
        async for chunk in service.process_message_stream(...):
            yield f"data: {json.dumps(chunk)}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

---

## 12. Testing Strategy

### Unit Tests
```python
# test_chatbot_service.py
@pytest.mark.asyncio
async def test_process_message():
    service = ChatbotService()
    response = await service.process_message(
        user_id="user_123",
        message="Show me top deals",
        context={"page": "dashboard"},
    )
    assert response["content"]
    assert response["id"]

@pytest.mark.asyncio
async def test_query_deals():
    service = DealQueryService()
    results = await service.query_deals(
        query="multifamily with IRR > 15%",
        user_id="user_123",
    )
    assert len(results) > 0
    assert all(r["property_type"] == "Multifamily" for r in results)
```

### Integration Tests
```python
@pytest.mark.asyncio
async def test_full_conversation():
    # Send message through API
    response = await client.post(
        "/api/chatbot/message",
        json={
            "message": "Top deals in my portfolio?",
            "context": {"page": "dashboard"},
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["content"]
```

### Frontend Tests
```typescript
// __tests__/ChatPanel.test.tsx
describe("ChatPanel", () => {
  it("renders messages from store", () => {
    render(<ChatPanel />);
    expect(screen.getByText("Ask about deals...")).toBeInTheDocument();
  });

  it("sends message on Enter key", async () => {
    const sendSpy = vi.spyOn(chatbotService, "sendMessage");
    render(<ChatPanel />);

    const input = screen.getByPlaceholderText("Ask about...");
    await userEvent.type(input, "Show top deals{Enter}");

    expect(sendSpy).toHaveBeenCalled();
  });
});
```

---

## 13. Deployment Checklist

- [ ] Claude API key configured
- [ ] Web search API configured (if using external search)
- [ ] Database migration: `alembic upgrade head`
- [ ] Environment variables set on production
- [ ] Rate limiting configured
- [ ] Error logging setup (Sentry, etc.)
- [ ] Chat history backup strategy
- [ ] Load testing completed
- [ ] Security audit completed
- [ ] Documentation updated

---

## 14. Future Enhancements

1. **Voice Input/Output:** Speak questions, hear responses
2. **Real-time Collaboration:** Share chat sessions with team
3. **Custom Knowledge Base:** Train Claude on firm-specific documents
4. **Image Recognition:** Analyze property photos
5. **Automated Reports:** Generate investment memos from chats
6. **Multi-language Support:** Spanish, Mandarin, etc.
7. **Mobile App:** Native iOS/Android chatbot
8. **Slack Integration:** Chat with AI via Slack
9. **AI Coaching:** Guided acquisition walkthrough
10. **Predictive Analytics:** AI suggests deals to review

---

## 15. Success Metrics

**User Adoption:**
- 80% of daily active users open chat at least once
- Average 3-5 messages per session
- 40% return rate (ask multiple questions)

**Performance:**
- Message response time < 3 seconds (50th percentile)
- < 5 second timeout (95th percentile)
- 99.5% API uptime

**Quality:**
- User satisfaction > 4.2/5 stars
- Correct deal data accuracy > 95%
- Helpful follow-up suggestions in 80% of responses

---

## 16. Documentation References

- Claude API: https://docs.anthropic.com/
- FastAPI: https://fastapi.tiangolo.com/
- Zustand: https://zustand-demo.vercel.app/
- shadcn/ui: https://ui.shadcn.com/
- SQLAlchemy: https://docs.sqlalchemy.org/

---

**Document Complete**

This specification is ready for implementation. Start with Phase 1 (UI & basic messaging), then progressively add data integration and web search capabilities.

For questions during implementation, refer to existing patterns in:
- `/frontend/src/components/` for React/TypeScript patterns
- `/backend/app/services/` for FastAPI/Claude integration patterns
- `/backend/app/models/` for database model patterns
