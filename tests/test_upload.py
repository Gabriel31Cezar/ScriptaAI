import io
import main


def test_upload_txt_sucesso(client, temp_storage):
    """Testa o upload de um arquivo .txt válido."""
    # Simula um arquivo de texto na memória
    file_content = b"Conteudo de teste para o ScriptaAI."
    files = {"files": ("teste.txt", io.BytesIO(file_content), "text/plain")}

    response = client.post("/api/upload", files=files)

    assert response.status_code == 200
    data = response.json()

    # Verifica a resposta
    assert len(data["uploads"]) == 1
    upload_info = data["uploads"][0]
    assert upload_info["filename"] == "teste.txt"
    assert upload_info["size"] == len(file_content)

    # Verifica se o arquivo realmente foi salvo na pasta TEMPORÁRIA
    stored_path = main.UPLOAD_DIR / upload_info["stored_as"]
    assert stored_path.exists()
    assert stored_path.read_bytes() == file_content


def test_upload_extensao_invalida(client):
    """Testa se o servidor rejeita arquivos com extensões não permitidas (.exe)."""
    files = {"files": ("virus.exe", io.BytesIO(b"malware"), "application/octet-stream")}

    response = client.post("/api/upload", files=files)

    assert response.status_code == 415
    data = response.json()
    assert "Extensão não permitida" in data["error"]


def test_upload_sem_arquivo(client):
    """Testa a falha ao tentar fazer upload sem enviar o campo 'files'."""
    response = client.post("/api/upload")

    # FastAPI/Pydantic deve retornar erro 422 de validação (campo obrigatório faltando)
    assert response.status_code == 422