require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const PRIVATE_DIR = path.join(__dirname, '..', 'private');
const LEGACY_DATA_FILE = path.join(__dirname, '..', 'data', 'orcamentos.json');
const ADMIN_COOKIE = 'destino_certo_admin';
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const adminSessions = new Map();
const loginAttempts = new Map();
let schemaPromise = null;

const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT) || 5433,
  database: process.env.DB_NAME || 'destino_certo',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

pool.on('error', (error) => {
  console.error('Erro inesperado no PostgreSQL:', error.message);
});

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use(express.static(PUBLIC_DIR));

const destinos = [
  {
    id: 'rio',
    nome: 'Rio de Janeiro',
    descricao: 'Praias, cultura e paisagens inesquecíveis.'
  },
  {
    id: 'gramado',
    nome: 'Gramado',
    descricao: 'Natureza, gastronomia e clima acolhedor.'
  },
  {
    id: 'lisboa',
    nome: 'Lisboa',
    descricao: 'História, arquitetura e novos sabores.'
  }
];

function textoValido(valor, maximo) {
  return typeof valor === 'string' &&
    valor.trim().length > 0 &&
    valor.trim().length <= maximo;
}

function dataValida(data) {
  if (typeof data !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return false;
  }

  const [ano, mes, dia] = data.split('-').map(Number);
  const dataObj = new Date(Date.UTC(ano, mes - 1, dia));

  return dataObj.getUTCFullYear() === ano &&
    dataObj.getUTCMonth() === mes - 1 &&
    dataObj.getUTCDate() === dia;
}

function cookieValue(req, nome) {
  const cookies = (req.headers.cookie || '').split(';');

  for (const cookie of cookies) {
    const separador = cookie.indexOf('=');
    if (separador === -1) continue;

    const chave = cookie.slice(0, separador).trim();
    if (chave === nome) return cookie.slice(separador + 1).trim();
  }

  return '';
}

function adminAutenticado(req) {
  const token = cookieValue(req, ADMIN_COOKIE);
  if (!token) return false;

  const sessao = adminSessions.get(token);
  if (!sessao) return false;

  if (sessao.expiraEm <= Date.now()) {
    adminSessions.delete(token);
    return false;
  }

  return true;
}

function exigirAdmin(req, res, next) {
  if (!adminAutenticado(req)) {
    return res.status(401).json({
      erro: 'Acesso restrito. Entre com a conta de administrador.'
    });
  }

  next();
}

function exigirAdminNaPagina(req, res, next) {
  if (!adminAutenticado(req)) return res.redirect('/admin/login');
  next();
}

function compararSeguramente(valor, esperado) {
  if (typeof valor !== 'string' || typeof esperado !== 'string') {
    return false;
  }

  const valorBuffer = Buffer.from(valor);
  const esperadoBuffer = Buffer.from(esperado);

  return valorBuffer.length === esperadoBuffer.length &&
    crypto.timingSafeEqual(valorBuffer, esperadoBuffer);
}

function loginBloqueado(ip) {
  const tentativa = loginAttempts.get(ip);
  if (!tentativa) return false;

  if (tentativa.expiraEm <= Date.now()) {
    loginAttempts.delete(ip);
    return false;
  }

  return tentativa.quantidade >= MAX_LOGIN_ATTEMPTS;
}

function registrarFalhaLogin(ip) {
  let tentativa = loginAttempts.get(ip);

  if (!tentativa || tentativa.expiraEm <= Date.now()) {
    tentativa = {
      quantidade: 0,
      expiraEm: Date.now() + LOGIN_WINDOW_MS
    };
  }

  tentativa.quantidade += 1;
  loginAttempts.set(ip, tentativa);
}

function limparCookieAdmin(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
  );
}

