# ScriptaAI

Gerador Inteligente de PDFs e Documentos com IA (Web Full-Stack e Backend Python).

## Visão Geral do Projeto
O **ScriptaAI** é uma solução full-stack desenvolvida em Python (FastAPI) e JavaScript Vanilla para a criação, formatação e automação de documentos técnicos e acadêmicos. O sistema integra inteligência artificial generativa (Google Gemini), persistência relacional (SQLAlchemy / SQLite), mecanismos de conformidade com a LGPD e compilação nativa de arquivos PDF via WeasyPrint.

---

## Interface do Usuário & Frontend (Etapa 1)

A interface do ScriptaAI foi construída com HTML5, CSS3 e JavaScript puro, sem dependência de frameworks externos. Organiza a criação de documentos em uma barra lateral de configurações e uma área de pré-visualização no formato A4, comunicando-se com o backend FastAPI via requisições REST JSON.

### Arquitetura da Interface
- **Arquivos:** `static/index.html` (estrutura DOM), `static/css/style.css` (temas e layout A4) e `static/js/app.js` (comportamento, validação e comunicação com a API).
- **Layout:** Grid responsivo de duas colunas, com barra lateral fixa à esquerda (300px) e painel principal à direita. Adapta-se automaticamente para coluna única em telas abaixo de 768px.
- **Temas:** Suporte nativo a modo claro e escuro via variáveis CSS e atributo `data-theme`, com persistência em `localStorage`.
- **Folha A4:** Área de visualização calibrada em 210 × 297 mm com margens e tipografia dinâmicas.

### Componentes da Barra Lateral
- **Entradas de Conteúdo:** Campo para comandos (prompt da IA), caixa de links de referência e zona interativa de upload por drag-and-drop. Formatos aceitos: `.txt`, `.md`, `.docx`, `.mp3`, `.mp4`, `.png` e `.pdf`.
- **Formatação Normativa:** Seletores rápidos para normas ABNT, APA/IEEE, Executivo Moderno e Apostila Compacta.
- **Tipografia & Margens:** Fontes (Arial, Times New Roman, Roboto, Monospace), tamanho de 10 a 14 pt e densidades de margem (estreita, normal, larga).
- **Capa & Mídia:** Campos para título, subtítulo, autor e instituição, além de controle de tamanho e disposição de imagens.

### Componentes do Painel Principal
- **Barra de Ferramentas:** Ações para "Gerar/Atualizar Preview", "Salvar documento", "Baixar PDF", "Baixar Word (.doc)", "Copiar Texto" e "Novo Documento".
- **Painel de Histórico:** Lista dinâmica de documentos salvos no SQLite com botões interativos para reabertura de rascunhos e exclusão individual (`🗑️`).
- **Modal de Privacidade:** Modal nativo (`<dialog>`) detalhando o tratamento de dados e os termos de uso em conformidade com a LGPD.

---

## Backend & Engine de PDF (Etapa 2)

O motor do ScriptaAI foi construído em Python com **FastAPI** e **Uvicorn** para processar requisições, realizar extração e raspagem de dados externos e compilar documentos PDF com **WeasyPrint**.

### Arquitetura da Aplicação (`main.py`)
- **Padrão de Serviço:** Servidor ASGI FastAPI gerenciando estáticos e rotas de API sob o prefixo `/api/`.
- **Segurança & CORS:** Middleware CORS habilitado com origens restritas e `Cache-Control` configurado para prevenir cache antigo de ativos no navegador.
- **Silenciamento de Avisos:** Módulo `gtk_silencer.py` para supressão de logs desnecessários do biblioteca GLib/GTK no ambiente Windows.

### Estrutura de Serviços (`services/`)
- **`pdf_service.py`:** Engine de compilação HTML/Markdown para PDF com WeasyPrint. Aplica estilos estritos baseados nas normas escolhidas e realiza resolução automática de caminhos de arquivos locais (`file:///...`) para renderização perfeita de imagens no PDF.
- **`media_service.py`:** Raspagem assíncrona de páginas web e URLs externas usando `requests` e cabeçalhos de navegadores reais para contornar bloqueios anti-bot.

---

## Banco de Dados & Persistência (Etapa 3)

Suporte completo à persistência relacional de dados utilizando **SQLAlchemy ORM** e **SQLite**, com schemas estritos de validação via **Pydantic v2**.

