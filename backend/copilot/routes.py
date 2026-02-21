import json
import logging
from datetime import datetime
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth.utils import get_current_user
from database import get_db
from models import User
from copilot.llm_service import LLMService
from copilot.tools import detect_intent, dispatch_tool, format_tool_result_as_text

# Setup logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/copilot", tags=["Copilot"])

# Initialize LLM service (optional, falls back to keyword matching if not available)
llm_service = None
if LLMService.is_llm_configured():
    try:
        llm_service = LLMService()
        logger.info("LLM service initialized successfully")
    except Exception as e:
        logger.warning(f"LLM service initialization failed: {str(e)}. Using keyword matching.")


class CopilotMessageRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None
    conversation_history: Optional[List[Dict[str, str]]] = None


class CopilotMessageResponse(BaseModel):
    response: str
    timestamp: datetime
    model: Optional[str] = None  # 'gpt-4', 'gpt-3.5-turbo', or 'keyword-matching'
    tokens: Optional[Dict[str, int]] = None  # Token usage if using LLM


@router.post("/chat", response_model=CopilotMessageResponse)
async def chat(
    request: CopilotMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Handle copilot chat requests with LLM or keyword-based fallback.
    
    Intent detection runs first; if a tool matches the request it queries
    the DB and injects live data into the LLM prompt (or returns a direct
    text response when no LLM is configured).
    """
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message is required")
    
    try:
        user_message = request.message.strip()
        context = request.context or {}

        # ── 1. Intent detection + tool dispatch ──────────────────────────
        tool_name, params = detect_intent(user_message)
        tool_result: Optional[Dict[str, Any]] = None

        if tool_name:
            tool_result = dispatch_tool(tool_name, params, current_user, db)

        # ── 2. Build tool data string (injected into LLM prompt) ─────────
        tool_data_str: Optional[str] = None
        if tool_result and tool_result.get("ok"):
            tool_data_str = json.dumps(tool_result["data"], default=str)
        elif tool_result and not tool_result.get("ok"):
            # Error from tool (e.g. permission denied) — surface directly
            return CopilotMessageResponse(
                response=tool_result.get("error", "Permission denied."),
                timestamp=datetime.utcnow(),
                model="tool-error",
            )

        # ── 3. Try LLM ────────────────────────────────────────────────────
        model_used = "keyword-matching"
        tokens = None

        if llm_service and llm_service.is_available:
            try:
                # Inject tool data into context so build_system_prompt can use it
                enriched_context = {**context, "tool_name": tool_name, "tool_data": tool_data_str}
                llm_response = await llm_service.get_response(
                    message=user_message,
                    user=current_user,
                    context=enriched_context,
                    conversation_history=request.conversation_history,
                    max_tokens=600,
                )
                response_text = llm_response["response"]
                model_used = llm_response["model"]
                tokens = llm_response["tokens"]

                logger.info(
                    f"LLM response for user {current_user.id} "
                    f"(tool={tool_name}, tokens={tokens['total']})"
                )

            except Exception as e:
                logger.warning(f"LLM request failed: {str(e)}. Falling back to tool/keyword matching.")
                if tool_name and tool_result:
                    response_text = format_tool_result_as_text(tool_name, tool_result, current_user)
                else:
                    response_text = generate_copilot_response(user_message, context, current_user)
        else:
            # No LLM — use tool formatter or keyword fallback
            if tool_name and tool_result:
                response_text = format_tool_result_as_text(tool_name, tool_result, current_user)
            else:
                response_text = generate_copilot_response(user_message, context, current_user)

        return CopilotMessageResponse(
            response=response_text,
            timestamp=datetime.utcnow(),
            model=model_used,
            tokens=tokens,
        )
    
    except Exception as e:
        logger.error(f"Copilot error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to process copilot request")


def generate_copilot_response(message: str, context: Dict[str, Any], user: User) -> str:
    """
    Generate a contextual response for the copilot.
    
    This is a placeholder implementation. In a production system,
    you would integrate with an LLM service (OpenAI, Anthropic, etc.)
    or implement custom logic based on the message and context.
    """
    message_lower = message.lower()
    page = context.get('page', '')
    
    # Simple keyword-based responses for MVP
    if any(keyword in message_lower for keyword in ['hello', 'hi', 'hey', 'greetings']):
        return (
            f"Hello {user.first_name}! I'm SparkNode's AI Copilot. "
            "I'm here to help you understand your recognition data and answer questions about what you're seeing. "
            "How can I assist you today?"
        )
    
    elif any(keyword in message_lower for keyword in ['recognition', 'award', 'reward']):
        return (
            "Recognition is at the heart of SparkNode! I can help you understand recognition trends, "
            "individual achievements, and team accomplishments. What would you like to know?"
        )
    
    elif any(keyword in message_lower for keyword in ['budget', 'spend', 'cost', 'allocation']):
        return (
            "I can help you understand your budget allocation and spending patterns. "
            "Would you like to know about specific budget categories, spend trends, or remaining allocations?"
        )
    
    elif any(keyword in message_lower for keyword in ['user', 'employee', 'person', 'team']):
        return (
            "I can provide insights about users and their recognition activities. "
            "What specific user or team would you like to learn about?"
        )
    
    elif any(keyword in message_lower for keyword in ['tell', 'more', 'about', 'explain', 'what']):
        if page == 'feed':
            return (
                "I can provide more details about the recognition event or user you're asking about. "
                "Could you tell me the specific name or detail you'd like to explore?"
            )
        elif page == 'wallet':
            return (
                "Your wallet shows your available points and redemption options. "
                "I can help explain redemption tiers, point values, and suggest rewards based on your balance."
            )
        elif page == 'dashboard':
            return (
                "The dashboard provides a comprehensive overview of your recognition metrics. "
                "I can help explain what these charts represent and what insights they reveal."
            )
    
    elif page == 'wallet' and any(keyword in message_lower for keyword in ['redeem', 'point', 'balance', 'reward']):
        return (
            "I can help you navigate your redemption options and maximize your points. "
            "What type of rewards are you interested in?"
        )
    
    elif page == 'dashboard' and any(keyword in message_lower for keyword in ['chart', 'trend', 'data', 'metric']):
        return (
            "The dashboard shows key metrics about recognition activity. "
            "Would you like to understand specific trends, compare periods, or dive into particular categories?"
        )
    
    else:
        # Fallback response for general questions
        return (
            "I'm here to help you understand SparkNode! "
            "I can assist with recognition trends, budgets, user achievements, redemptions, and more. "
            "Try asking me about something you see on the screen, or let me know what interests you!"
        )


@router.get("/status")
async def get_status(current_user: User = Depends(get_current_user)):
    """
    Get copilot service status and LLM availability.
    """
    return {
        "status": "operational",
        "llm_available": llm_service is not None and llm_service.is_available,
        "model": "gpt-4" if (llm_service and llm_service.is_available) else "keyword-matching",
        "version": "0.5",
    }


@router.post("/validate-llm")
async def validate_llm(current_user: User = Depends(get_current_user)):
    """
    Validate OpenAI API key and LLM connectivity (admin only).
    """
    if not llm_service:
        return {
            "valid": False,
            "message": "LLM service not initialized",
            "error": "OPENAI_API_KEY not configured",
        }
    
    try:
        is_valid = llm_service.validate_api_key()
        if is_valid:
            return {
                "valid": True,
                "message": "OpenAI API key is valid",
                "model": "gpt-4",
            }
        else:
            return {
                "valid": False,
                "message": "OpenAI API key validation failed",
                "error": "Invalid or expired API key",
            }
    except Exception as e:
        return {
            "valid": False,
            "message": "Failed to validate API key",
            "error": str(e),
        }
