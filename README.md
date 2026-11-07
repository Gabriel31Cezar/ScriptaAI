# ScriptaAI

Gerador Inteligente de PDFs e Documentos com IA (Web Full-Stack e Backend Python).

## Status

Frontend concluído. A interface está completa, mas ainda não se conecta a nenhum backend. A geração de conteúdo pela IA e o processamento dos arquivos enviados serão implementados em etapas futuras.

## Tecnologias

HTML5, CSS3 e JavaScript vanilla. Não há frameworks nem bibliotecas externas.

## Estrutura

- `static/index.html`: estrutura da página, com barra lateral, barra de ferramentas, folha A4 de preview e modal de privacidade.
- `static/css/style.css`: temas claro e escuro, layout responsivo e regras de impressão.
- `static/js/app.js`: comportamento da interface, incluindo preview, upload, cópia, exportação e tema.

## Como executar

1. Abra a pasta `scripta-ai` no PyCharm.
2. Clique com o botão direito em `static/index.html` e escolha **Open in Browser**.

Também é possível abrir o arquivo diretamente no navegador.

## Funcionalidades

- **Tema claro e escuro**, com a escolha salva no navegador.
- **Entradas de conteúdo:** prompt, links e upload de arquivos por clique ou arrastar. Os formatos aceitos são `.txt`, `.md`, `.docx`, `.mp3`, `.mp4`, `.png` e `.pdf`. Os arquivos são listados, mas ainda não são lidos nem enviados.
- **Formatação:** normas ABNT, APA/IEEE, Executivo Moderno e Apostila Compacta. Por enquanto, é apenas a seleção visual.
- **Tipografia:** fonte (Arial, Times New Roman, Roboto ou Monospace), tamanho de 10 a 14 pt e densidade de margem.
- **Capa:** título, subtítulo, autor e instituição, exibidos no topo da folha quando preenchidos.
- **Imagens e fórmulas:** tamanho (30%, 60% ou 100%), disposição (abaixo do texto, texto ao lado ou centralizado) e fórmula em texto. A imagem é um exemplo fixo.
- **Preview:** folha A4 com margem, fonte e tamanho escolhidos, atualizada pelo botão "Gerar/Atualizar Preview".
- **Baixar PDF:** abre a caixa de impressão do navegador, mostrando somente a folha. Escolha "Salvar como PDF" e desmarque cabeçalhos e rodapés.
- **Baixar DOCX:** gera um arquivo `.doc` que o Word e o LibreOffice abrem. Não é um DOCX nativo, então a formatação pode variar um pouco.
- **Copiar Texto** e **Novo Documento**.

## Limitações atuais

- Nenhum dado é enviado a servidores. Tudo acontece no navegador.
- O conteúdo da folha ainda é um texto de exemplo.
- Os arquivos enviados ainda não são processados.
- A fórmula é um texto simples, sem renderização matemática.
- O arquivo `.doc` não é um DOCX nativo.

## Privacidade

O texto da Política de Privacidade e Termos (LGPD) é preliminar e precisa de revisão por profissional jurídico antes da publicação.

## Licença

MIT.