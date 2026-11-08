def test_generate_preview_minimo(client, load_mock):
    """Testa a geração de preview com o payload mínimo."""
    payload = load_mock("payload_minimo.json")
    response = client.post("/api/generate-preview", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "html" in data
    assert "Parágrafo de teste" in data["html"]
    assert data["used_links"] == 0


def test_generate_preview_completo(client, load_mock):
    """Testa a geração com capa, imagens e fórmula."""
    payload = load_mock("payload_completo.json")
    response = client.post("/api/generate-preview", json=payload)

    assert response.status_code == 200
    data = response.json()
    html = data["html"]
    assert "Relatório Anual" in html
    assert "Maria Silva" in html
    assert "E = mc^2" in html


def test_generate_preview_invalido(client, load_mock):
    """Testa se o servidor rejeita payloads com erro de validação."""
    payload = load_mock("payload_invalido.json")
    response = client.post("/api/generate-preview", json=payload)

    # Espera erro 422 (Unprocessable Entity) do Pydantic
    assert response.status_code == 422


def test_generate_preview_com_links(client, load_mock, monkeypatch):
    """
    Testa a raspagem de links.
    Usamos monkeypatch para simular a raspagem e não depender da internet real.
    """

    # Simula o retorno da função de raspagem
    async def mock_scrape_url(url):
        return f"Conteúdo raspado de {url}."

    async def mock_scrape_many(urls):
        return [{"url": u, "text": await mock_scrape_url(u)} for u in urls]

    # Substitui a função real pela simulada no media_service
    import services.media_service
    monkeypatch.setattr(services.media_service, "scrape_many", mock_scrape_many)

    payload = load_mock("payload_links.json")
    response = client.post("/api/generate-preview", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["used_links"] == 2
    # O texto gerado pelo mock deve estar no HTML
    assert "Conteúdo raspado de https://exemplo.com/artigo" in data["html"]