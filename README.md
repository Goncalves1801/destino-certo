# Destino Certo — Portal de Agência de Viagens

Projeto demonstrativo com catálogo de destinos, formulário para solicitação de viagem e painel administrativo para analisar os pedidos recebidos.

## Requisitos
- Node.js 18 ou superior
- PostgreSQL em execução e banco configurado conforme o arquivo `.env`
- npm (incluído na instalação do Node.js)

## Executar no Windows (PowerShell ou terminal do VS Code)
1. Extraia o ZIP.
2. Entre na pasta do projeto que contém `package.json`:
   ```powershell
   cd destino-certo
   ```
3. Confira as configurações de PostgreSQL e as credenciais administrativas no arquivo `.env`.
4. Instale as dependências, caso necessário:
   ```powershell
   npm install
   ```
5. Inicie o servidor:
   ```powershell
   npm start
   ```
6. Abra `http://localhost:3000` no navegador.

Para encerrar, volte ao terminal e pressione `Ctrl + C`.

## Funcionalidades
- Página responsiva com destinos em destaque e formulário de solicitação.
- Solicitações guardadas no PostgreSQL.
- Acesso administrativo no canto superior direito.
- Painel protegido por autenticação, com consulta de solicitações e filtros por status.
- Aprovação ou recusa de cada solicitação pendente.
- Migração automática das colunas de status para a tabela existente.
- Importação dos pedidos antigos do arquivo `data/orcamentos.json` para o PostgreSQL, sem duplicar IDs já existentes.
- Endpoint de status em `http://localhost:3000/api/status`.

## Acesso administrativo local
As credenciais iniciais definidas no `.env` deste pacote são:
- **Usuário:** `admin`
- **Senha:** `Destino@2026`

Altere `ADMIN_USER` e `ADMIN_PASSWORD` no `.env` antes de publicar ou compartilhar o sistema. Essas credenciais de demonstração não devem ser usadas em um site público.

## Como funciona a análise
Cada solicitação nova começa como **Pendente**. O administrador autenticado pode aprovar ou recusar o pedido. Após a decisão, o sistema registra o status e a data da análise e não oferece uma segunda decisão para o mesmo pedido. A aprovação no site é uma decisão de análise do pedido; ela não emite passagem, não efetua pagamento nem confirma reserva com fornecedores.

## Publicação e domínio
Para publicar, configure credenciais próprias e HTTPS no serviço de hospedagem. O cookie administrativo recebe a opção `Secure` quando `NODE_ENV=production`. A API Express precisa ser hospedada em um serviço que execute Node.js; hospedagem apenas estática não executa o backend.
