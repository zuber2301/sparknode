from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_openapi_oauth2_token_url():
    schema = client.get("/openapi.json").json()
    security_schemes = schema.get("components", {}).get("securitySchemes", {})
    # Find any OAuth2 password flow
    found_token_url = None
    for name, scheme in security_schemes.items():
        if scheme.get("type") == "oauth2":
            flows = scheme.get("flows", {})
            password_flow = flows.get("password")
            if password_flow:
                found_token_url = password_flow.get("tokenUrl")
                break

    assert found_token_url == "/api/auth/token", f"OAuth2 password tokenUrl not set correctly: {found_token_url}"
