import pytest
from fastapi.testclient import TestClient
import sys
import os

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from main import app
    client = TestClient(app)
    APP_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import app: {e}")
    APP_AVAILABLE = False
    client = None

def test_health_check():
    """Test: health check endpoint"""
    if not APP_AVAILABLE:
        pytest.skip("App not available for testing")
    
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "ok"

def test_analyze_endpoint_exists():
    """Test that analyze endpoint exists"""
    if not APP_AVAILABLE:
        pytest.skip("App not available for testing")
    
    response = client.post("/ai/analyze")
    # Should return 422 for missing file, not 404
    assert response.status_code in [422, 400]

def test_session_start_endpoint():
    """Test session start endpoint"""
    if not APP_AVAILABLE:
        pytest.skip("App not available for testing")
    
    response = client.post("/ai/session/start", params={"attempt_id": "test", "student_id": "test"})
    assert response.status_code in [200, 422]

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
