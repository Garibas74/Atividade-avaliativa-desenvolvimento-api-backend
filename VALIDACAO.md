# Validação final

Data: 21/10/2026.

## Ambiente instalado e em execução

- JavaScript/Express + Prisma 6.19.3.
- PostgreSQL 16.15 local, porta 55432, autenticação SCRAM.
- PHP 8.3.36 + Eloquent 12.70.1, persistindo logs em SQLite.
- Python/FastAPI + SQLAlchemy 2.0.41, consultando o PostgreSQL real.
- Serviços vinculados exclusivamente a localhost.

PHP, Composer e PostgreSQL foram baixados de fontes oficiais. Dependências Node, PHP e Python foram instaladas. O arquivo `composer.lock` foi incluído, e o Dockerfile PHP passou a utilizá-lo. Os scripts `start-local.ps1` e `stop-local.ps1` foram testados, inclusive parada e reinício com dados preservados.

## Testes aprovados

1. Schema Prisma validado e cliente gerado para PostgreSQL; schema aplicado ao banco real sem SQL manual.
2. Sintaxe de JavaScript e PHP validada.
3. Dois testes Node para filtros de proprietário e rejeição de identificadores inválidos.
4. Quatro testes FastAPI/SQLAlchemy: isolamento, query com proprietário forjado, usuário sem tarefas, ausência de segredo de serviço, token expirado e assinatura inválida.
5. `tests/integration.mjs` executado com os três serviços reais: cadastro, email duplicado, login válido/inválido, rotas protegidas, CRUD, conclusão, validação dos campos, bloqueio de leitura/alteração/exclusão de outro usuário e contagens independentes.
6. `tests/log-delivery-local.ps1` aprovado: logger interrompido, criação de tarefa bem-sucedida, evento pendente no PostgreSQL, reinício do PHP, entrega automática e persistência confirmada por consulta Eloquent. Reenvio do mesmo UUID não duplicou o registro. Chamada sem credencial interna retornou 401.
7. Logs reais de criação, conclusão, exclusão, tentativas indevidas e erro de integração observados via Eloquent. O erro de integração foi produzido durante a correção da instalação Python e ficou registrado.
8. Validação pelo navegador: cadastro, acesso autenticado, criação de tarefa com descrição, conclusão e contadores (total 1, concluídas 1, pendentes 0). Recarregamento após reiniciar os serviços preservou a tarefa.
9. Estrutura YAML do Compose validada.

Evidência da interface: `docs/validacao-interface.png`.

## Limite da validação

A execução completa foi validada diretamente no Windows. Docker/WSL não foram instalados e o build dos containers não foi executado; a configuração Docker continua disponível como alternativa de implantação. A instalação local não depende de Docker.

Contas e eventos de teste foram mantidos para auditoria. A conta visual é fictícia. Para usar a aplicação, crie sua própria conta na interface.

## Reproduzir

Com a instalação local iniciada:

```powershell
node tests/integration.mjs
powershell -ExecutionPolicy Bypass -File tests/log-delivery-local.ps1
.tools/php/php.exe services/logs/inspect.php
```

Para testes do analisador em outro ambiente Python, instale `services/analyzer/requirements-test.txt` e execute `python -m unittest discover -s services/analyzer -p test_app.py -v`.
