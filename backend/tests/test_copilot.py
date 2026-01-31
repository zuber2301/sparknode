"""
Tests for SparkNode Copilot functionality
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime
from unittest.mock import Mock, patch, AsyncMock
from main import app
from models import User
from copilot.llm_service import LLMService


client = TestClient(app)


# Mock user for testing
@pytest.fixture
def mock_user():
    user = Mock(spec=User)
    user.id = 1
    user.email = "test@example.com"
    user.first_name = "Test"
    user.last_name = "User"
    user.org_role = "user"
    return user


@pytest.fixture
def mock_token(mock_user):
    """Mock JWT token"""
    from core.security import create_access_token
    return create_access_token(data={"sub": mock_user.email})


class TestCopilotChat:
    """Test copilot chat endpoint"""
    
    def test_chat_requires_authentication(self):
        """Chat endpoint should require authentication"""
        response = client.post(
            "/api/copilot/chat",
            json={"message": "Hello"}
        )
        assert response.status_code == 403
    
    def test_chat_with_empty_message(self, mock_token):
        """Empty message should return 400"""
        headers = {"Authorization": f"Bearer {mock_token}"}
        response = client.post(
            "/api/copilot/chat",
            json={"message": ""},
            headers=headers
        )
        assert response.status_code == 400
    
    def test_chat_keyword_matching(self, mock_token):
        """Test chat with keyword matching (no LLM)"""
        with patch('copilot.routes.llm_service', None):
            headers = {"Authorization": f"Bearer {mock_token}"}
            response = client.post(
                "/api/copilot/chat",
                json={
                    "message": "Hello there!",
                    "context": {"page": "dashboard"}
                },
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "response" in data
            assert "timestamp" in data
            assert data["model"] == "keyword-matching"
            assert data["tokens"] is None
    
    def test_chat_recognizes_recognition_keyword(self, mock_token):
        """Test that recognition keyword is recognized"""
        with patch('copilot.routes.llm_service', None):
            headers = {"Authorization": f"Bearer {mock_token}"}
            response = client.post(
                "/api/copilot/chat",
                json={"message": "Tell me about recognition"},
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "recognition" in data["response"].lower()
    
    def test_chat_recognizes_budget_keyword(self, mock_token):
        """Test that budget keyword is recognized"""
        with patch('copilot.routes.llm_service', None):
            headers = {"Authorization": f"Bearer {mock_token}"}
            response = client.post(
                "/api/copilot/chat",
                json={"message": "What about my budget?"},
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "budget" in data["response"].lower()
    
    def test_chat_returns_timestamp(self, mock_token):
        """Chat response should include timestamp"""
        with patch('copilot.routes.llm_service', None):
            headers = {"Authorization": f"Bearer {mock_token}"}
            response = client.post(
                "/api/copilot/chat",
                json={"message": "Hello"},
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert "timestamp" in data
            # Verify timestamp is valid ISO format
            datetime.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
    
    def test_chat_with_conversation_history(self, mock_token):
        """Chat endpoint should accept conversation history"""
        with patch('copilot.routes.llm_service', None):
            headers = {"Authorization": f"Bearer {mock_token}"}
            response = client.post(
                "/api/copilot/chat",
                json={
                    "message": "Follow up question",
                    "conversation_history": [
                        {"role": "user", "content": "First question"},
                        {"role": "assistant", "content": "First answer"}
                    ]
                },
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["model"] == "keyword-matching"


class TestCopilotStatus:
    """Test copilot status endpoint"""
    
    def test_status_requires_authentication(self):
        """Status endpoint should require authentication"""
        response = client.get("/api/copilot/status")
        assert response.status_code == 403
    
    def test_status_returns_operational(self, mock_token):
        """Status endpoint should return operational status"""
        headers = {"Authorization": f"Bearer {mock_token}"}
        response = client.get(
            "/api/copilot/status",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "operational"
        assert "llm_available" in data
        assert "model" in data
        assert "version" in data
    
    def test_status_shows_model_fallback(self, mock_token):
        """Status endpoint should show keyword-matching when LLM unavailable"""
        with patch('copilot.routes.llm_service', None):
            headers = {"Authorization": f"Bearer {mock_token}"}
            response = client.get(
                "/api/copilot/status",
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["llm_available"] is False
            assert data["model"] == "keyword-matching"


class TestCopilotValidateLLM:
    """Test LLM validation endpoint"""
    
    def test_validate_llm_requires_authentication(self):
        """Validate LLM endpoint should require authentication"""
        response = client.post("/api/copilot/validate-llm")
        assert response.status_code == 403
    
    def test_validate_llm_without_service(self, mock_token):
        """Should handle missing LLM service gracefully"""
        with patch('copilot.routes.llm_service', None):
            headers = {"Authorization": f"Bearer {mock_token}"}
            response = client.post(
                "/api/copilot/validate-llm",
                headers=headers
            )
            
            assert response.status_code == 200
            data = response.json()
            assert data["valid"] is False
            assert "not initialized" in data["message"].lower()
    
    @patch('copilot.routes.llm_service')
    def test_validate_llm_valid_key(self, mock_llm_service, mock_token):
        """Should return valid when API key works"""
        mock_llm_service.validate_api_key.return_value = True
        
        headers = {"Authorization": f"Bearer {mock_token}"}
        response = client.post(
            "/api/copilot/validate-llm",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["model"] == "gpt-4"
    
    @patch('copilot.routes.llm_service')
    def test_validate_llm_invalid_key(self, mock_llm_service, mock_token):
        """Should return invalid when API key fails"""
        mock_llm_service.validate_api_key.return_value = False
        
        headers = {"Authorization": f"Bearer {mock_token}"}
        response = client.post(
            "/api/copilot/validate-llm",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
    
    @patch('copilot.routes.llm_service')
    def test_validate_llm_error_handling(self, mock_llm_service, mock_token):
        """Should handle API errors gracefully"""
        mock_llm_service.validate_api_key.side_effect = Exception("API Error")
        
        headers = {"Authorization": f"Bearer {mock_token}"}
        response = client.post(
            "/api/copilot/validate-llm",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is False
        assert "API Error" in data["error"]


class TestLLMService:
    """Test LLM service class"""
    
    def test_llm_service_requires_api_key(self):
        """LLMService should require API key"""
        with patch.dict('os.environ', {}, clear=True):
            with pytest.raises(ValueError):
                LLMService()
    
    def test_llm_service_is_llm_configured(self):
        """Test LLM configuration check"""
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'sk-test'}, clear=False):
            assert LLMService.is_llm_configured() is True
        
        with patch.dict('os.environ', {}, clear=True):
            assert LLMService.is_llm_configured() is False
    
    @patch('copilot.llm_service.OpenAI')
    def test_llm_service_initialization(self, mock_openai):
        """Test LLMService initialization with valid key"""
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'sk-test'}):
            service = LLMService()
            assert service.api_key == 'sk-test'
            assert service.model == 'gpt-4'
            assert service.client is not None
    
    def test_llm_service_custom_model(self):
        """Test LLMService with custom model"""
        with patch.dict('os.environ', {'OPENAI_API_KEY': 'sk-test'}):
            with patch('copilot.llm_service.OpenAI'):
                service = LLMService(model='gpt-3.5-turbo')
                assert service.model == 'gpt-3.5-turbo'


class TestCopilotIntegration:
    """Integration tests for copilot"""
    
    def test_full_chat_flow(self, mock_token):
        """Test complete chat flow"""
        with patch('copilot.routes.llm_service', None):
            headers = {"Authorization": f"Bearer {mock_token}"}
            
            # First message
            response1 = client.post(
                "/api/copilot/chat",
                json={
                    "message": "Hello!",
                    "context": {"page": "dashboard"}
                },
                headers=headers
            )
            assert response1.status_code == 200
            
            # Follow-up message with history
            response2 = client.post(
                "/api/copilot/chat",
                json={
                    "message": "Tell me more",
                    "conversation_history": [
                        {"role": "user", "content": response1.json()["response"]}
                    ]
                },
                headers=headers
            )
            assert response2.status_code == 200


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
