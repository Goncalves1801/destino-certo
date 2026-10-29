# Manual do usuário — Destino Certo

## 1. Acessar o sistema
Abra o endereço disponibilizado pela pessoa responsável pela instalação. Na execução local, acesse `http://localhost:3000`.

## 2. Explorar destinos
Na seção “Destinos em destaque”, conheça Rio de Janeiro, Gramado e Lisboa. Use “Escolher destino” para preencher o destino no formulário.

## 3. Solicitar uma viagem
Preencha nome, e-mail, destino e quantidade de passageiros. Telefone, datas, faixa de orçamento e observações são opcionais. Clique em “Enviar solicitação”. O pedido ficará com status **Pendente** até ser analisado pelo administrador.

## 4. Acesso do administrador
Clique em “Administrador” no canto superior direito e entre com o usuário e a senha configurados no `.env`. No painel, o administrador consegue consultar as solicitações cadastradas, filtrar por status e aprovar ou recusar pedidos pendentes. Depois de uma decisão, o status fica registrado e os botões de análise deixam de aparecer para aquele pedido.

Apenas a sessão administrativa autenticada pode consultar a lista de pedidos pela API. O link de acesso pode aparecer na página inicial, mas sem as credenciais não é possível visualizar os dados dos clientes.

## 5. Observações
A aprovação no site não compra passagem, não processa pagamento e não confirma reserva com fornecedores. Para suporte técnico, procure a pessoa responsável pelo projeto ou pela instalação do banco de dados.
