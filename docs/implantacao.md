# Documento de implantação — Destino Certo

## Objetivo
Publicar um portal informativo de agência de viagens com catálogo de destinos e formulário demonstrativo de solicitação de orçamento.

## Etapas, tempo estimado e responsáveis
| Etapa | Tempo | Responsável |
|---|---:|---|
| Conferir Node.js e extrair o ZIP | 10 min | Aluno/implantador |
| Instalar dependências com npm | 5 min | Aluno/implantador |
| Executar e validar no navegador | 15 min | Aluno/implantador |
| Preparar repositório e hospedagem | 20–40 min | Aluno/implantador |
| Configurar domínio/DNS (se disponível) | 15–60 min + propagação | Administrador do domínio |
| Treinar usuário e entregar manual | 10 min | Aluno/implantador |

## Requisitos básicos
- Node.js 18+ e npm para execução local.
- Navegador moderno e conexão à internet para carregar as imagens e fontes externas.
- Para hospedagem completa, serviço que execute aplicações Node.js.
- Domínio é opcional; pode-se usar o endereço fornecido pela hospedagem.

## Tecnologias utilizadas
HTML5, CSS3, JavaScript no navegador, Node.js, Express e PostgreSQL. O backend valida e salva as solicitações na tabela `solicitacoes_orcamento`. O painel administrativo utiliza autenticação por sessão para proteger a consulta e a decisão dos pedidos.

## Publicação e DNS
1. Crie um repositório no GitHub e envie os arquivos do projeto.
2. Crie um serviço Web Node.js no provedor escolhido, informe o comando de instalação `npm install` e o comando de inicialização `npm start`.
3. Use o endereço gerado pelo provedor para validar a aplicação.
4. Para domínio próprio, registre um domínio em um registrador legítimo e siga os valores DNS fornecidos pelo serviço de hospedagem. Normalmente, o provedor indica um registro CNAME para subdomínios e/ou registros A/ALIAS para o domínio raiz. Use exatamente os valores indicados pelo provedor; eles variam por serviço.
5. Aguarde a propagação DNS e valide HTTPS/certificado no painel do provedor.

## Checklist de validação
- [ ] `npm install` finaliza sem erro.
- [ ] `npm start` inicia o servidor na porta 3000 (ou na porta definida por `PORT`).
- [ ] Página inicial e imagens aparecem.
- [ ] Menu funciona em tela pequena.
- [ ] Botões “Montar viagem” preenchem o destino.
- [ ] Campos obrigatórios e formato do e-mail são validados.
- [ ] Data de volta anterior à ida é recusada.
- [ ] Envio de teste cria uma solicitação pendente no PostgreSQL.
- [ ] O acesso administrativo solicita usuário e senha.
- [ ] Sem login, a rota `/api/admin/solicitacoes` retorna acesso restrito.
- [ ] Com login, o painel lista os pedidos e permite aprovar ou recusar solicitações pendentes.
- [ ] Endpoint `/api/status` responde JSON.
- [ ] Manual do usuário foi entregue.

## Limitações e segurança
As credenciais administrativas deste pacote são apenas para demonstração: altere `ADMIN_USER` e `ADMIN_PASSWORD` no `.env` antes de publicar. Não versione senhas reais. Para uso público, configure HTTPS, restrinja o acesso ao servidor e revise a política de privacidade e a proteção de dados. A aprovação no painel não compra passagens nem confirma reservas com fornecedores.
