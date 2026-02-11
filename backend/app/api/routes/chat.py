"""
Chat endpoint for AI Pipeline Analyst using Claude API
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import anthropic
import json

from app.database import get_db
from app.models.user import User
from app.models.property import Property
from app.api.deps import get_current_user
from app.config import settings

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    """Request model for chat endpoint"""
    message: str


class ChatResponse(BaseModel):
    """Response model for chat endpoint"""
    response: str


def build_portfolio_context(properties: List[Property]) -> str:
    """
    Build portfolio context string from user's properties.
    Format: One line per property with key metrics.
    """
    if not properties:
        return "No properties in portfolio yet."

    context_lines = []
    for prop in properties:
        # Calculate cap rate if we have the data
        cap_rate = None
        if prop.y1_noi and hasattr(prop, 'purchase_price') and prop.purchase_price:
            cap_rate = (prop.y1_noi / prop.purchase_price) * 100

        # Build property line
        name = prop.deal_name or prop.property_name or "Unnamed Property"
        location = f"{prop.submarket}, {prop.metro}" if prop.submarket and prop.metro else (prop.submarket or prop.metro or "Unknown Location")
        units = f"{prop.total_units} units" if prop.total_units else "N/A units"

        # Y1 NOI
        noi_str = f"${prop.y1_noi:,.0f}" if prop.y1_noi else "N/A"

        # Cap rate
        cap_str = f"{cap_rate:.1f}%" if cap_rate else "N/A"

        # Screening
        score = prop.screening_score if prop.screening_score is not None else "N/A"
        verdict = prop.screening_verdict or "Not Screened"
        stage = prop.pipeline_stage or "screening"

        line = f"{name} | {location} | {units} | Y1 NOI: {noi_str} | Cap Rate: {cap_str} | Score: {score} | Stage: {stage} | Screening: {verdict}"
        context_lines.append(line)

    return "\n".join(context_lines)


@router.post("", response_model=ChatResponse)
def chat_with_ai(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Chat with AI Pipeline Analyst about user's portfolio.

    Uses Claude API to provide context-aware responses about the user's deals,
    investment insights, comparisons, and risk analysis.
    """
    # Validate API key
    if not settings.ANTHROPIC_API_KEY or settings.ANTHROPIC_API_KEY == "your-api-key-here":
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ANTHROPIC_API_KEY not configured. Please set it in backend/.env"
        )

    # Fetch all user's properties
    properties = db.query(Property).filter(Property.user_id == current_user.id).all()

    # Build portfolio context
    portfolio_context = build_portfolio_context(properties)

    # Build system prompt
    system_prompt = f"""You are an AI investment analyst for a commercial real estate platform. You have access to the user's deal pipeline data below. Answer questions about their portfolio, provide investment insights, compare deals, and flag risks. Be concise and data-driven. Format numbers as currency where appropriate.

Portfolio Data:
{portfolio_context}"""

    # Call Claude API
    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        message = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=1024,
            system=system_prompt,
            messages=[
                {"role": "user", "content": request.message}
            ]
        )

        # Extract response text
        response_text = message.content[0].text

        return ChatResponse(response=response_text)

    except anthropic.APIError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Claude API error: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )
