import os
import time
import asyncio
from pathlib import Path

UPLOAD_DIR = Path("storage/uploads")
OUTPUT_DIR = Path("storage/output")
RETENTION_HOURS = int(os.getenv("RETENTION_UPLOAD_HOURS", 24))
RETENTION_SECONDS = RETENTION_HOURS * 3600


async def cleanup_temporary_files_task():
    """Tarefa assíncrona periódica para apagar arquivos temporários órfãos antigos."""
    while True:
        try:
            now = time.time()
            for directory in [UPLOAD_DIR, OUTPUT_DIR]:
                if directory.exists():
                    for file_path in directory.iterdir():
                        if file_path.is_file():
                            file_age = now - file_path.stat().st_mtime
                            if file_age > RETENTION_SECONDS:
                                file_path.unlink()
                                print(f"[LGPD Cleanup] Arquivo temporário removido por expiração: {file_path.name}")
        except Exception as e:
            print(f"[LGPD Cleanup Error] Erro ao limpar arquivos temporários: {e}")

        # Executa a verificação a cada 1 hora
        await asyncio.sleep(3600)