# ScriptaAI

Gerador Inteligente de PDFs e Documentos com IA (Web Full-Stack e Backend Python).

## Interface do Usuário & Frontend (Etapa 1)

A interface do ScriptaAI foi construída com HTML5, CSS3 e JavaScript puro, sem frameworks ou bibliotecas externas. Ela organiza a criação de documentos em uma barra lateral de configurações e uma área de pré-visualização no formato A4, e se comunica com o backend FastAPI pelas rotas `/api/upload` e `/api/generate-preview`.

### Arquitetura da Interface
- **Arquivos:** `static/index.html` (estrutura), `static/css/style.css` (temas e layout) e `static/js/app.js` (comportamento e comunicação com a API).
- **Layout:** duas colunas em grid, com a barra lateral fixa à esquerda (300 px) e o painel principal à direita. Abaixo de 768 px, as colunas viram uma só.
- **Temas:** claro e escuro, controlados por variáveis CSS e pelo atributo `data-theme`. A escolha é salva no `localStorage`, e na primeira visita o sistema define o tema inicial.
- **Folha A4:** a área de visualização tem 210 × 297 mm e fundo branco em qualquer tema, como papel impresso.

### Componentes da Barra Lateral
- **Entradas de conteúdo:** campo de prompt, caixa de links (um por linha) e área de upload por clique ou arrastar. Os formatos aceitos são `.txt`, `.md`, `.docx`, `.mp3`, `.mp4`, `.png` e `.pdf`.
- **Formatação:** cards de seleção única para ABNT, APA/IEEE, Executivo Moderno e Apostila Compacta.
- **Tipografia:** fonte (Arial, Times New Roman, Roboto ou Monospace), tamanho de 10 a 14 pt e densidade de margem (estreita, normal ou larga).
- **Capa:** seção recolhível com título, subtítulo, autor e instituição.
- **Imagens e fórmulas:** tamanho (30%, 60% ou 100%), disposição (abaixo do texto, texto ao lado ou centralizado) e campo de fórmula em texto.

### Componentes do Painel Principal
- **Barra de ferramentas:** Gerar/Atualizar Preview, Baixar PDF, Baixar DOCX, Copiar Texto e Novo Documento.
- **Linha de status:** mensagens de sucesso, erro e carregamento, com cor própria para cada tipo.
- **Folha A4:** exibe a capa, a imagem de exemplo, a fórmula e o conteúdo retornado pelo servidor. As margens, a fonte e o tamanho acompanham os seletores.
- **Carregamento:** spinner e blocos skeleton sobre a folha durante a geração, com o botão desativado até a resposta chegar.
- **Modal de privacidade:** elemento `<dialog>` nativo, aberto pelo rodapé e fechado com Esc, pelo botão "Fechar" ou clicando fora da janela.

### Integração com o Backend
- **Upload:** os arquivos são validados por extensão e tamanho (25 MB) no navegador e enviados por `FormData` para `POST /api/upload`. A lista de arquivos mostra o nome e o tamanho devolvidos pelo servidor.
- **Preview:** os dados da tela são enviados como JSON para `POST /api/generate-preview`. Antes do envio, o texto é normalizado (quebras de linha do Windows e sequências literais `\n` e `\t` viram caracteres reais).
- **Renderização segura:** o HTML devolvido pelo servidor passa por um sanitizador antes de ser exibido. Ele remove `script`, `style`, `iframe`, `object`, `embed`, `link`, `meta`, `base` e `form`, além de atributos `on*` e links `javascript:`.
- **Exportação para Word:** o arquivo `.doc` é gerado no navegador a partir da folha, com estilos do Word, e nomeado pelo título da capa.
- **Impressão:** o botão "Baixar PDF" abre a caixa de impressão do navegador. Regras `@media print` mostram somente a folha, que pode ocupar várias páginas.

### Acessibilidade
- Todos os campos têm `label` associado.
- Os cards de norma usam botões de rádio ocultos visualmente, que continuam navegáveis por Tab e setas.
- Os botões e campos mostram contorno de foco visível.
- A linha de status usa `aria-live="polite"`, para que leitores de tela anunciem as mensagens.

### Pendências da Etapa
- A norma selecionada (ABNT, APA/IEEE etc.) ainda não altera a formatação do preview nem da exportação.
- A exportação em PDF usa a impressão do navegador. A rota `POST /api/export-pdf` do backend ainda não é chamada pelo frontend.
- O arquivo `.doc` não é um DOCX nativo. Um DOCX real exige biblioteca externa, que depende de autorização.
- A imagem da folha é um exemplo fixo. Imagens enviadas só aparecem no preview quando o servidor as incluir no HTML devolvido.
- A fórmula é texto simples, sem renderização matemática.
- "Novo Documento" limpa o conteúdo do preview, e o texto de exemplo não é restaurado.
- O texto da política de privacidade é preliminar e precisa de revisão jurídica antes da publicação.

