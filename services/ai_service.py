"""
Serviço de integração com a API do Google Gemini via requisições HTTP (requests).
"""

from __future__ import annotations

import os
import requests

# Modelo padrão recomendado para texto rápido e eficiente
_GEMINI_MODEL = "gemini-1.5-flash"
_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{_GEMINI_MODEL}:generateContent"


def generate_text_with_gemini(prompt: str) -> str:
    """Envia um prompt para a API do Gemini e retorna o texto gerado."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("Chave GEMINI_API_KEY não configurada nas variáveis de ambiente.")

    headers = {
        "Content-Type": "application/json",
    }

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt}
                ]
            }
        ]
    }

    try:
        response = requests.post(
            f"{_API_URL}?key={api_key}",
            json=payload,
            headers=headers,
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        # Extração segura da resposta da estrutura do Gemini
        candidates = data.get("candidates", [])
        if not candidates:
            return "[Erro: Nenhum conteúdo retornado pela IA]"

        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if not parts:
            return "[Erro: Estrutura de resposta inválida da IA]"

        text_result = parts[0].get("text", "")
        return text_result.strip()

    except requests.exceptions.RequestException as e:
        print(f"[ERRO GEMINI API] Falha de comunicação: {e}")
        raise RuntimeError(f"Falha de comunicação com a API do Gemini: {e}") from e
    except (KeyError, IndexError, ValueError) as e:
        print(f"[ERRO GEMINI API] Falha ao processar resposta: {e}")
        raise RuntimeError("Formato de resposta inesperado da API do Gemini.") from e