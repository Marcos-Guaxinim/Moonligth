# Backend como monólito modular (organização por módulo de domínio)

**Status:** Aceito
**Data:** 2026-11-08

## Contexto
O backend era organizado por **camada técnica**: `controllers/`, `services/`, `repositories/`, `routes/`, `validators/`, `@types/`, `query/` e `__test__/`. Um mesmo domínio (por exemplo, `order`) ficava espalhado por cerca de dez pastas. Isso trazia três problemas:

- **Fronteiras invisíveis:** não dava para enxergar onde um domínio começa e termina.
- **Acoplamento livre:** nada impedia um módulo de importar o repository de outro.
- **Extração cara:** tirar um domínio para virar serviço exigiria caçar arquivos em todas as pastas.

Ao mesmo tempo, o semestre exige **pelo menos dois microsserviços, cada um com banco próprio** (Order Service e Notification Service), sem a necessidade de desmontar o sistema inteiro. O projeto está classificado como Complexo no Cynefin, com requisitos que mudam a cada ciclo, então a mudança precisa ser **incremental**, sem parar as entregas para reescrever tudo. A refatoração é acompanhada na Epic MOON-9.

## Decisão
Organizar o backend como **monólito modular**: cada domínio vive em `src/modules/<domínio>/` com controller, service, repository, rotas, validator, DTOs, testes e um `index.ts` que é a sua API pública. O código transversal fica em `src/shared/`. Continua existindo **um único deploy e um único banco** até a extração dos dois serviços.

```
src/
├── modules/
│   ├── auth/  user/  role/  category/  game/  checkout/  upload/
│   └── order/                  (inclui purchasedItems)
│       ├── order.controller.ts / .service.ts / .repository.ts
│       ├── order.routes.ts / .validator.ts
│       ├── dto/
│       ├── order.test.ts
│       └── index.ts            ← única porta de entrada do módulo
├── shared/                     config, errors, middlewares, query, types
├── container.ts                composição das dependências
└── servers/server.ts
```

Regras que valem para todos os módulos:

1. **Um módulo só importa outro pelo `index.ts`** (`@modules/<módulo>/index.js`), nunca pelo repository ou por arquivos internos.
2. **Dependências entre módulos por interface**, injetadas no `container.ts` (por exemplo, `order` depende de um contrato de catálogo de jogos, não do `GameRepository`).
3. **Eventos preferidos a chamadas diretas** quando um módulo apenas reage a outro (`order.paid`). A mensageria nasce como `EventBus` em memória e passa a Redis Pub/Sub na extração dos serviços.
4. **Testes ao lado do código**, fora do build.
5. **Migração incremental**, um módulo por PR, na ordem: `shared` → `category` (piloto) → `user/role/auth` → `game` → `order/checkout`.

## Alternativas consideradas
- **Manter a organização por camadas.** Descartada: preserva o acoplamento livre e deixa a extração dos serviços cara e arriscada.
- **Microsserviços para todos os domínios.** Descartada: o requisito são dois serviços, e dividir tudo traria custo operacional (deploys, bancos, comunicação) desproporcional ao tamanho da equipe e ao tempo de cada ciclo.
- **Extrair Order e Notification diretamente da estrutura atual.** Descartada: sem fronteiras claras, a extração dependeria de descobrir dependências no meio do corte, o que concentra o risco no pior momento. Modularizar antes torna a extração um recorte.

## Consequências
**Vantagens**
- `order` e as notificações passam a ser extraíveis quase por recorte de pasta.
- Cada domínio tem dono e fronteira explícitos; os testes ficam junto do código.
- O `EventBus` já prepara a comunicação assíncrona (E2) e o cache do catálogo pode entrar como decorator do repository (E3), sem alterar os services.
- Os aliases `@shared` e `@modules` (MOON-10) eliminam os `../../../` e permitem mover módulos sem reescrever imports.

**Trade-offs e dívida assumida**
- Durante a migração a base fica **híbrida** (módulos migrados e camadas antigas coexistindo). É aceito porque o trabalho é feito por módulo, com os testes verdes a cada PR.
- As regras de importação dependem de disciplina até serem **verificadas automaticamente** (ver trabalho em aberto).
- Os módulos seguem compartilhando **um único banco**. As ligações entre tabelas de domínios diferentes (por exemplo, `purchased_items` com chave estrangeira para `game`) não poderão existir quando o Order Service tiver o `orders_db` próprio. Será preciso decidir como o pedido valida e guarda os dados do jogo (consulta via API ou cópia dos dados necessários).

**Trabalho em aberto**
- Regra de lint (`no-restricted-imports`) ou `dependency-cruiser` para barrar imports que furem o `index.ts`.
- Implementar o `EventBus` (em memória e Redis) e o cache do catálogo.
- Extrair `order` e `notifications` para serviços com bancos próprios, e tratar as chaves estrangeiras entre domínios.
- Ao concluir a migração, revisar este ADR. Se alguma regra mudar, criar um novo ADR que o substitua, em vez de editar este.