## Backend & Engine de PDF (Etapa 2)

O motor do ScriptaAI foi construído em Python com **FastAPI** para processar as requisições do frontend, realizar a raspagem de links, gerar PDFs nativos com **WeasyPrint** e gerenciar o armazenamento seguro de arquivos.

### Arquitetura da Aplicação (`main.py`)
- **Tecnologia:** FastAPI com Uvicorn como servidor ASGI.
- **Padrão de Serviço:** Interface servida estaticamente a partir da pasta `static/` e rotas de API isoladas sob o prefixo `/api/`.
- **Configuração:** Middleware CORS habilitado com origens restritas e `Cache-Control` aplicado aos arquivos estáticos para evitar cache obsoleto no navegador.
- **Segurança:** Validação de payloads e tratamento global de exceções retornando sempre JSON padronizado (`{"ok": false, "error": "..."}`).

### Estrutura de Serviços (`services/`)
- **`pdf_service.py`:** Engine de compilação HTML/Markdown para PDF. Aplica estilos estritos baseados na norma escolhida (ABNT, APA/IEEE, Executivo, Apostila), com controle de quebra de página, suporte a imagens em colunas e ajuste dinâmico de margens.
- **`media_service.py`:** Leitura de arquivos locais (`.txt`, `.md`, `.docx`) e raspagem de URLs externas. Utiliza `requests` com cabeçalhos de navegador real para contornar bloqueios anti-bot (como os da Wikipedia).
- **`gtk_silencer.py`:** Rotina de compatibilidade para o Windows que intercepta e silencia avisos nativos do GTK (usado pelo WeasyPrint) durante a inicialização do servidor.

### Endpoints da API
- `POST /api/upload`: Recebe arquivos via `multipart/form-data`, valida a extensão, aplica um UUID no nome e armazena de forma segura no diretório `storage/uploads/`.
- `POST /api/generate-preview`: Recebe o payload JSON, raspa os links fornecidos, converte o texto (Markdown) para HTML e retorna o documento renderizado para a folha A4 do frontend.
- `POST /api/export-pdf`: Recebe o mesmo payload, compila o arquivo binário usando a engine do WeasyPrint e faz o download do PDF final.
- `GET /api/health`: Verificação de status da aplicação (healthcheck).

### Gestão de Arquivos & Engine
- **Isolamento:** Uploads e PDFs gerados são armazenados com nomes únicos (UUID) nos diretórios `storage/uploads/` e `storage/output/`.
- **Manipulação de Texto:** Leitura nativa de arquivos `.docx` (via `python-docx`) e conversão de Markdown para HTML, respeitando limites de tamanho para garantir a performance do servidor.

## Banco de Dados & Persistência (Etapa 3)

O backend do ScriptaAI foi atualizado para incluir suporte completo à persistência relacional de dados com **SQLAlchemy** e **SQLite**, além de rotinas para conformidade com a LGPD.

### Arquitetura do Banco de Dados
- **Tecnologia:** SQLAlchemy ORM com SQLite (`scriptaai.db`).
- **Padrão de Conexão:** Gerenciamento de sessões com injeção de dependência via `Depends(get_db)` nos endpoints da API.
- **Criação Automática:** As tabelas são gerenciadas dinamicamente na inicialização do servidor FastAPI (`Base.metadata.create_all`).

### Estrutura de Modelos (`models/document.py`)
- **`Document`:** Armazena os dados principais dos documentos (título, norma, fonte, margens, capa em formato JSON, fórmulas, conteúdo em Markdown e timestamps UTC).
- **`SourceFile`:** Registro dos arquivos enviados vinculados a um documento com exclusão em cascata (`CASCADE`).
- **`DocumentImage`:** Metadados das imagens associadas, ordem de exibição e legendas.
- **`ExportRecord`:** Histórico de exportações e arquivos gerados.

### Schemas e Validação (`schemas/document.py`)
- Contratos de dados refatorados para o **Pydantic v2** (`model_dump()`, `model_dump_json()`).
- Schemas estritos para criação (`GenerateIn`), leitura (`DocumentOut`), upload (`UploadOut`) e visualização (`PreviewOut`).

