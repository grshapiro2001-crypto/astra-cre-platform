import json
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.api.deps import get_current_user
from app.api.routes.organizations import _get_user_org_id
from app.schemas.assistant import ChatRequest
from app.services.assistant_service import chat_with_tools

router = APIRouter(prefix="/assistant", tags=["Assistant"])


@router.post("/chat")
def assistant_chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = _get_user_org_id(db, str(current_user.id))
    if org_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to an organization.",
        )

    def event_stream():
        try:
            for chunk in chat_with_tools(
                message=request.message,
                conversation_history=[m.model_dump() for m in request.conversation_history],
                db=db,
                org_id=org_id,
                property_id=request.property_id,
                user_id=str(current_user.id),
            ):
                payload = json.dumps({"type": "text_delta", "content": chunk})
                yield f"data: {payload}\n\n"

            done = json.dumps({"type": "done", "content": ""})
            yield f"data: {done}\n\n"
        except Exception as e:
            error = json.dumps({"type": "error", "content": str(e)})
            yield f"data: {error}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