async function assegurarTabelaSolicitacoes() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS solicitacoes_orcamento (
          id UUID PRIMARY KEY,
          nome VARCHAR(120) NOT NULL,
          email VARCHAR(180) NOT NULL,
          telefone VARCHAR(30),
          destino VARCHAR(120) NOT NULL,
          passageiros INTEGER NOT NULL CHECK (passageiros >= 1),
          data_ida DATE,
          data_volta DATE,
          faixa_orcamento VARCHAR(80),
          observacoes TEXT,
          criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(20) NOT NULL DEFAULT 'pendente',
          decidido_em TIMESTAMPTZ
        )
      `);

      // Migração automática para instalações que já tinham a tabela antiga.
      await pool.query(`
        ALTER TABLE solicitacoes_orcamento
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pendente'
      `);
      await pool.query(`
        ALTER TABLE solicitacoes_orcamento
        ADD COLUMN IF NOT EXISTS decidido_em TIMESTAMPTZ
      `);

      // Importa uma única vez por execução os pedidos da versão antiga em JSON.
      // ON CONFLICT preserva solicitações que já existam no PostgreSQL.
      try {
        if (fs.existsSync(LEGACY_DATA_FILE)) {
          const conteudo = fs.readFileSync(LEGACY_DATA_FILE, 'utf8');
          const pedidosAntigos = JSON.parse(conteudo);

          if (Array.isArray(pedidosAntigos)) {
            for (const pedido of pedidosAntigos) {
              if (!pedido ||
                  typeof pedido.id !== 'string' ||
                  !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pedido.id) ||
                  !textoValido(pedido.nome, 120) ||
                  !textoValido(pedido.email, 180) ||
                  !textoValido(pedido.destino, 120)) {
                continue;
              }

              const passageirosLegados = String(pedido.passageiros ?? '');
              const quantidade = passageirosLegados === '4 ou mais'
                ? 4
                : Number(passageirosLegados);
              if (!Number.isInteger(quantidade) || quantidade < 1) continue;

              const criadoEm = pedido.criadoEm && !Number.isNaN(Date.parse(pedido.criadoEm))
                ? new Date(pedido.criadoEm)
                : new Date();

              await pool.query(`
                INSERT INTO solicitacoes_orcamento (
                  id, nome, email, telefone, destino, passageiros,
                  data_ida, data_volta, faixa_orcamento, observacoes,
                  criado_em, status
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pendente')
                ON CONFLICT (id) DO NOTHING
              `, [
                pedido.id,
                pedido.nome.trim(),
                pedido.email.trim(),
                typeof pedido.telefone === 'string' ? pedido.telefone.slice(0, 30) : '',
                pedido.destino.trim(),
                quantidade,
                dataValida(pedido.ida) ? pedido.ida : null,
                dataValida(pedido.volta) ? pedido.volta : null,
                typeof pedido.orcamento === 'string' ? pedido.orcamento.slice(0, 80) : '',
                typeof pedido.observacoes === 'string' ? pedido.observacoes.slice(0, 1000) : '',
                criadoEm
              ]);
            }
          }
        }
      } catch (error) {
        // A falha no arquivo legado não impede usar os pedidos do PostgreSQL.
        console.error('Não foi possível importar pedidos antigos do JSON:', error.message);
      }
    })()
      .then(() => true)
      .catch((error) => {
        console.error('Não foi possível preparar a tabela de solicitações:', error.message);
        schemaPromise = null;
        return false;
      });
  }

  return schemaPromise;
}

app.get('/api/status', async (_req, res) => {
  try {
    const resultado = await pool.query(
      'SELECT current_database() AS banco, current_user AS usuario'
    );

    res.json({
      status: 'ok',
      sistema: 'Destino Certo',
      banco: 'conectado',
      nomeBanco: resultado.rows[0].banco,
      usuario: resultado.rows[0].usuario
    });
  } catch (error) {
    console.error('Erro ao verificar o banco:', error.message);

    res.status(500).json({
      status: 'erro',
      banco: 'desconectado',
      mensagem: error.message
    });
  }
});

app.get('/api/destinos', (_req, res) => {
  res.json(destinos);
});

app.post('/api/orcamentos', async (req, res) => {
  const body = req.body || {};

  const nome = body.nome;
  const email = body.email;
  const destino = body.destino;
  const passageiros = String(
    body.passageiros == null ? '' : body.passageiros
  );
  const ida = body.ida || '';
  const volta = body.volta || '';
  const orcamento = body.orcamento || '';
  const observacoes = body.observacoes == null ? '' : body.observacoes;
  const telefone = body.telefone == null ? '' : body.telefone;

  if (!textoValido(nome, 120)) {
    return res.status(400).json({
      erro: 'Informe seu nome (até 120 caracteres).'
    });
  }

  if (!textoValido(email, 180) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      erro: 'Informe um e-mail válido.'
    });
  }

  if (!textoValido(destino, 120)) {
    return res.status(400).json({
      erro: 'Selecione o destino desejado.'
    });
  }

  if (!['1', '2', '3', '4 ou mais'].includes(passageiros)) {
    return res.status(400).json({
      erro: 'Selecione a quantidade de passageiros.'
    });
  }

  if (ida && !dataValida(ida)) {
    return res.status(400).json({
      erro: 'A data de ida é inválida.'
    });
  }

  if (volta && !dataValida(volta)) {
    return res.status(400).json({
      erro: 'A data de volta é inválida.'
    });
  }

  if (ida && volta && volta < ida) {
    return res.status(400).json({
      erro: 'A data de volta deve ser posterior ou igual à ida.'
    });
  }

  if (typeof telefone !== 'string' ||
      typeof observacoes !== 'string' ||
      observacoes.length > 1000 ||
      typeof orcamento !== 'string' ||
      orcamento.length > 80) {
    return res.status(400).json({
      erro: 'Confira telefone, orçamento e observações.'
    });
  }

  try {
    const bancoPreparado = await assegurarTabelaSolicitacoes();
    if (!bancoPreparado) {
      return res.status(503).json({
        erro: 'Banco de dados indisponível. Tente novamente mais tarde.'
      });
    }

    const resultado = await pool.query(
      `INSERT INTO solicitacoes_orcamento (
        id, nome, email, telefone, destino, passageiros,
        data_ida, data_volta, faixa_orcamento, observacoes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id`,
      [
        crypto.randomUUID(),
        nome.trim(),
        email.trim(),
        telefone.trim().slice(0, 30),
        destino.trim(),
        passageiros === '4 ou mais' ? 4 : Number(passageiros),
        ida || null,
        volta || null,
        orcamento.trim(),
        observacoes.trim()
      ]
    );

    res.status(201).json({
      mensagem: 'Solicitação salva com sucesso. Aguarde a análise do administrador.',
      id: resultado.rows[0].id,
      status: 'pendente'
    });
  } catch (error) {
    console.error('Erro ao salvar orçamento:', error.message);

    res.status(500).json({
      erro: 'Não foi possível salvar o orçamento.',
      detalhe: error.message
    });
  }
});

// Área administrativa: a página e a API são protegidas no servidor.
app.get('/admin/login', (req, res) => {
  if (adminAutenticado(req)) return res.redirect('/admin');
  res.sendFile(path.join(PRIVATE_DIR, 'admin-login.html'));
});

app.get('/admin', exigirAdminNaPagina, (_req, res) => {
  res.sendFile(path.join(PRIVATE_DIR, 'admin.html'));
});

app.get('/admin/app.js', exigirAdminNaPagina, (_req, res) => {
  res.sendFile(path.join(PRIVATE_DIR, 'admin.js'));
});

app.post('/api/admin/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'desconhecido';

  if (loginBloqueado(ip)) {
    return res.status(429).json({
      erro: 'Muitas tentativas de acesso. Tente novamente em 15 minutos.'
    });
  }

  const usuarioEsperado = process.env.ADMIN_USER;
  const senhaEsperada = process.env.ADMIN_PASSWORD;

  if (!usuarioEsperado || !senhaEsperada) {
    return res.status(503).json({
      erro: 'Configure ADMIN_USER e ADMIN_PASSWORD no arquivo .env.'
    });
  }

  const usuario = typeof req.body?.usuario === 'string' ? req.body.usuario : '';
  const senha = typeof req.body?.senha === 'string' ? req.body.senha : '';
  const credenciaisCorretas = compararSeguramente(usuario, usuarioEsperado) &&
    compararSeguramente(senha, senhaEsperada);

  if (!credenciaisCorretas) {
    registrarFalhaLogin(ip);
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  }

  loginAttempts.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  const expiraEm = Date.now() + ADMIN_SESSION_MS;
  adminSessions.set(token, { expiraEm });

  // Limpa sessões expiradas para a memória não crescer indefinidamente.
  for (const [tokenSalvo, sessao] of adminSessions.entries()) {
    if (sessao.expiraEm <= Date.now()) adminSessions.delete(tokenSalvo);
  }

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${ADMIN_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(ADMIN_SESSION_MS / 1000)}${secure}`
  );

  res.json({ mensagem: 'Acesso autorizado.', redirect: '/admin' });
});

