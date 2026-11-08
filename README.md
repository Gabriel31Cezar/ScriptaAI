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