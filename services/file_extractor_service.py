from pathlib import Path
import logging

logger = logging.getLogger(__name__)


def extract_text_from_file(file_path: Path) -> str:
    """
    Lê um arquivo local (.txt, .md, etc.) de forma segura,
    tentando UTF-8 e aplicando fallback para latin-1 se necessário.
    """
    if not file_path.exists():
        raise FileNotFoundError(f"O arquivo {file_path} não foi encontrado.")

    # Validação simples de extensão permitida
    allowed_extensions = {".txt", ".md"}
    if file_path.suffix.lower() not in allowed_extensions:
        raise ValueError(f"Formato de arquivo não suportado: {file_path.suffix}. Use apenas .txt ou .md.")

    try:
        # Tenta a leitura com UTF-8
        with open(file_path, "r", encoding="utf-8") as f:
            return f.read()
    except UnicodeDecodeError:
        logger.warning(f"Falha ao ler {file_path} em UTF-8. Tentando com codificação latin-1...")
        # Fallback para latin-1 caso o arquivo possua codificação antiga
        with open(file_path, "r", encoding="latin-1") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Erro inesperado ao ler o arquivo {file_path}: {e}")
        raise RuntimeError(f"Não foi possível processar o arquivo {file_path.name}.") from e