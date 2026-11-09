"""
Serviço de integração oficial com a API do Google Gemini usando o SDK oficial (google-genai).
"""

from __future__ import annotations

import os
from google import genai
from google.genai import errors
from dotenv import load_dotenv

load_dotenv()

# Utilizando o modelo atualizado exigido pela API do Google
_GEMINI_MODEL = "gemini-3.8-flash"


def generate_text_with_gemini(prompt: str) -> str:
    """Envia um prompt para a API do Gemini utilizando o SDK oficial."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("Chave GEMINI_API_KEY não configurada nas variáveis de ambiente.")

    if not prompt or not prompt.strip():
        raise ValueError("O prompt fornecido está vazio.")

    client = genai.Client(api_key=api_key)

    try:
        response = client.models.generate_content(
            model=_GEMINI_MODEL,
            contents=prompt,
        )

        if response and response.text:
            return str(response.text).strip()

        return "[Erro: Nenhum conteúdo retornado pela IA]"

    except errors.APIError as e:
        print(f"[ERRO GEMINI API SDK] Erro na API do Google: {e}")
        raise RuntimeError(f"Erro na API do Gemini: {e}") from e
    except Exception as e:
        print(f"[ERRO INESPERADO] Falha ao comunicar com o Gemini: {e}")
        raise RuntimeError(f"Falha de comunicação com a API do Gemini: {e}") from e