### Novos Endpoints da API
- `POST /api/documents`: Salva um novo documento estruturado no banco de dados.
- `GET /api/documents`: Retorna a lista de documentos salvos no histórico ordenados por data de criação.

### Conformidade com a LGPD & Ciclo de Vida (`services/cleanup_service.py`)
- Substituição do decorador legado `@app.on_event("startup")` pelo gerenciador de contexto moderno **`lifespan`** do FastAPI.
- Implementação da rotina assíncrona de limpeza automática em segundo plano para remoção de arquivos temporários e expirados nos diretórios de storage.

## Mocks & Testes Automatizados (Etapa 4)

A qualidade e a estabilidade do backend são garantidas por uma suíte de testes automatizados implementada com **Pytest**, além de um conjunto de dados estáticos (Mocks) para simular requisições e validar o contrato da API.

### Estrutura de Testes (`tests/`)
- **`conftest.py`:** Configuração de fixtures do Pytest, incluindo o isolamento do ambiente (geração de arquivos em diretórios temporários via `tmp_path` para não sujar o `storage` real) e a injeção do cliente de testes do FastAPI.
- **`test_upload.py`:** Valida o upload de arquivos válidos (`.txt`), rejeição de extensões perigosas (`.exe`) e falhas de envio (erros 415 e 422).
- **`test_generate_preview.py`:** Testa a geração de preview (mínimo, completo, com imagens e capa). Utiliza `monkeypatch` para simular a raspagem de links e evitar dependência de redes externas durante os testes.
- **`test_export_pdf.py`:** Verifica a geração e o download do arquivo binário PDF, além de simular falhas críticas no motor do WeasyPrint para garantir que o servidor trate o erro 500 corretamente.

### Mocks de Payload (`mocks/`)
- **`payload_minimo.json`:** Apenas conteúdo de texto, sem capa ou imagens.
- **`payload_completo.json`:** Todos os campos preenchidos (capa, imagens, fórmula, links).
- **`payload_invalido.json`:** Payload propositalmente incorreto para testar a rejeição de dados (Erro 422).
- **`payload_com_capa.json`:** Foco na renderização de título, subtítulo, autor e instituição.
- **`payload_com_imagens.json`:** Foco na renderização de imagens em colunas e legendas.
- **`payload_links.json`:** Foco na raspagem de URLs, usando mocks para não depender da internet.

### Configuração do Ambiente
- **`pytest.ini`:** Define o modo assíncrono (`asyncio_mode = auto`) e restrições de execução (`--strict-markers`).
- **`requirements-dev.txt`:** Isola as dependências de teste (`pytest`, `pytest-asyncio`) das dependências de produção para manter o servidor leve.

---

## Documentação Técnica Final (Etapa 5)

Esta seção descreve a versão final do projeto, incluindo a interface de persistência, a lista e a reabertura de documentos salvos e a documentação de uso.

### Funcionalidades

- Entrada de conteúdo por prompt, links e arquivos de apoio.
- Formatação por norma: ABNT, APA/IEEE, Executivo Moderno e Apostila Compacta.
- Tipografia com Arial, Times New Roman, Roboto ou Monospace, tamanho do texto e densidade de margem.
- Capa, imagens, fórmula em texto e pré-visualização em folha A4.
- Exportação em PDF pelo servidor e em `.doc` pelo navegador.
- Salvar documentos, listar os salvos e reabri-los pela lista.
- Tema claro e escuro, com layout responsivo.

## Integração com Inteligência Artificial (Etapa 6)

O ScriptaAI foi expandido para contar com motor de geração de conteúdo inteligente através da integração oficial com a API do Google Gemini, permitindo a criação autônoma de artigos, resumos e textos técnicos diretamente no backend.

### Arquitetura da IA (`services/ai_service.py`)
- **SDK Oficial:** Utiliza a biblioteca moderna `google-genai` do Google para gerenciar de forma nativa e segura a autenticação e as requisições de modelos de linguagem.
- **Modelo Utilizado:** Padronizado com o modelo de alta performance **`gemini-3.8-flash`**, garantindo respostas rápidas, alta precisão contextual e total estabilidade de rota no backend FastAPI.
- **Tratamento de Erros:** Validação prévia de variáveis de ambiente e captura estruturada de exceções de API (`errors.APIError`) para evitar quedas no servidor.

### Configuração de Ambiente
- **Credenciais Seguras:** A chave de acesso é obtida via variável de ambiente `GEMINI_API_KEY` carregada de forma isolada através do arquivo `.env` com o auxílio do pacote `python-dotenv`.
- **Dependências:** O pacote oficial `google-genai` foi integrado ao projeto e versionado no arquivo de dependências (`requirements.txt`).

