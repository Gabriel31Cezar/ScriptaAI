def test_health_check(client):
    """Garante que a rota /api/health responde 200 e tem o formato correto."""
    response = client.get("/api/health")

    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["app"] == "ScriptaAI"
    assert "version" in data