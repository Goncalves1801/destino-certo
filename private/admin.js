const requestList = document.querySelector('#request-list');
const adminMessage = document.querySelector('#admin-message');
const refreshButton = document.querySelector('#refresh-button');
const statusFilter = document.querySelector('#status-filter');
const logoutButton = document.querySelector('#logout-button');

let solicitacoes = [];

const statusInfo = {
  pendente: { label: 'Pendente', classe: 'status-pendente' },
  aprovada: { label: 'Aprovada', classe: 'status-aprovada' },
  recusada: { label: 'Recusada', classe: 'status-recusada' }
};

function dataBrasileira(data) {
  if (!data) return 'Não informada';
  const partes = String(data).slice(0, 10).split('-');
  if (partes.length !== 3) return 'Não informada';
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function dataHoraBrasileira(data) {
  if (!data) return 'Não informada';
  const valor = new Date(data);
  if (Number.isNaN(valor.getTime())) return 'Não informada';
  return valor.toLocaleString('pt-BR');
}

function criarElemento(tag, classe, texto) {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined && texto !== null) elemento.textContent = texto;
  return elemento;
}

function adicionarCampo(container, rotulo, valor) {
  const campo = criarElemento('div', 'request-field');
  campo.appendChild(criarElemento('span', 'request-field-label', rotulo));
  campo.appendChild(criarElemento('strong', 'request-field-value', valor || 'Não informado'));
  container.appendChild(campo);
}

function atualizarContadores() {
  document.querySelector('#count-total').textContent = solicitacoes.length;
  document.querySelector('#count-pending').textContent = solicitacoes.filter((item) => item.status === 'pendente').length;
  document.querySelector('#count-approved').textContent = solicitacoes.filter((item) => item.status === 'aprovada').length;
  document.querySelector('#count-rejected').textContent = solicitacoes.filter((item) => item.status === 'recusada').length;
}

function renderizarSolicitacoes() {
  requestList.replaceChildren();
  const filtro = statusFilter.value;
  const itens = solicitacoes.filter((item) => filtro === 'todos' || item.status === filtro);

  if (!itens.length) {
    requestList.appendChild(criarElemento('p', 'empty-state',
      solicitacoes.length
        ? 'Nenhuma solicitação encontrada para este filtro.'
        : 'Ainda não há solicitações de viagem cadastradas.'));
    return;
  }

  itens.forEach((item) => {
    const cartao = criarElemento('article', 'request-card');
    const cabecalho = criarElemento('div', 'request-card-header');
    const tituloGrupo = criarElemento('div', 'request-title-group');
    tituloGrupo.appendChild(criarElemento('h3', 'request-client-name', item.nome));
    tituloGrupo.appendChild(criarElemento('p', 'request-id', `Solicitação ${item.id}`));
    cabecalho.appendChild(tituloGrupo);

    const status = statusInfo[item.status] || statusInfo.pendente;
    cabecalho.appendChild(criarElemento('span', `status-pill ${status.classe}`, status.label));
    cartao.appendChild(cabecalho);

    const campos = criarElemento('div', 'request-fields');
    adicionarCampo(campos, 'Destino desejado', item.destino);
    adicionarCampo(campos, 'E-mail', item.email);
    adicionarCampo(campos, 'Telefone', item.telefone);
    adicionarCampo(campos, 'Passageiros', Number(item.passageiros) >= 4 ? '4 ou mais' : String(item.passageiros || 'Não informado'));
    adicionarCampo(campos, 'Data de ida', dataBrasileira(item.ida));
    adicionarCampo(campos, 'Data de volta', dataBrasileira(item.volta));
    adicionarCampo(campos, 'Orçamento por pessoa', item.orcamento);
    adicionarCampo(campos, 'Solicitado em', dataHoraBrasileira(item.criadoEm));
    cartao.appendChild(campos);

    if (item.observacoes) {
      const observacoes = criarElemento('div', 'request-notes');
      observacoes.appendChild(criarElemento('span', 'request-field-label', 'Observações do cliente'));
      observacoes.appendChild(criarElemento('p', '', item.observacoes));
      cartao.appendChild(observacoes);
    }

    if (item.status === 'pendente') {
      const acoes = criarElemento('div', 'request-actions');
      const aprovar = criarElemento('button', 'decision-button approve-button', 'Aprovar viagem');
      aprovar.type = 'button';
      aprovar.addEventListener('click', () => decidirSolicitacao(item.id, 'aprovada'));
      const recusar = criarElemento('button', 'decision-button reject-button', 'Recusar viagem');
      recusar.type = 'button';
      recusar.addEventListener('click', () => decidirSolicitacao(item.id, 'recusada'));
      acoes.append(aprovar, recusar);
      cartao.appendChild(acoes);
    } else {
      const decisao = criarElemento('p', 'decision-note',
        `Esta solicitação foi ${item.status === 'aprovada' ? 'aprovada' : 'recusada'}${item.decididoEm ? ` em ${dataHoraBrasileira(item.decididoEm)}` : ''}.`);
      cartao.appendChild(decisao);
    }

    requestList.appendChild(cartao);
  });
}

async function carregarSolicitacoes() {
  refreshButton.disabled = true;
  refreshButton.textContent = 'Atualizando...';
  adminMessage.textContent = '';
  adminMessage.className = 'form-message';

  try {
    const response = await fetch('/api/admin/solicitacoes', { cache: 'no-store' });
    if (response.status === 401) {
      window.location.assign('/admin/login');
      return;
    }

    const resultado = await response.json();
    if (!response.ok) throw new Error(resultado.erro || 'Não foi possível carregar as solicitações.');

    solicitacoes = resultado.map((item) => ({ ...item, status: item.status || 'pendente' }));
    atualizarContadores();
    renderizarSolicitacoes();
  } catch (error) {
    requestList.replaceChildren(criarElemento('p', 'empty-state error-text', error.message));
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = 'Atualizar lista';
  }
}

async function decidirSolicitacao(id, status) {
  const acao = status === 'aprovada' ? 'aprovar' : 'recusar';
  if (!window.confirm(`Tem certeza de que deseja ${acao} esta solicitação? Essa decisão não poderá ser alterada aqui depois.`)) {
    return;
  }

  adminMessage.textContent = '';
  adminMessage.className = 'form-message';

  try {
    const response = await fetch(`/api/admin/solicitacoes/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (response.status === 401) {
      window.location.assign('/admin/login');
      return;
    }

    const resultado = await response.json();
    if (!response.ok) throw new Error(resultado.erro || 'Não foi possível registrar a decisão.');

    adminMessage.textContent = resultado.mensagem;
    adminMessage.className = 'form-message success';
    await carregarSolicitacoes();
  } catch (error) {
    adminMessage.textContent = error.message;
    adminMessage.className = 'form-message error';
  }
}

statusFilter.addEventListener('change', renderizarSolicitacoes);
refreshButton.addEventListener('click', carregarSolicitacoes);
logoutButton.addEventListener('click', async () => {
  try {
    await fetch('/api/admin/logout', { method: 'POST' });
  } finally {
    window.location.assign('/admin/login');
  }
});

carregarSolicitacoes();