### Fluxo de Funcionamento
1. O usuário submete um prompt descritivo na interface web do ScriptaAI.
2. O FastAPI recebe os parâmetros e aciona o serviço `generate_text_with_gemini`.
3. O SDK oficial comunica-se com a nuvem do Google usando o modelo `gemini-3.8-flash`.
4. O texto gerado é retornado, processado e injetado dinamicamente na folha A4 de pré-visualização para exportação ou refinamento.

### Tecnologias

- Python 3.13, FastAPI e Pydantic v2
- SQLAlchemy com SQLite
- WeasyPrint (geração de PDF)
- Pytest (testes automatizados)
- HTML5, CSS3 e JavaScript puro

## Processamento de Fontes de Entrada & Upload de Arquivos (Etapa 7)

O ScriptaAI foi expandido para processar arquivos de apoio locais (`.txt`, `.md`), permitindo injetar o conteúdo extraído diretamente como fonte de contexto para o prompt da inteligência artificial antes da geração final do documento.

### Arquitetura de Extração (`services/file_extractor_service.py`)
- **Leitura Segura:** Implementação de rotina para abertura e extração de texto bruto de arquivos locais.
- **Tratamento de Codificação:** Suporte nativo à codificação `utf-8` com mecanismo inteligente de fallback para `latin-1`, prevenindo falhas de decodificação de caracteres.
- **Validação de Extensões:** Restrição controlada para formatos de texto suportados (`.txt` e `.md`).

### Atualização de Contratos (`schemas/document.py`)
- **Schemas Pydantic v2:** Inclusão do campo `uploaded_files` na classe de entrada `GenerateIn`, permitindo mapear referências aos arquivos enviados pelo usuário para compor o escopo informacional da IA.

## IA Generativa, Segurança & Exclusão de Rascunhos (Etapa 8)

O ScriptaAI foi expandido com um motor de inteligência artificial de alta performance e mecanismos robustos de gerenciamento e segurança de dados, permitindo a limpeza de rascunhos e controle total do ciclo de vida dos documentos salvos.

### Integração com o Google Gemini (`services/ai_service.py`)
- **SDK Oficial:** Utiliza a biblioteca moderna `google-genai` do Google com o modelo estável **`gemini-3.8-flash`** para geração autônoma de conteúdo contextual.
- **Isolamento de Contexto:** O pipeline separa estritamente as instruções de comando (prompt) das fontes de referência (links externos e arquivos locais), prevenindo poluição visual no documento final.
- **Credenciais Seguras:** Chave de acesso gerenciada por variável de ambiente isolada (`GEMINI_API_KEY`) via `.env`.

### Processamento de Fontes de Entrada (`services/file_extractor_service.py`)
- **Leitura Segura:** Suporte a arquivos locais `.txt` e `.md` codificados em `utf-8` com fallback inteligente para `latin-1`.
- **Injeção Dinâmica:** O conteúdo extraído dos arquivos de apoio é somado aos links raspados para compor o escopo informacional base da IA antes da renderização no preview A4.

### Gestão Segura e Exclusão de Documentos
- **Exclusão em Cascata:** O backend conta com endpoint dedicado (`DELETE /api/documents/{document_id}`) que remove o registro relacional do banco de dados e os arquivos físicos associados (exports e uploads temporários) de forma síncrona.
- **Interface de Limpeza no Histórico:** O painel lateral do frontend (`static/js/app.js`) inclui controles interativos por item para exclusão rápida de rascunhos e testes indesejados, garantindo conformidade com boas práticas de privacidade e organização do usuário.

### Estrutura do projeto

```
ScriptaAI/
├── main.py                    # Aplicação FastAPI, rotas da API, exclusão e pipeline de IA
├── database.py                # Conexão e sessão com o banco SQLite
├── models/
│   └── document.py            # Modelos relacionais do banco (Document, SourceFile, etc.)
├── schemas/
│   └── document.py            # Schemas de validação e contratos (Pydantic v2 com uploaded_files)
├── services/
│   ├── ai_service.py          # Integração oficial com o Google Gemini (SDK google-genai, gemini-3.8-flash)
│   ├── cleanup_service.py     # Limpeza automática de arquivos temporários e LGPD (via lifespan)
│   ├── file_extractor_service.py # Leitura segura de arquivos locais de apoio (.txt, .md com fallback)
│   ├── gtk_silencer.py        # Silenciador de avisos do GTK para o WeasyPrint no Windows
│   ├── media_service.py       # Raspagem de URLs e links externos de apoio
│   └── pdf_service.py         # Motor de compilação HTML/Markdown para PDF com WeasyPrint
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

### Instalação

1. Pré-requisitos: Python 3.13 e as bibliotecas do sistema exigidas pelo WeasyPrint (no Windows, o GTK). Consulte a documentação oficial do WeasyPrint para o seu sistema.
2. Clone o repositório e entre na pasta:

   ```bash
   git clone <url-do-repositorio>
   cd ScriptaAI
   ```

3. Crie e ative o ambiente virtual:

   ```bash
   python -m venv .venv
   ```

   - Windows: `.venv\Scripts\activate`
   - Linux/macOS: `source .venv/bin/activate`

4. Instale as dependências e inicie o servidor:

   ```bash
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```

5. Abra `http://127.0.0.1:8000` no navegador.

