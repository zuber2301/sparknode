import os
import sys
import unittest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Add app directory to path
sys.path.append(os.path.dirname(os.path.realpath(__file__)))

from app.main import app

client = TestClient(app)

class TestAzureValidation(unittest.TestCase):
    
    @patch('app.main.ResourceManagementClient')
    @patch('app.main.ClientSecretCredential')
    @patch('os.getenv')
    def test_validate_azure_success(self, mock_getenv, mock_cred, mock_mgmt):
        # Setup mocks
        mock_getenv.side_effect = lambda k: {
            'AZURE_CLIENT_ID': 'fake-client-id',
            'AZURE_CLIENT_SECRET': 'fake-secret',
            'AZURE_TENANT_ID': 'default-tenant',
            'AZURE_SUBSCRIPTION_ID': 'default-sub'
        }.get(k)
        
        # Mock resource list success
        mock_mgmt_instance = MagicMock()
        mock_mgmt.return_value = mock_mgmt_instance
        mock_mgmt_instance.resource_groups.list.return_value = [MagicMock()]
        
        # Test request
        response = client.post("/api/infra/validate", json={
            "provider": "azure",
            "env_id": "production",
            "config": {
                "tenant_id": "user-tenant-id",
                "subscription_id": "user-sub-id"
            }
        })
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "validated")
        # Ensure progress logs are present
        self.assertTrue(any("Authenticating" in l["msg"] for l in data["logs"]))
        self.assertTrue(any("verified SPN" in l["msg"] for l in data["logs"]))

    @patch('app.main.ResourceManagementClient')
    @patch('app.main.ClientSecretCredential')
    @patch('os.getenv')
    def test_validate_azure_failure_missing_ids(self, mock_getenv, mock_cred, mock_mgmt):
        # Missing secrets
        mock_getenv.return_value = None
        
        response = client.post("/api/infra/validate", json={
            "provider": "azure",
            "config": {} # No IDs provided
        })
        
        data = response.json()
        self.assertEqual(data["status"], "failed")
        self.assertIn("Missing ID Mappings", data["logs"][-1]["msg"])

    @patch('app.main.ClientSecretCredential')
    @patch('os.getenv')
    def test_validate_azure_auth_error(self, mock_getenv, mock_cred):
        from azure.core.exceptions import ClientAuthenticationError
        
        mock_getenv.return_value = "something"
        mock_cred.side_effect = ClientAuthenticationError("Invalid credentials")
        
        response = client.post("/api/infra/validate", json={
            "provider": "azure",
            "config": {"tenant_id": "t", "subscription_id": "s"}
        })
        
        data = response.json()
        self.assertEqual(data["status"], "failed")
        self.assertTrue(any("Auth Error" in l["msg"] for l in data["logs"]))

if __name__ == '__main__':
    unittest.main()
