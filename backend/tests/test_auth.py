import pytest
from passlib.context import CryptContext
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from auth.utils import verify_password, get_password_hash, create_access_token, decode_token


class TestPasswordHashing:
    """Test password hashing utilities"""
    
    def test_password_hash_is_different_from_plain(self):
        """Test that hashed password is different from plain text"""
        password = "mysecretpassword"
        hashed = get_password_hash(password)
        assert hashed != password
    
    def test_password_hash_starts_with_bcrypt_prefix(self):
        """Test that hash uses bcrypt format"""
        password = "mysecretpassword"
        hashed = get_password_hash(password)
        assert hashed.startswith("$2b$")
    
    def test_verify_correct_password(self):
        """Test that correct password verifies"""
        password = "mysecretpassword"
        hashed = get_password_hash(password)
        assert verify_password(password, hashed) is True
    
    def test_verify_wrong_password(self):
        """Test that wrong password does not verify"""
        password = "mysecretpassword"
        hashed = get_password_hash(password)
        assert verify_password("wrongpassword", hashed) is False
    
    def test_different_hashes_for_same_password(self):
        """Test that same password produces different hashes (due to salt)"""
        password = "mysecretpassword"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)
        assert hash1 != hash2
        # But both should verify
        assert verify_password(password, hash1) is True
        assert verify_password(password, hash2) is True


class TestJWTTokens:
    """Test JWT token utilities"""
    
    def test_create_access_token(self):
        """Test creating an access token"""
        data = {
            "sub": "user-id-123",
            "email": "test@test.com",
            "role": "tenant_user"
        }
        token = create_access_token(data)
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0
    
    def test_decode_valid_token(self):
        """Test decoding a valid token"""
        data = {
            "sub": "770e8400-e29b-41d4-a716-446655440001",
            "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
            "email": "test@test.com",
            "org_role": "tenant_user"
        }
        token = create_access_token(data)
        decoded = decode_token(token)
        assert decoded.email == "test@test.com"
        assert decoded.org_role == "tenant_user"
    
    def test_token_contains_expiration(self):
        """Test that token has expiration claim"""
        from jose import jwt
        from config import settings
        
        data = {"sub": "user-id", "email": "test@test.com", "org_role": "tenant_user"}
        token = create_access_token(data)
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        assert "exp" in payload


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
