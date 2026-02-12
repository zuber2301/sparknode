"""
Simple Aggregator client interface and a Mock implementation.

This provides a pluggable place to integrate real providers (Xoxoday, TangoCard,
Giftbit). For local development the `MockAggregatorClient` returns deterministic voucher codes.
"""

import base64
import time
import uuid
from typing import Any, Dict

import requests
from config import settings


class AggregatorClient:
    """Base interface for aggregator clients."""

    def issue_voucher(
        self,
        tenant_id: uuid.UUID,
        vendor_code: str,
        amount: float,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        raise NotImplementedError()

    def check_balance(self, vendor_code: str) -> Dict[str, Any]:
        raise NotImplementedError()

    def get_catalog(self) -> Dict[str, Any]:
        raise NotImplementedError()


class MockAggregatorClient(AggregatorClient):
    def issue_voucher(
        self,
        tenant_id: uuid.UUID,
        vendor_code: str,
        amount: float,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        # Simulate network latency
        time.sleep(0.1)
        code = f"MOCK-{int(time.time())}-{str(uuid.uuid4())[:8].upper()}"
        return {
            "status": "success",
            "voucher_code": code,
            "pin": None,
            "redeem_url": f"https://mock-aggregator.example/redeem/{code}",
            "vendor_reference": str(uuid.uuid4()),
        }

    def check_balance(self, vendor_code: str) -> Dict[str, Any]:
        return {"vendor_code": vendor_code, "current_balance": 100000.0}

    def get_catalog(self) -> Dict[str, Any]:
        """Returns a mock catalog including various international brands."""
        return {
            "brands": [
                {
                    "brandKey": "amazon-in",
                    "brandName": "Amazon.in",
                    "imageUrls": {"80w-mono": "https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg"},
                    "items": [
                        {"utid": "amz-in-500", "rewardName": "Amazon ₹500", "value": 500, "currencyCode": "INR"},
                        {"utid": "amz-in-1000", "rewardName": "Amazon ₹1000", "value": 1000, "currencyCode": "INR"}
                    ]
                },
                {
                    "brandKey": "swiggy-in",
                    "brandName": "Swiggy",
                    "imageUrls": {"80w-mono": "https://upload.wikimedia.org/wikipedia/en/thumb/1/12/Swiggy_logo.svg/1200px-Swiggy_logo.svg.png"},
                    "items": [
                        {"utid": "swig-in-250", "rewardName": "Swiggy ₹250", "value": 250, "currencyCode": "INR"},
                        {"utid": "swig-in-500", "rewardName": "Swiggy ₹500", "value": 500, "currencyCode": "INR"}
                    ]
                },
                {
                    "brandKey": "starbucks-us",
                    "brandName": "Starbucks US",
                    "imageUrls": {"80w-mono": "https://upload.wikimedia.org/wikipedia/en/thumb/d/d3/Starbucks_Corporation_Logo_2011.svg/1200px-Starbucks_Corporation_Logo_2011.svg.png"},
                    "items": [
                        {"utid": "sbux-us-10", "rewardName": "Starbucks $10", "value": 10, "currencyCode": "USD"}
                    ]
                }
            ]
        }


class TangoCardClient(AggregatorClient):
    """Minimal Tango Card client implementation.

    This is a lightweight wrapper that calls Tango Card's order API. In production
    you should implement retries, idempotency, and error handling per provider docs.
    """

    def __init__(self):
        self.base = settings.tango_api_base.rstrip("/")
        self.api_key = settings.tango_api_key
        self.account_id = settings.tango_account_identifier
        if not self.api_key:
            # We don't raise here during init to allow the app to start even if keys aren't set
            # but issue_voucher will fail if used.
            pass

    def _auth_header(self):
        # Tango Card uses HTTP Basic auth where the username is the API key and password is empty
        token = base64.b64encode(f"{self.api_key}:".encode()).decode()
        return {"Authorization": f"Basic {token}", "Content-Type": "application/json"}

    def issue_voucher(
        self,
        tenant_id: uuid.UUID,
        vendor_code: str,
        amount: float,
        metadata: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("TANGO_API_KEY is not configured")
            
        # Construct a simple order payload — adapt fields to your Tango Card integration
        url = f"{self.base}/orders"
        payload = {
            "accountIdentifier": self.account_id,
            "recipient": {
                "email": metadata.get("email") or metadata.get("user_email"),
                "firstName": metadata.get("first_name"),
                "lastName": metadata.get("last_name"),
            },
            "reward": {"sku": vendor_code, "amount": float(amount)},
            "externalTransactionId": str(metadata.get("redemption_id")),
        }

        resp = requests.post(url, json=payload, headers=self._auth_header(), timeout=15)
        resp.raise_for_status()
        data = resp.json()

        # Normalize response to our expected shape
        return {
            "status": "success",
            "voucher_code": data.get("reward", {}).get("code") or data.get("reward", {}).get("pin"),
            "redeem_url": data.get("reward", {}).get("redeem_url"),
            "vendor_reference": data.get("id") or data.get("externalTransactionId"),
        }

    def check_balance(self, vendor_code: str) -> Dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("TANGO_API_KEY is not configured")
        url = f"{self.base}/accounts/{self.account_id}/balance"
        resp = requests.get(url, headers=self._auth_header(), timeout=10)
        resp.raise_for_status()
        data = resp.json()
        return {"vendor_code": vendor_code, "current_balance": data.get("balance")}

    def get_catalog(self) -> Dict[str, Any]:
        if not self.api_key:
            raise RuntimeError("TANGO_API_KEY is not configured")
        url = f"{self.base}/catalogs"
        resp = requests.get(url, headers=self._auth_header(), timeout=15)
        resp.raise_for_status()
        return resp.json()


# Factory
def get_aggregator_client() -> AggregatorClient:
    provider = getattr(settings, "aggregator_provider", "mock")
    if provider == "tangocard":
        return TangoCardClient()
    # Add other providers here (e.g., XoxodayClient)
    return MockAggregatorClient()
