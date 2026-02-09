"""
OpenAI LLM Service for SparkNode Copilot
Provides intelligent, context-aware responses using GPT-4
"""

import os
import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
import tiktoken

# OpenAI imports
try:
    from openai import OpenAI, APIError, RateLimitError, APIConnectionError
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False


class LLMService:
    """Service for managing LLM interactions with OpenAI"""
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4"):
        """
        Initialize LLM service
        
        Args:
            api_key: OpenAI API key (defaults to OPENAI_API_KEY env var)
            model: Model to use (gpt-4 or gpt-3.5-turbo)
        """
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model
        self.client = None
        self.encoding = None
        self.is_available = False
        
        if not self.api_key:
            raise ValueError(
                "OpenAI API key not provided. "
                "Set OPENAI_API_KEY environment variable or pass api_key parameter."
            )
        
        if not OPENAI_AVAILABLE:
            raise ImportError(
                "OpenAI library not installed. "
                "Install with: pip install openai"
            )
        
        try:
            self.client = OpenAI(api_key=self.api_key)
            self.encoding = tiktoken.encoding_for_model(self.model)
            self.is_available = True
        except Exception as e:
            raise RuntimeError(f"Failed to initialize OpenAI client: {str(e)}")
    
    def build_system_prompt(self, user: Any, context: Dict[str, Any]) -> str:
        """
        Build a system prompt tailored to SparkNode and current context
        
        Args:
            user: Current user object
            context: Context information (page, visible_data, etc.)
        
        Returns:
            System prompt string
        """
        page = context.get('page', 'general')
        user_role = context.get('user_role', 'tenant_user')
        
        base_prompt = f"""You are SparkNode's AI Copilot, an intelligent assistant helping with employee recognition and rewards.

User Context:
- Name: {user.first_name} {user.last_name}
- Role: {user_role}
- Current Page: {page}

Your capabilities:
1. Explain recognition trends and data
2. Answer questions about employee achievements
3. Provide insights on budget allocation and spending
4. Suggest reward recommendations based on points
5. Clarify recognition policies and redemption processes
6. Analyze team performance and engagement metrics

Guidelines:
- Be helpful, friendly, and professional
- Provide specific examples when possible
- Acknowledge when you don't have specific data
- Keep responses concise (2-3 sentences typically)
- Use the user's first name occasionally
- Provide actionable insights, not just summaries
- Ask clarifying questions if the request is ambiguous

Page-Specific Context:
"""
        
        if page == 'dashboard':
            base_prompt += """- User is viewing company-wide recognition metrics and trends
- Can explain charts, metrics, and KPIs
- Provide insights on recognition patterns"""
        
        elif page == 'feed':
            base_prompt += """- User is viewing a social feed of recognition events
- Can explain specific recognitions, recipients, and achievements
- Provide context about team dynamics and recognition impact"""
        
        elif page == 'wallet':
            base_prompt += """- User is viewing their points and redemption options
- Can explain point values and redemption tiers
- Suggest rewards based on point balance and preferences"""
        
        elif page == 'budgets':
            base_prompt += """- User is managing team or department budget
- Can explain spending patterns and projections
- Provide recommendations for budget allocation"""
        
        elif page == 'users':
            base_prompt += """- User is managing employees and team members
- Can explain user roles and permissions
- Provide insights on user engagement and participation"""
        
        base_prompt += "\n\nRespond conversationally and naturally. If you don't have specific data, suggest how the user could find it."
        
        return base_prompt
    
    def count_tokens(self, text: str) -> int:
        """
        Count tokens in text using tiktoken
        
        Args:
            text: Text to count tokens for
        
        Returns:
            Number of tokens
        """
        if not self.encoding:
            return len(text.split()) * 1.3  # Rough estimate
        
        try:
            return len(self.encoding.encode(text))
        except Exception:
            return len(text.split()) * 1.3
    
    def estimate_cost(self, prompt_tokens: int, completion_tokens: int) -> Dict[str, float]:
        """
        Estimate cost of API call
        
        Args:
            prompt_tokens: Number of tokens in prompt
            completion_tokens: Number of tokens in completion
        
        Returns:
            Dict with cost information
        """
        # Pricing as of January 2026 (gpt-4)
        if self.model == "gpt-4":
            prompt_cost_per_1k = 0.03
            completion_cost_per_1k = 0.06
        else:  # gpt-3.5-turbo
            prompt_cost_per_1k = 0.0005
            completion_cost_per_1k = 0.0015
        
        prompt_cost = (prompt_tokens / 1000) * prompt_cost_per_1k
        completion_cost = (completion_tokens / 1000) * completion_cost_per_1k
        total_cost = prompt_cost + completion_cost
        
        return {
            "prompt_cost": round(prompt_cost, 6),
            "completion_cost": round(completion_cost, 6),
            "total_cost": round(total_cost, 6),
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        }
    
    async def get_response(
        self,
        message: str,
        user: Any,
        context: Dict[str, Any],
        conversation_history: Optional[List[Dict[str, str]]] = None,
        max_tokens: int = 500,
    ) -> Dict[str, Any]:
        """
        Get LLM response for user message
        
        Args:
            message: User's message
            user: Current user object
            context: Context information
            conversation_history: Previous messages in conversation
            max_tokens: Maximum tokens in response
        
        Returns:
            Dict with response, usage, and cost information
        """
        if not self.is_available:
            raise RuntimeError("LLM service not available")
        
        try:
            # Build system prompt
            system_prompt = self.build_system_prompt(user, context)
            
            # Build messages list
            messages = [{"role": "system", "content": system_prompt}]
            
            # Add conversation history (last 5 messages to keep context but manage tokens)
            if conversation_history:
                for msg in conversation_history[-5:]:
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", "")
                    })
            
            # Add current message
            messages.append({"role": "user", "content": message})
            
            # Count tokens before API call
            prompt_text = "\n".join([m["content"] for m in messages])
            prompt_tokens_estimate = self.count_tokens(prompt_text)
            
            # Call OpenAI API
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=0.7,  # Balanced creativity and consistency
                top_p=0.9,  # Nucleus sampling
            )
            
            # Extract response
            assistant_message = response.choices[0].message.content
            
            # Get actual token usage
            usage = response.usage
            prompt_tokens = usage.prompt_tokens
            completion_tokens = usage.completion_tokens
            
            # Calculate cost
            cost_info = self.estimate_cost(prompt_tokens, completion_tokens)
            
            return {
                "response": assistant_message,
                "tokens": {
                    "prompt": prompt_tokens,
                    "completion": completion_tokens,
                    "total": prompt_tokens + completion_tokens,
                },
                "cost": cost_info,
                "model": self.model,
                "timestamp": datetime.utcnow().isoformat(),
            }
        
        except RateLimitError:
            raise RuntimeError(
                "OpenAI API rate limit exceeded. Please try again in a moment."
            )
        except APIConnectionError:
            raise RuntimeError(
                "Failed to connect to OpenAI API. Please check your internet connection."
            )
        except APIError as e:
            raise RuntimeError(
                f"OpenAI API error: {str(e)}"
            )
    
    def validate_api_key(self) -> bool:
        """
        Validate that the API key is working
        
        Returns:
            True if API key is valid
        """
        try:
            # Try a minimal request
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": "test"}],
                max_tokens=10,
            )
            return response.choices[0].message.content is not None
        except Exception as e:
            logging.warning(f"API key validation failed: {str(e)}")
            return False
    
    @staticmethod
    def is_llm_configured() -> bool:
        """
        Check if LLM is configured and available
        
        Returns:
            True if OpenAI API key is set
        """
        return bool(os.getenv("OPENAI_API_KEY"))
