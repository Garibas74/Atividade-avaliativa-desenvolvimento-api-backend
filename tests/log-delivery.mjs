// Executado por log-delivery-local.ps1, com o logger original temporariamente parado.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(new URL('../services/api/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const root = process.cwd();
process.env.DATABASE_URL = `postgresql://todo:${process.env.POSTGRES_PASSWORD}@127.0.0.1:55432/todo`;
const db = new PrismaClient();
const php = path.join(root, '.tools/php/php.exe');
const logDir = path.join(root, 'services/logs');
let logger;
try {
  const register = await fetch('http://127.0.0.1:3001/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: 'Teste recuperação', email: `recovery-${crypto.randomUUID()}@example.com`, senha: 'Teste-recuperacao-123' }) });
  assert.equal(register.status, 201);
  const { token, usuario } = await register.json();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const response = await fetch('http://127.0.0.1:3001/api/todos', { method: 'POST', headers, body: JSON.stringify({ titulo: 'Teste de recuperação de logs' }) });
  assert.equal(response.status, 201);
  const { data: task } = await response.json();
  await new Promise(resolve => setTimeout(resolve, 2500));
  const event = await db.evento.findFirstOrThrow({ where: { usuarioId: usuario.id, acao: 'CRIACAO' } });
  assert.equal(event.enviado, false, 'O evento precisa permanecer pendente com o logger offline');
  logger = spawn(php, ['-S', '127.0.0.1:8000', 'router.php'], { cwd: logDir, env: process.env, windowsHide: true, stdio: 'ignore' });
  let delivered = false;
  for (let i = 0; i < 40; i++) {
    await new Promise(resolve => setTimeout(resolve, 250));
    const current = await db.evento.findUniqueOrThrow({ where: { id: event.id } });
    if (current.enviado) { delivered = true; break; }
  }
  assert.ok(delivered, 'O evento deve ser entregue após o reinício');
  const count = () => Number(execFileSync(php, ['-r', 'require "bootstrap.php"; echo AuditLog::where("id", $argv[1])->count();', event.id], { cwd: logDir, encoding: 'utf8' }));
  assert.equal(count(), 1, 'Eloquent precisa persistir o evento');
  const { enviado, ...payload } = event;
  const duplicate = await fetch('http://127.0.0.1:8000/api/logs', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Service-Token': process.env.SERVICE_TOKEN }, body: JSON.stringify(payload) });
  assert.equal(duplicate.status, 200);
  assert.equal(count(), 1, 'Reenvio não deve duplicar o registro');
  assert.equal((await fetch('http://127.0.0.1:8000/api/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).status, 401);
  assert.equal((await fetch(`http://127.0.0.1:3001/api/todos/${task.id}`, { method: 'DELETE', headers })).status, 204);
  console.log('OK: evento persistente durante interrupção, reenvio automático, persistência Eloquent, deduplicação e bloqueio sem credencial interna.');
} finally {
  logger?.kill();
  await db.$disconnect();
}
