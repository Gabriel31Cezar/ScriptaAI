import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Precisamos importar o app, mas o app importa o storage.
# Vamos monkeypatchar as variáveis de ambiente antes de importar o main.
import os

os.environ["STORAGE_ROOT"] = "storage_test"

from main import app
import main


@pytest.fixture
def client():
    """Retorna um cliente HTTP para testar a API sem subir um servidor real."""
    return TestClient(app)


@pytest.fixture(autouse=True)
def temp_storage(tmp_path, monkeypatch):
    """
    Substitui a pasta de storage por uma pasta temporária (tmp_path) em cada teste.
    Isso garante que os testes não sujem a pasta 'storage' real do projeto.
    """
    temp_upload = tmp_path / "uploads"
    temp_output = tmp_path / "output"
    temp_upload.mkdir()
    temp_output.mkdir()

    # Altera as variáveis no módulo main em tempo de execução
    monkeypatch.setattr(main, "UPLOAD_DIR", temp_upload)
    monkeypatch.setattr(main, "OUTPUT_DIR", temp_output)

    yield


@pytest.fixture
def load_mock():
    """Retorna uma função que carrega um arquivo JSON da pasta mocks/."""

    def _load(filename):
        path = Path(__file__).parent.parent / "mocks" / filename
        return json.loads(path.read_text(encoding="utf-8"))

    return _load