app.post('/api/admin/logout', (req, res) => {
  const token = cookieValue(req, ADMIN_COOKIE);
  if (token) adminSessions.delete(token);
  limparCookieAdmin(res);
  res.json({ mensagem: 'Sessão encerrada.' });
});

app.get('/api/admin/solicitacoes', exigirAdmin, async (_req, res) => {
  try {
    const bancoPreparado = await assegurarTabelaSolicitacoes();
    if (!bancoPreparado) {
      return res.status(503).json({
        erro: 'Banco de dados indisponível. Confira a conexão com o PostgreSQL.'
      });
    }

    const resultado = await pool.query(`
      SELECT
        id,
        nome,
        email,
        telefone,
        destino,
        passageiros,
        to_char(data_ida, 'YYYY-MM-DD') AS ida,
        to_char(data_volta, 'YYYY-MM-DD') AS volta,
        faixa_orcamento AS orcamento,
        observacoes,
        status,
        criado_em AS "criadoEm",
        decidido_em AS "decididoEm"
      FROM solicitacoes_orcamento
      ORDER BY criado_em DESC
    `);

    res.set('Cache-Control', 'no-store');
    res.json(resultado.rows);
  } catch (error) {
    console.error('Erro ao listar solicitações:', error.message);
    res.status(500).json({ erro: 'Não foi possível carregar as solicitações.' });
  }
});

