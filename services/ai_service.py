"""
Serviço de integração oficial com a API do Google Gemini usando o SDK oficial (google-genai)
com descoberta automática de modelos disponíveis para evitar erros 404.
"""

from __future__ import annotations

import os
from google import genai
from google.genai import errors
from dotenv import load_dotenv

load_dotenv()


def generate_text_with_gemini(prompt: str) -> str:
    """Envia um prompt para a API do Gemini buscando automaticamente um modelo compatível."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("Chave GEMINI_API_KEY não configurada nas variáveis de ambiente.")

    if not prompt or not prompt.strip():
        raise ValueError("O prompt fornecido está vazio.")

    client = genai.Client(api_key=api_key)

    # Lista de fallback explícita baseada nos nomes mais comuns aceitos pelo SDK moderno
    candidate_models = [
        "gemini-1.5-flash",
        "gemini-1.5-pro",
        "gemini-2.0-flash",
    ]

    # Tenta descobrir se há modelos disponíveis dinamicamente pela API, se o método existir
    try:
        models_pager = client.models.list()
        dynamic_models = []
        for m in models_pager:
            if hasattr(m, "name") and "flash" in m.name:
                # Remove o prefixo 'models/' se vier incluído
                model_id = m.name.replace("models/", "")
                dynamic_models.append(model_id)
        if dynamic_models:
            # Coloca os dinâmicos encontrados no topo da lista
            candidate_models = dynamic_models + candidate_models
    except Exception as e:
        print(f"[AVISO] Não foi possível listar modelos dinamicamente: {e}")

    # Remove duplicadas mantendo a ordem
    candidate_models = list(dict.fromkeys(candidate_models))

    last_error = None
    for model_name in candidate_models:
        try:
            print(f"[AI SERVICE] Tentando gerar com o modelo: {model_name}")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
            )

            if response and response.text:
                return str(response.text).strip()

        except errors.APIError as e:
            print(f"[AVISO] Modelo {model_name} falhou com APIError: {e}")
            last_error = e
            continue
        except Exception as e:
            print(f"[AVISO] Modelo {model_name} falhou com erro inesperado: {e}")
            last_error = e
            continue

    if last_error:
        raise RuntimeError(f"Erro na API do Gemini em todos os modelos testados: {last_error}") from last_error

    return "[Erro: Nenhum conteúdo retornado pela IA]"