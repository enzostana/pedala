# PedaLá ↗

Bicicletas compartilhadas em uma simulação acadêmica no Rio de Janeiro. Desenvolvido para demonstrar entrega incremental com Scrum adaptado ao trabalho individual e Kanban.

**Demo:** https://pedala.enzostana.space · **Cartões QR:** https://pedala.enzostana.space/cards

## O que funciona

Landing page, mapa e lista de sete estações fictícias, acesso por visitante, scanner de QR, código manual, retirada confirmada, cronômetro persistente, devolução, histórico e disponibilidade consultada a cada dois segundos. A demo guiada possui cenário privado reiniciável; exploração livre compartilha bikes entre visitantes. Cada cenário começa com 28 bicicletas e 56 vagas, incluindo uma estação cheia e uma vazia.

As bicicletas, travas e devoluções são simuladas. Não há pagamento, rastreamento GPS, cadastro ou administração. Histórico vinculado a cookie por 30 dias; apagar cookies ou mudar de navegador perde o acesso. Os dados continuam no banco. O serviço é acadêmico e não opera bicicletas físicas.

## Arquitetura

Next.js 16 + React + TypeScript; PostgreSQL 16; Leaflet 1.9 + OpenStreetMap; html5-qrcode e qrcode. Backend e interface no mesmo aplicativo, deploy em Docker Swarm com Cloudflare Tunnel dedicado. Banco em volume persistente e segredos via Docker Secrets.

**Ajuste ao plano:** usa `pg` com SQL parametrizado no lugar do Prisma, mantendo transações e índices únicos no banco. A inicialização versionada em `lib/db.ts` cria o esquema de forma idempotente, sob advisory lock. Não há migrações destrutivas automáticas; alterações futuras exigem script de migração e backup prévio.

Entidades: cenários → estações → bicicletas; visitantes → viagens. Retirada e devolução serializam alterações por cenário e bloqueiam a sessão do visitante. Restrições únicas impedem duas viagens ativas por bike ou visitante. A sessão vem de cookie HttpOnly; o servidor determina o cenário e valida a origem das mutações. Repetir retirada ativa da mesma bike ou devolver viagem já encerrada é idempotente.

## Executar localmente

Requisitos: Node.js 22, npm e PostgreSQL 16. Nunca aponte testes para o banco publicado.

```sh
npm ci
cp .env.example .env.local
# Edite DATABASE_URL em .env.local com o banco local.
npm run dev
```

Acesse http://localhost:3000. Dados iniciais são criados automaticamente na primeira chamada à API. Para QR impresso local, ajuste PUBLIC_URL ao endereço HTTPS acessível pelo celular; os cartões são gerados no build.

```sh
DATABASE_URL=postgresql://usuario:senha@localhost:5432/pedala_test npm test
npm run build
npm run typecheck
```

O comando `npm test` TRUNCA os dados do banco informado: use exclusivamente um banco descartável de testes. O CI fornece PostgreSQL isolado. Testes de navegador usam apenas a demo individual do visitante de teste:

```sh
npx playwright install chromium
npx playwright test
```

## API

- `GET /api/state`: estações e até 50 viagens do visitante no cenário atual; cria sessão quando necessário.
- `POST /api/start`: `{ "code": "PDL-001" }`.
- `POST /api/finish`: `{ "trip": 1, "station": 6 }`.
- `POST /api/demo`: `{}` cria ou reinicia somente o cenário desse visitante.
- `POST /api/free`: `{}` volta ao cenário compartilhado, após concluir eventual viagem.
- `GET /api/health`: saúde da aplicação e conexão com o banco.

Mutações usam JSON e Origin do site; erros de negócio retornam 409 com `error`. Não reutilize o cookie de outro visitante.

## Operação e entrega acadêmica

[Implantação, backup e recuperação](docs/operacao.md) · [Backlog e Kanban](docs/backlog.md) · [Planejamento e evidências](docs/processo-agil.md) · [Roteiro da apresentação](docs/apresentacao.md).

Os tiles do mapa dependem do OpenStreetMap e respeitam sua atribuição e cache. A lista continua disponível se o mapa não carregar. Câmera precisa de HTTPS e autorização; digitar o código é sempre uma alternativa. A leitura de cartões impressos em dispositivos físicos deve ser validada antes da apresentação.

## Localização e imagens

O mapa solicita uma posição ao abrir, com timeout de dez segundos, e usa a UVA como referência quando não há localização. A posição permanece em memória no navegador. Distâncias são aproximadas em linha reta. Filtros permitem encontrar bikes ou vagas; Como chegar abre um serviço externo com apenas o destino. Imagens geradas são ilustrações de estações fictícias, sem reprodução fiel das fachadas. A estação 07 é UVA — Rua Ibituruna, 108, com quatro bicicletas iniciais e oito vagas.

A migração versionada acrescenta a UVA aos cenários anteriores sem encerrar viagens nem reposicionar bikes existentes. Repetir a inicialização não duplica a estação ou suas bicicletas.

## HUD de pedalada

A retirada abre o mapa da viagem automaticamente. GPS funciona enquanto o HUD está visível, com cronômetro, minimização e seleção de estação para confirmar devolução. Os endpoints de busca e rota exigem GEOAPIFY_API_KEY no servidor. Sem a chave retornam indisponibilidade; nenhum trajeto é inventado. O desenho de rota está preparado, mas navegação por manobras, recálculo, distância restante e recuperação de destino ainda não estão implementados. Esta entrega é a base do HUD, não a navegação completa planejada.

### Ativar Geoapify com segurança

Após obter a chave da conta Geoapify, salve-a em arquivo privado no servidor (padrão `~/.geoapify-api-key`). Execute `python3 scripts/configure-geoapify.py`. O script ajusta a permissão para 600, valida a chave no provedor antes de alterar serviços, cria um Docker Secret e aplica a stack com `deploy/geoapify.yml`. A chave não é impressa nem enviada em argumentos de processos. O nome do segredo ativo fica em `~/.local/share/pedala/geoapify-secret-name`; preserve o overlay em implantações posteriores para manter a integração habilitada. Segredos de versões anteriores não são removidos automaticamente.