app.patch('/api/admin/solicitacoes/:id/status', exigirAdmin, async (req, res) => {
  const id = req.params.id;
  const status = req.body?.status;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ erro: 'Identificador da solicitação inválido.' });
  }

  if (!['aprovada', 'recusada'].includes(status)) {
    return res.status(400).json({ erro: 'Escolha aprovar ou recusar a viagem.' });
  }

  try {
    const bancoPreparado = await assegurarTabelaSolicitacoes();
    if (!bancoPreparado) {
      return res.status(503).json({ erro: 'Banco de dados indisponível.' });
    }

    const resultado = await pool.query(
      `UPDATE solicitacoes_orcamento
       SET status = $1, decidido_em = CURRENT_TIMESTAMP
       WHERE id = $2::uuid AND status = 'pendente'
       RETURNING id, status`,
      [status, id]
    );

    if (resultado.rowCount === 0) {
      const existente = await pool.query(
        'SELECT status FROM solicitacoes_orcamento WHERE id = $1::uuid',
        [id]
      );

      if (existente.rowCount === 0) {
        return res.status(404).json({ erro: 'Solicitação não encontrada.' });
      }

      return res.status(409).json({
        erro: 'Esta solicitação já foi analisada.',
        statusAtual: existente.rows[0].status
      });
    }

    res.json({
      mensagem: status === 'aprovada'
        ? 'Viagem aprovada com sucesso.'
        : 'Solicitação de viagem recusada.',
      ...resultado.rows[0]
    });
  } catch (error) {
    console.error('Erro ao atualizar solicitação:', error.message);
    res.status(500).json({ erro: 'Não foi possível atualizar a solicitação.' });
  }
});

app.use('/api', (_req, res) => {
  res.status(404).json({ erro: 'Rota da API não encontrada.' });
});

app.get('*path', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`Destino Certo disponível em http://localhost:${PORT}`);
  console.log(`Status: http://localhost:${PORT}/api/status`);
  assegurarTabelaSolicitacoes();
});

function encerrar() {
  server.close(async () => {
    try {
      await pool.end();
    } finally {
      process.exit(0);
    }
  });
}

process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
