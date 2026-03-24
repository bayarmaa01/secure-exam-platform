import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health_check():
    """Test the health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

def test_analyze_endpoint_exists():
    """Test that the analyze endpoint exists"""
    response = client.post("/analyze")
    # Should return 422 for missing file, not 404
    assert response.status_code == 422

if __name__ == "__main__":
    pytest.main([__file__])