### Variáveis de ambiente (opcionais)

| Variável | Padrão | Descrição |
|---|---|---|
| `STORAGE_ROOT` | `storage` | Pasta dos arquivos enviados e dos PDFs gerados |
| `MAX_UPLOAD_MB` | `25` | Tamanho máximo, em MB, de cada arquivo enviado |
| `ALLOWED_ORIGINS` | `http://127.0.0.1:8000,http://localhost:8000` | Origens permitidas pelo CORS, separadas por vírgula |

### Endpoints da API

A documentação interativa fica em `http://127.0.0.1:8000/docs`.

| Método | Rota | Descrição | Sucesso |
|---|---|---|---|
| GET | `/api/health` | Verifica se a aplicação está no ar | 200 |
| POST | `/api/upload` | Envia um ou mais arquivos (campo `files`) | 200 |
| POST | `/api/generate-preview` | Gera o HTML da pré-visualização | 200 |
| POST | `/api/export-pdf` | Gera e devolve o PDF do documento | 200 |
| POST | `/api/documents` | Salva o documento no banco | 201 |
| GET | `/api/documents` | Lista os documentos salvos, do mais recente ao mais antigo | 200 |
| GET | `/api/documents/{document_id}` | Retorna um documento salvo com capa e texto completos | 200 |

Os erros seguem o formato `{"ok": false, "error": "mensagem"}`:

| Código | Quando acontece |
|---|---|
| 404 | Documento não encontrado |
| 413 | Arquivo maior que o limite de `MAX_UPLOAD_MB` |
| 415 | Extensão de arquivo não permitida |
| 422 | Dados do payload inválidos |
| 500 | Falha interna, como erro na geração do PDF |

### Banco de dados

O banco é um arquivo SQLite (`scriptaai.db`), criado automaticamente na primeira execução.

| Tabela | Modelo | Finalidade |
|---|---|---|
| `documents` | `Document` | Título, norma, fonte, tamanho, margem, capa (JSON), fórmula, texto e datas |
| `source_files` | `SourceFile` | Arquivos de apoio vinculados a um documento |
| `document_images` | `DocumentImage` | Imagens vinculadas a um documento |
| `export_records` | `ExportRecord` | Registro dos arquivos exportados |

A API grava e lê apenas a tabela `documents`. As demais tabelas já existem, mas ainda não são preenchidas pela aplicação.

### Testes automatizados

```bash
pip install -r requirements-dev.txt
pytest
```

A suíte em `tests/` cobre a rota de verificação, o upload (envio válido, extensão recusada e falta de arquivo), a pré-visualização em diferentes cenários (com links simulados) e a geração do PDF, incluindo falha simulada no motor. Os testes usam pastas temporárias e não alteram o `storage` real.

### Privacidade e LGPD

- **Limpeza automática:** uma tarefa em segundo plano, iniciada com a aplicação, remove arquivos temporários. A regra está em `services/cleanup_service.py`. Prazo: `<preencher após conferir o cleanup_service.py>`.
- **Arquivos enviados:** ficam em `storage/uploads`.
- **PDFs gerados:** ficam em `storage/output`.
- **Documentos salvos:** ficam no banco até serem excluídos. A interface ainda não tem função para excluir documentos.
- **Política de privacidade:** a versão atual é preliminar e precisa de revisão jurídica antes da publicação.

### Limitações conhecidas

- Links e arquivos enviados não são salvos com o documento e, por isso, não voltam ao reabrir.
- A geração de texto por IA ainda não está implementada. O conteúdo vem do que o usuário escreve.
- A exportação para Word gera um arquivo `.doc`, e não um `.docx`.
- Ainda não há rota para excluir documentos salvos.

### Licença

Projeto sob a licença MIT. Veja o arquivo `LICENSE`.