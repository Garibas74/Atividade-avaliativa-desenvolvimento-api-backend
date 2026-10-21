# TODO List

Atividade de Desenvolvimento de API Back-end. O sistema permite cadastrar uma conta, fazer login e gerenciar tarefas. Cada usuário só tem acesso às próprias tarefas.

## Tecnologias

- JavaScript com Express e Prisma: usuários, login e tarefas.
- PHP com Eloquent: registro de logs.
- Python com FastAPI e SQLAlchemy: contagem de tarefas.
- PostgreSQL para usuários e tarefas, e SQLite para os logs.

O login usa JWT e as senhas são salvas com hash. Os serviços registram criação e conclusão de tarefas, tentativas de acesso indevido e erros.

## Como executar

Com Docker Desktop instalado, rode os comandos na pasta do projeto pelo PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
docker compose up --build -d
```

O primeiro comando cria o arquivo `.env`. Depois que os serviços iniciarem, acesse http://localhost:3001 e crie uma conta.

Para parar:

```powershell
docker compose down
```

Na instalação local já configurada, também é possível usar `iniciar.cmd` e `parar.cmd`. Essa opção depende dos programas instalados na pasta `.tools`, que não está no repositório.

## Funcionalidades

- Cadastro e login.
- Criar, listar, concluir, reabrir e excluir tarefas.
- Editar título e descrição pela API.
- Consultar o total de tarefas, concluídas e pendentes.
- Registrar logs, com reenvio quando o serviço fica indisponível.

## Testes

Com o sistema rodando e o Node instalado:

```powershell
node tests/integration.mjs
```

O teste verifica login, operações com tarefas e bloqueio de acesso aos dados de outro usuário. Os resultados dos testes estão em [VALIDACAO.md](VALIDACAO.md).

O sistema foi testado diretamente no Windows com os três serviços e PostgreSQL. A configuração Docker está incluída, mas o build dos containers ainda não foi testado.
