# ScriptaAI

Gerador Inteligente de PDFs e Documentos com IA (Web Full-Stack e Backend Python).

## Status

Frontend concluído. A interface está completa e agora se conecta ao backend Python para gerar PDFs reais e processar links. A integração com IA generativa será implementada em etapas futuras.

## Tecnologias

**Frontend:** HTML5, CSS3 e JavaScript vanilla. Não há frameworks.
**Backend:** Python, FastAPI, WeasyPrint (Engine de PDF), BeautifulSoup4, Pytest.

## Estrutura

- `static/index.html`: estrutura da página, com barra lateral, barra de ferramentas, folha A4 de preview e modal de privacidade.
- `static/css/style.css`: temas claro e escuro, layout responsivo e regras de impressão.
- `static/js/app.js`: comportamento da interface, incluindo preview, upload, cópia, exportação e tema.
- `main.py`: servidor FastAPI com as rotas da API.
- `services/`: motores de PDF (`pdf_service.py`) e raspagem de links/arquivos (`media_service.py`).
- `tests/`: suíte de testes automatizados com Pytest.
- `mocks/`: arquivos JSON para simular requisições nos testes.

## Como executar

**Ambiente de Desenvolvimento (Backend + Frontend):**
1. Ative o ambiente virtual.
2. Instale as dependências: `pip install -r requirements-dev.txt`
3. Inicie o servidor: `uvicorn main:app --reload --host 127.0.0.1 --port 8000`
4. Acesse `http://127.0.0.1:8000` no navegador. A documentação da API estará em `http://127.0.0.1:8000/docs`.

## Funcionalidades

- **Tema claro e escuro**, com a escolha salva no navegador.
- **Entradas de conteúdo:** prompt, links e upload de arquivos. Os formatos aceitos são `.txt`, `.md`, `.docx`, `.mp3`, `.mp4`, `.png` e `.pdf`.
- **Formatação:** normas ABNT, APA/IEEE, Executivo Moderno e Apostila Compacta.
- **Tipografia:** fonte (Arial, Times New Roman, Roboto ou Monospace), tamanho de 10 a 14 pt e densidade de margem.
- **Capa:** título, subtítulo, autor e instituição.
- **Imagens e fórmulas:** tamanho, disposição e fórmula em texto.
- **Preview Real:** O botão "Gerar/Atualizar Preview" converte o texto (Markdown) para HTML formatado e aplica as regras de margem e tipografia em tempo real.
- **Raspagem de Links:** O sistema lê links (como da Wikipedia) e extrai o texto automaticamente, integrando ao documento.
- **Baixar PDF:** O botão gera o PDF nativamente no servidor usando WeasyPrint (com controle de quebra de páginas) e faz o download.
- **Baixar DOCX:** gera um arquivo `.doc` localmente no navegador.
- **Copiar Texto** e **Novo Documento**.

## Testes Automatizados

O projeto conta com uma suíte de 10 testes (Pytest) que cobre o healthcheck, upload, geração de preview e exportação de PDF. Para rodar:
`pytest`

## Limitações atuais

- A integração com IA generativa (para escrever o texto automaticamente) ainda não foi implementada.
- A fórmula é um texto simples, sem renderização matemática.
- O arquivo `.doc` não é um DOCX nativo.
- Não há banco de dados (o sistema é stateless por enquanto).

## Privacidade

O texto da Política de Privacidade e Termos (LGPD) é preliminar e precisa de revisão por profissional jurídico antes da publicação.

## Licença

MIT.