### Arquitetura do Banco de Dados (`database.py` e `models/document.py`)
- **Tecnologia:** SQLAlchemy ORM conectado ao SQLite local (`scriptaai.db`).
- **Modelos Relacionais:**
  - `Document`: Título, norma, tipografia, margens, capa (JSON), fórmula, conteúdo Markdown e timestamps UTC.
  - `SourceFile`: Registro de arquivos de apoio vinculados com exclusão em cascata (`CASCADE`).
  - `DocumentImage`: Metadados de imagens, legendas e ordens de exibição.
  - `ExportRecord`: Registro histórico de PDFs exportados.

### Schemas e Validação (`schemas/document.py`)
- Contratos de dados baseados no Pydantic v2 (`GenerateIn`, `DocumentOut`, `DocumentDetailOut`, `UploadOut`, `PreviewOut`).

### Conformidade com a LGPD (`services/cleanup_service.py`)
- Gerenciamento de ciclo de vida moderno via **`lifespan`** no FastAPI.
- Tarefa assíncrona em segundo plano para limpeza e purga automática de arquivos temporários de upload com retenção máxima de 24 horas.

---

## Mocks & Testes Automatizados (Etapa 4)

A estabilidade do backend é garantida por uma suíte de testes automatizados desenvolvida em **Pytest**, utilizando isolamento de diretórios temporários (`tmp_path`) e mocks JSON de requisições.

### Estrutura da Suíte de Testes (`tests/`)
- **`conftest.py`:** Fixtures de teste e isolamento do cliente FastAPI (`TestClient`).
- **`test_upload.py`:** Testes de upload de arquivos válidos, rejeição de extensões perigosas (`.exe`) e limites de tamanho.
- **`test_generate_preview.py`:** Validação de previews mínimos, completos e com raspagem simulada via `monkeypatch`.
- **`test_export_pdf.py`:** Validação da compilação e download de arquivos binários PDF.

---

## Documentação Técnica Final (Etapa 5)

Consolidação da interface de persistência, histórico de rascunhos salvos, reabertura de edições passadas e padronização do ambiente full-stack.

---

## Integração com Inteligência Artificial (Etapa 6)

Automação da geração de conteúdo técnico e acadêmico através da integração oficial com a API do Google Gemini.

### Arquitetura da IA (`services/ai_service.py`)
- **SDK Oficial:** Utiliza a biblioteca moderna `google-genai` do Google.
- **Modelo Prioritário:** Mapeado com a versão estável de alta disponibilidade **`gemini-3.8-flash`**.
- **Mecanismo de Fallback:** Suporte a descobrimento e alternância dinâmica de modelos para garantir tolerância a picos de alta demanda (erros 503/404).

---

## Processamento de Fontes de Entrada & Upload de Arquivos (Etapa 7)

Mecanismo para processar arquivos de apoio locais (`.txt`, `.md`), injetando seus conteúdos diretamente no contexto enviado ao modelo de IA.

### Extração de Arquivos (`services/file_extractor_service.py`)
- **Leitura Segura:** Suporte a arquivos de texto codificados em `utf-8` com fallback inteligente para `latin-1`.
- **Atualização de Contrato:** Campo `uploaded_files` integrado ao schema `GenerateIn` no Pydantic v2.

---

## IA Generativa, Segurança & Exclusão de Rascunhos (Etapa 8)

Isolamento estrito entre instruções e referências, além do controle completo do ciclo de vida dos dados do usuário.

### Isolamento de Contexto
- O pipeline no `main.py` separa estritamente as instruções de comando (prompt) das fontes de referência (links e arquivos), prevenindo poluição visual ou injeção de HTML no documento final.
- **Exclusão de Rascunhos:** Endpoint dedicado (`DELETE /api/documents/{document_id}`) para apagar registros no SQLite e remover arquivos físicos temporários de forma síncrona.

---

## Validação Final de Ponta a Ponta (E2E) e Estabilidade (Etapa 9)

- **Fluxo Validado:** Ciclo completo de vida do documento testado e aprovado com sucesso — desde a entrada de prompts e anexação de imagens locais (PNG), processamento autônomo via Google Gemini (`gemini-3.8-flash`), persistência de metadados no SQLite, reabertura pelo painel de histórico até a exclusão de rascunhos (`DELETE /api/documents/{document_id}`).
- **Estabilidade & Ajustes:** Resolução e conversão de caminhos web para URIs locais (`file:///...`) no `pdf_service.py` garantindo renderização de imagens no motor WeasyPrint, suíte de testes `pytest` zerada sem avisos e blindagem contra erros de rede.

---

## Estrutura do Projeto

