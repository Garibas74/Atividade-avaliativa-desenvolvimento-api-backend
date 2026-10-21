import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { ownerFilter } from './policy.js';

const { JWT_SECRET, SERVICE_TOKEN, LOGS_URL, ANALYZER_URL } = process.env;
if (!JWT_SECRET || JWT_SECRET.length < 32 || !SERVICE_TOKEN || SERVICE_TOKEN.length < 32) throw new Error('Configure secrets with at least 32 characters');
const db = new PrismaClient();
const app = express();
app.use(helmet());
app.use(express.json({ limit: '16kb' }));
const audit = (acao, detalhe, usuarioId = null, client = db) => client.evento.create({ data: { acao, detalhe, usuarioId } });
const publicUser = { id: true, nome: true, email: true };
const tokenFor = user => jwt.sign({}, JWT_SECRET, { subject: String(user.id), expiresIn: '1h', issuer: 'todo-api', audience: 'todo-app', algorithm: 'HS256' });
const credentials = z.object({ email: z.string().trim().email().max(254).transform(v => v.toLowerCase()), senha: z.string().min(8).max(72).refine(v => Buffer.byteLength(v) <= 72, 'Senha deve ter no máximo 72 bytes') });
const taskInput = z.object({ titulo: z.string().trim().min(1).max(200), descricao: z.string().trim().max(2000).optional() }).strict();
const taskUpdate = taskInput.partial().extend({ concluida: z.boolean().optional() }).strict().refine(v => Object.keys(v).length > 0, 'Informe ao menos um campo');
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, handler: async (req, res, next) => {
  try { await audit('ACESSO_INDEVIDO', 'Limite de autenticação excedido'); res.status(429).json({ erro: 'Muitas tentativas. Aguarde 15 minutos.' }); } catch (e) { next(e); }
} }));
app.post('/api/auth/register', async (req, res) => {
  const data = credentials.extend({ nome: z.string().trim().min(2).max(100) }).strict().parse(req.body);
  data.senha = await bcrypt.hash(data.senha, 12);
  const usuario = await db.usuario.create({ data, select: publicUser });
  res.status(201).json({ usuario, token: tokenFor(usuario) });
});
const dummyHash = await bcrypt.hash('dummy-password-for-timing', 12);
app.post('/api/auth/login', async (req, res) => {
  const data = credentials.strict().parse(req.body);
  const usuario = await db.usuario.findUnique({ where: { email: data.email } });
  const valid = await bcrypt.compare(data.senha, usuario?.senha ?? dummyHash);
  if (!usuario || !valid) {
    await audit('ACESSO_INDEVIDO', 'Credenciais de login inválidas');
    return res.status(401).json({ erro: 'Email ou senha inválidos' });
  }
  res.json({ usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }, token: tokenFor(usuario) });
});
app.use('/api', async (req, res, next) => {
  try {
    const header = req.get('Authorization') ?? '';
    if (!header.startsWith('Bearer ')) throw new Error('Missing token');
    req.token = header.slice(7);
    const payload = jwt.verify(req.token, JWT_SECRET, { algorithms: ['HS256'], issuer: 'todo-api', audience: 'todo-app' });
    req.usuarioId = Number(payload.sub);
    ownerFilter(req.usuarioId);
    if (!await db.usuario.findUnique({ where: { id: req.usuarioId }, select: { id: true } })) throw new Error('Missing user');
  } catch (error) {
    if (error.code?.startsWith('P')) return next(error);
    await audit('ACESSO_INDEVIDO', 'Token ausente, inválido ou expirado');
    return res.status(401).json({ erro: 'Faça login para continuar' });
  }
  next();
});
app.get('/api/auth/me', async (req, res) => res.json(await db.usuario.findUnique({ where: { id: req.usuarioId }, select: publicUser })));
app.get('/api/todos', async (req, res) => res.json({ data: await db.tarefa.findMany({ where: ownerFilter(req.usuarioId), orderBy: { id: 'desc' } }) }));
app.post('/api/todos', async (req, res) => {
  const input = taskInput.parse(req.body);
  const tarefa = await db.$transaction(async tx => {
    const task = await tx.tarefa.create({ data: { ...input, usuarioId: req.usuarioId } });
    await audit('CRIACAO', `Tarefa ${task.id} criada`, req.usuarioId, tx);
    return task;
  });
  res.status(201).json({ data: tarefa });
});
app.use('/api/todos/:id', (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ erro: 'ID inválido' });
  req.taskId = id; next();
});
async function missing(req, res) {
  await audit('ACESSO_INDEVIDO', `Tentativa de acessar tarefa indisponível ${req.taskId}`, req.usuarioId);
  return res.status(404).json({ erro: 'Tarefa não encontrada' });
}
app.get('/api/todos/:id', async (req, res) => {
  const task = await db.tarefa.findFirst({ where: ownerFilter(req.usuarioId, req.taskId) });
  return task ? res.json({ data: task }) : missing(req, res);
});
app.put('/api/todos/:id', async (req, res) => {
  const data = taskUpdate.parse(req.body);
  const task = await db.$transaction(async tx => {
    const changed = await tx.tarefa.updateMany({ where: ownerFilter(req.usuarioId, req.taskId), data });
    if (!changed.count) return null;
    await audit(data.concluida === true ? 'CONCLUSAO' : 'ALTERACAO', `Tarefa ${req.taskId} alterada`, req.usuarioId, tx);
    return tx.tarefa.findFirst({ where: ownerFilter(req.usuarioId, req.taskId) });
  });
  return task ? res.json({ data: task }) : missing(req, res);
});
app.delete('/api/todos/:id', async (req, res) => {
  const count = await db.$transaction(async tx => {
    const result = await tx.tarefa.deleteMany({ where: ownerFilter(req.usuarioId, req.taskId) });
    if (result.count) await audit('EXCLUSAO', `Tarefa ${req.taskId} excluída`, req.usuarioId, tx);
    return result.count;
  });
  return count ? res.status(204).end() : missing(req, res);
});
app.get('/api/stats', async (req, res) => {
  try {
    const response = await fetch(`${ANALYZER_URL}/api/stats`, { headers: { Authorization: `Bearer ${req.token}`, 'X-Service-Token': SERVICE_TOKEN }, signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Analyzer unavailable');
    res.json(await response.json());
  } catch {
    await audit('ERRO', 'Falha na consulta ao analisador', req.usuarioId);
    res.status(503).json({ erro: 'Estatísticas temporariamente indisponíveis' });
  }
});
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));
app.use(express.static(process.env.PUBLIC_DIR || 'public'));
app.use(async (error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof z.ZodError) return res.status(400).json({ erro: 'Dados inválidos', campos: error.issues.map(i => ({ campo: i.path.join('.'), mensagem: i.message })) });
  if (error.code === 'P2002') return res.status(409).json({ erro: 'Email já cadastrado' });
  if (error.type === 'entity.parse.failed' || error.type === 'entity.too.large') return res.status(error.status).json({ erro: 'JSON inválido ou muito grande' });
  console.error('Request failure', error.name, error.code ?? '');
  try { await audit('ERRO', `Falha interna em ${req.method}`, req.usuarioId); } catch { console.error('Audit persistence unavailable'); }
  res.status(500).json({ erro: 'Erro interno do servidor' });
});
let sending = false;
async function flushEvents() {
  if (sending) return;
  sending = true;
  try {
    const events = await db.evento.findMany({ where: { enviado: false }, orderBy: { timestamp: 'asc' }, take: 50 });
    for (const { enviado, ...event } of events) {
      const response = await fetch(`${LOGS_URL}/api/logs`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Service-Token': SERVICE_TOKEN }, body: JSON.stringify(event), signal: AbortSignal.timeout(5000) });
      if (!response.ok) throw new Error('Log delivery failed');
      await db.evento.update({ where: { id: event.id }, data: { enviado: true } });
    }
  } catch { console.error('Logs pending; retrying automatically'); }
  finally { sending = false; }
}
setInterval(flushEvents, 2000).unref();
app.listen(3001, process.env.BIND_HOST || '0.0.0.0', () => console.log('TODO disponível em http://localhost:3001'));
