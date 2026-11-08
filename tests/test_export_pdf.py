import main


def test_export_pdf_sucesso(client, load_mock):
    """Testa se o PDF é gerado e retornado corretamente."""
    payload = load_mock("payload_completo.json")
    response = client.post("/api/export-pdf", json=payload)

    # Verifica o status e o tipo de arquivo
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"

    # Verifica se o arquivo físico foi gerado na pasta temporária e se tem conteúdo
    # (A pasta temporária é configurada na fixture 'temp_storage')
    pdfs_gerados = list(main.OUTPUT_DIR.glob("*.pdf"))
    assert len(pdfs_gerados) == 1
    assert pdfs_gerados[0].stat().st_size > 0


def test_export_pdf_falha_simulada(client, load_mock, monkeypatch):
    """Testa o tratamento de erro caso o WeasyPrint falhe."""
    payload = load_mock("payload_minimo.json")

    # Simula uma falha crítica no WeasyPrint para testar o bloco 'except' do main.py
    # O underline (_) avisa ao PyCharm que estes parâmetros são ignorados de propósito
    def mock_render_pdf_falha(*_args, **_kwargs):
        raise Exception("Falha simulada no motor do PDF")

    import services.pdf_service
    monkeypatch.setattr(services.pdf_service, "render_pdf", mock_render_pdf_falha)

    response = client.post("/api/export-pdf", json=payload)

    # Espera um Erro 500 com a mensagem customizada
    assert response.status_code == 500
    data = response.json()
    assert "Falha ao gerar PDF: Falha simulada no motor do PDF" in data["error"]