```text
ScriptaAI/
├── main.py                    # Aplicação FastAPI, rotas da API, exclusão e pipeline de IA
├── database.py                # Conexão e sessão com o banco SQLite
├── models/
│   └── document.py            # Modelos relacionais do banco (Document, SourceFile, etc.)
├── schemas/
│   └── document.py            # Schemas de validação e contratos (Pydantic v2 com uploaded_files)
├── services/
│   ├── ai_service.py          # Integração oficial com o Google Gemini (SDK google-genai, fallback de modelos)
│   ├── cleanup_service.py     # Limpeza automática de arquivos temporários e LGPD (via lifespan)
│   ├── file_extractor_service.py # Leitura segura de arquivos locais de apoio (.txt, .md com fallback)
│   ├── gtk_silencer.py        # Silenciador de avisos do GTK para o WeasyPrint no Windows
│   ├── media_service.py       # Raspagem de URLs e links externos de apoio
│   └── pdf_service.py         # Motor de compilação HTML/Markdown para PDF com WeasyPrint (URIs absolutas)
├── static/
│   ├── index.html             # Interface web principal
│   ├── css/style.css          # Estilos globais, temas claro/escuro e folha A4
│   └── js/app.js              # Comportamento, upload, preview, histórico e botão de exclusão 🗑️
├── storage/                   # Diretório de armazenamento local (uploads e output de PDFs)
├── mocks/                     # Payloads de exemplo para os testes automatizados
├── tests/                     # Testes unitários e de integração com Pytest
├── pytest.ini                 # Configurações do ambiente de testes
├── requirements.txt           # Dependências de produção do projeto
├── requirements-dev.txt       # Dependências de desenvolvimento e testes
└── README.md                  # Documentação técnica completa do projeto
```

---

## Instalação e Execução

### 1. Pré-requisitos
- **Python:** Versão 3.13 instalada.
- **GTK:** Bibliotecas de sistema exigidas pelo WeasyPrint no Windows.

### 2. Passos para Iniciar
1. Clone o repositório e entre na pasta:
   ```bash
   git clone <url-do-repositorio>
   cd ScriptaAI
   ```
2. Crie e ative o ambiente virtual:
   ```bash
   python -m venv .venv
   ```
   - Windows: `.venv\Scripts\activate`
   - Linux/macOS: `source .venv/bin/activate`

3. Instale as dependências de produção:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure a variável de ambiente criando um arquivo **`.env`** na raiz:
   ```env
   GEMINI_API_KEY=sua_chave_do_google_ai_studio_aqui
   STORAGE_ROOT=storage
   MAX_UPLOAD_MB=25
   ```

5. Inicie o servidor FastAPI:
   ```bash
   uvicorn main:app --reload
   ```

6. Acesse no navegador:
   **[http://127.0.0.1:8000/static/index.html](http://127.0.0.1:8000/static/index.html)**

---

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `GEMINI_API_KEY` | *(Obrigatório)* | Chave de API obtida no Google AI Studio |
| `STORAGE_ROOT` | `storage` | Diretório de armazenamento dos uploads e PDFs gerados |
| `MAX_UPLOAD_MB` | `25` | Limite de tamanho por arquivo enviado (em MB) |
| `ALLOWED_ORIGINS` | `http://127.0.0.1:8000,http://localhost:8000` | Origens autorizadas pelo CORS |

---

## Endpoints da API

Documentação interativa Swagger disponível em: `http://127.0.0.1:8000/docs`

| Método | Rota | Descrição | Status Sucesso |
|---|---|---|---|
| `GET` | `/api/health` | Healthcheck da aplicação | 200 OK |
| `POST` | `/api/upload` | Upload de arquivos de apoio/imagens | 200 OK |
| `POST` | `/api/generate-preview` | Geração do preview em HTML com IA | 200 OK |
| `POST` | `/api/export-pdf` | Compilação e exportação de PDF nativo | 200 OK |
| `POST` | `/api/documents` | Salva o documento no banco SQLite | 201 Created |
| `GET` | `/api/documents` | Lista o histórico de documentos salvos | 200 OK |
| `GET` | `/api/documents/{id}` | Busca um documento salvo específico | 200 OK |
| `DELETE` | `/api/documents/{id}` | Exclui documento e arquivos físicos vinculados | 204 No Content |

---

## Execução de Testes Automatizados

Para rodar a suíte de testes de integração e componentes:

```bash
pip install -r requirements-dev.txt
pytest -v
```

---

## Licença

Este projeto está sob a licença **MIT**. Veja o arquivo `LICENSE` para mais detalhes.