# Moonlight DevOps

Infraestrutura da loja Moonlight em containers: banco, API, frontend e um Nginx como única porta de entrada, tudo em HTTPS local (`https://moonlight.local`).

Este repositório **não contém regra de negócio nem schema de banco**. O código vive nos repositórios de backend e frontend (copiados aqui em `Moonlight_Backend/` e `Moonlight_Frontend_React/`), e o schema vive nas migrations do backend.

---

## Subindo o ambiente

1. **Variáveis:** copie `.example.env` para `.env` e preencha.
2. **Host local:** adicione `127.0.0.1 moonlight.local` ao arquivo de hosts do sistema.
3. **Certificados:** os arquivos `nginx/certs/moonlight.local.pem` e `moonlight.local-key.pem` precisam existir. Se não existirem:
   ```bash
   mkcert -install
   mkcert -cert-file nginx/certs/moonlight.local.pem -key-file nginx/certs/moonlight.local-key.pem moonlight.local
   ```
4. **Subir:**
   ```bash
   docker compose up -d --build
   ```
5. **Acessar:** https://moonlight.local

Para carregar dados de exemplo (jogos, categorias e o usuário admin de teste), coloque `RUN_SEED=true` no `.env` antes do passo 4. **Nunca em produção.**

---

## Como as peças se conectam

```mermaid
flowchart LR
    U["Navegador"] -->|"HTTPS 443"| N["nginx"]
    N -->|"/"| F["frontend"]
    N -->|"/api/ e /uploads/"| B["backend"]
    B --> D[("MySQL")]
    B --- V[("volume de uploads")]
    M["migrate (roda e sai)"] -.->|"migrations + seed"| D
```

| Serviço | Container | Função | Exposto ao host |
| :-- | :-- | :-- | :-: |
| `nginx` | `nginx_service` | Proxy reverso, HTTPS e cabeçalhos de segurança | 80, 443 |
| `frontend` | `frontend_service` | Interface React | não |
| `backend` | `backend_service` | API (porta 3000 só na rede interna) | não |
| `database` | — | MySQL 8 | não |
| `migrate` | `migrate_service` | Aplica migrations (e seed, se pedido) e termina | não |

**Ordem de inicialização:** `database` fica saudável (healthcheck) → `migrate` roda e termina com sucesso → `backend` sobe → `frontend` e `nginx`.

---

## Banco de dados

O schema **pertence ao backend**. O banco nasce vazio e o serviço `migrate` aplica os arquivos de `database/migrations/` do backend, em ordem, a cada `docker compose up`. É seguro repetir: só roda o que ainda não foi aplicado.

- **Seed de exemplo:** só roda com `RUN_SEED=true`, e é idempotente.
- **Resetar tudo:** `docker compose down -v` apaga o banco **e os uploads**; depois `docker compose up -d --build`.
- **Conferir o que foi aplicado:** `SELECT * FROM schema_migrations;`
- **Acessar pelo DBeaver ou outro cliente:** o banco não é publicado por padrão. Crie um `docker-compose.override.yml` (opcional, só para desenvolvimento):
  ```yaml
  services:
    database:
      ports:
        - "3306:3306"
  ```

---

## Nginx

| Caminho | Destino |
| :-- | :-- |
| `http://moonlight.local` | redireciona para HTTPS |
| `/` | frontend |
| `/api/` | backend |
| `/uploads/` | backend (imagens enviadas) |

- O limite de upload no Nginx (`client_max_body_size 6m`) fica acima do limite da API (5 MB).
- Cabeçalhos aplicados: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`, `Strict-Transport-Security`. A configuração completa está em `nginx/nginx.conf`.

---

## Redes e volumes

| Nome | Tipo | Quem usa | Para quê |
| :-- | :-- | :-- | :-- |
| `proxy_network` | rede | nginx, frontend, backend | tráfego de entrada |
| `db_network` | rede | backend, migrate, database | só quem precisa falar com o banco |
| `db-data` | volume | database | dados do MySQL |
| `uploads-data` | volume | backend | imagens enviadas pelos usuários |

---

## Variáveis de ambiente

| Variável | Usada por | Para quê |
| :-- | :-- | :-- |
| `DB_ROOT_PASSWORD` | database | senha root do MySQL |
| `DB_DATABASE_NAME` | database, backend, migrate | nome do banco |
| `DB_USER`, `DB_PASSWORD` | database, backend, migrate | credenciais da aplicação |
| `JWT_SECRET` | backend | assinatura dos tokens de login |
| `MERCADOPAGO_ACCESS_TOKEN` | backend | API do Mercado Pago |
| `NGROK_URL` | backend | URL pública para webhook e retorno do pagamento |
| `RUN_SEED` | migrate | `true` carrega dados de exemplo (padrão `false`) |
| `VITE_API_URL` | frontend (build) | endereço da API, **sem barra no final** |
| `VITE_USE_MOCK` | frontend (build) | `true` usa serviços falsos |
| `VITE_MP_PUBLIC_KEY` | frontend (build) | chave pública do Mercado Pago |

As variáveis `VITE_*` são embutidas no build: mudar uma delas exige `docker compose up -d --build`.

---

## Aliases de import (backend)

O backend usa apelidos de import em vez de caminhos relativos longos (`../../../`):

| Alias | Aponta para | Conteúdo |
| :-- | :-- | :-- |
| `@shared/*` | `src/shared/*` | config de banco e upload, erros, middlewares de erro/upload, query builder, tipos comuns |
| `@modules/*` | `src/modules/*` | módulos de domínio (em migração) |

```ts
import { AppError } from "@shared/errors/AppError.js";
```

**Regra do projeto (ESM com `NodeNext`):** o import termina sempre em `.js`, igual aos relativos. Para uma pasta, use `/index.js` (ex.: `@modules/order/index.js`). O Node não completa extensão nem `index` sozinho.

### Quem resolve o import

Um alias é só um apelido, e cada ferramenta resolve os imports **por conta própria**. Por isso ele é configurado em mais de um lugar:

| Ferramenta | Quando age | Onde o alias é configurado | Sem isso |
| :-- | :-- | :-- | :-- |
| TypeScript (`tsc`, editor) | checar tipos e compilar | `paths` no `tsconfig.json` | erro `TS2307: Cannot find module` |
| Jest | rodar os testes | `moduleNameMapper` no `jest.config.*` | testes falham com `Cannot find module` |
| `tsx` | `npm run dev` | nada: lê os `paths` do tsconfig | n/a |
| `tsc-alias` | depois do `tsc`, no build | script `build` do `package.json` | o `dist` mantém `@shared/...` e o Node cai com `ERR_MODULE_NOT_FOUND` |

O `tsc` valida o alias, mas **não o reescreve** na saída. É o `tsc-alias` que troca `@shared/...` por caminho relativo dentro do `dist`.

### Build

```
npm run build  →  tsc -p tsconfig.build.json && tsc-alias -p tsconfig.build.json
```

- `tsconfig.build.json` herda do `tsconfig.json`, mas **exclui os testes** (`src/__test__`, `src/**/*.test.ts`). O editor e o `npx tsc --noEmit` continuam checando os testes, mas eles não entram no `dist` nem na imagem.
- No Dockerfile, o estágio `builder` roda `npm run build` (o `npm ci` instala as devDependencies, incluindo o `tsc-alias`). O estágio final copia só o `dist` já reescrito e instala com `--omit=dev`, então produção roda `node dist/servers/server.js` sem depender de nada extra.
- O `tsconfig.json` **não usa `baseUrl`**: ele está deprecado no TypeScript 6. Os `paths` são relativos ao próprio arquivo (`./src/shared/*`).
- `tools/` (`migrate` e `seed`) fica fora do tsconfig e usa **caminhos relativos**, não alias.

### Verificar

```bash
npm run build && grep -rn "@shared" dist --include="*.js"   # não deve imprimir nada
node dist/servers/server.js                                  # deve subir sem ERR_MODULE_NOT_FOUND
```

### Criando um alias novo

1. `tsconfig.json`: adicione a entrada em `paths`.
2. `jest.config.*`: adicione **duas** regras no `moduleNameMapper`, a que termina em `\\.js$` **antes** da genérica (o Jest usa a primeira que casar).
3. `tsx` e `tsc-alias` leem o tsconfig sozinhos: nada a fazer.

___

## Qualidade

**Local (Husky)**
- `commit-msg`: exige o formato `tipo(escopo opcional): descrição`, com tipo em `feat`, `fix`, `chore`, `docs`, `refactor`, `test` ou `hotfix`.
- `pre-push`: exige os containers rodando e executa `npm run test:e2e`. Se falhar, o push é bloqueado.
- `prepare-commit-msg`: lê a chave do Jira no nome da branch (ex.: `feature/MOON-10-...`) e acrescenta `Refs: MOON-10` no rodapé do commit. Fluxo de branches: `feature/*` → PR para `develop` → `main`.

**CI (GitHub Actions, `.github/workflows/playwright.yml`)**
Roda em push e pull request para `main` e `develop`, e manualmente. O fluxo: monta o `.env` a partir dos secrets, gera os certificados com mkcert, sobe o Compose (com `RUN_SEED=true`), espera o HTTPS responder e roda o Playwright. O relatório fica salvo como artefato por 30 dias.

Os testes e2e (`tests/e2e/`) cobrem login, cadastro e o CRUD administrativo de jogos e categorias.

---

## Comandos úteis

| Objetivo | Comando |
| :-- | :-- |
| Subir (reconstruindo imagens) | `docker compose up -d --build` |
| Derrubar | `docker compose down` |
| Derrubar apagando dados | `docker compose down -v` |
| Logs de um serviço | `docker compose logs -f backend` |
| Ver se as migrations rodaram | `docker compose logs migrate` |
| Testes e2e | `npm run test:e2e` |

---

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
| :-- | :-- | :-- |
| Backend não sobe | `migrate` falhou | `docker compose logs migrate` |
| Erro de coluna ou tabela inexistente | volume com schema antigo | `docker compose down -v` e subir de novo |
| Upload responde 413 | limite do Nginx | conferir `client_max_body_size` |
| Imagem enviada abre a página do frontend | falta o `location /uploads/` | conferir `nginx.conf` |
| Imagens somem após rebuild | volume de uploads ausente | conferir `uploads-data` no backend |
| Navegador desconfia do certificado | mkcert não instalado | `mkcert -install` e gerar os certificados de novo |
| `moonlight.local` não abre | host não configurado | conferir o arquivo de hosts |
| Mudei `VITE_*` e nada mudou | variáveis entram no build | subir com `--build` |
| `Cannot find module '@shared/...'` nos testes | alias ausente ou fora de ordem no `moduleNameMapper` | a regra com `.js` vem antes da genérica |
| Backend cai no boot com `ERR_MODULE_NOT_FOUND` e `@shared` | o `tsc-alias` não rodou no build | conferir o script `build` e `grep -rn "@shared" dist` |
| `TS5101` sobre `baseUrl` | `baseUrl` no tsconfig (deprecado no TS 6) | remover e usar `paths` relativos ao tsconfig |

---

## Decisões de arquitetura

| Decisão | Motivo |
| :-- | :-- |
| Nginx como única entrada | centraliza HTTPS, roteamento e cabeçalhos; nenhum outro serviço é publicado |
| Duas redes separadas | só o backend e o migrate enxergam o banco |
| Schema fica no backend; o DevOps só executa | uma fonte de verdade; evita cópia de SQL desatualizada |
| Migrations por serviço `migrate`, não por init do MySQL | o init do MySQL só roda com volume vazio e nunca aplicaria migrations novas |
| Seed opcional (`RUN_SEED`) | dado de exemplo e credencial de teste só existem em dev e na CI |
| Banco publicado só via override | mantém o Compose principal próximo de produção |
| Aliases `@shared` e `@modules` | evitam `../../../` e permitem mover módulos sem reescrever imports; base da modularização do backend |
| `tsc-alias` no build, sem bundler | o `tsc` fica simples e produção roda `node dist` sem dependências extras |
| `tsconfig.build.json` separado | testes continuam checados no editor, mas não vão para o `dist` nem para a imagem |
| `tools/` com imports relativos | a pasta está fora do tsconfig e roda por `tsx` sem depender de `paths` |
