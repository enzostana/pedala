# Scrum individual com Kanban

## Transparência

Uma pessoa acumula responsabilidades de priorização, implementação e validação. Não existe equipe Scrum completa, daily em grupo ou revisão por terceiro. Este documento registra uma adaptação acadêmica, sem simular participantes ou reuniões. A implementação inicial foi assistida por agente; os commits não representam duas semanas de trabalho já realizadas.

## Plano de duas sprints

Sprint 1 (dias úteis 1–5): objetivo de entregar o ciclo completo de aluguel persistente; itens de estações, sessão, retirada, devolução e regras de concorrência.

Sprint 2 (dias úteis 6–10): objetivo de tornar a experiência apresentável; landing page, mapa, QR, guia, acessibilidade, publicação e roteiro. Datas de calendário serão preenchidas pelo aluno conforme o início efetivo do trabalho.

No início de cada sprint: selecionar Issues, estimar e registrar objetivo. Diariamente: registrar resultado, próximo passo e impedimentos em comentário da Issue. Limite de uma tarefa em andamento. Ao concluir: anexar evidência do comportamento e mover para validação.

Definition of Ready: história clara, critério de aceite verificável e dependências identificadas.

Definition of Done: comportamento implementado, verificações relevantes aprovadas, documentação atualizada, código no GitHub e, para funcionalidades públicas, deploy validado. Validação em hardware físico deve ficar pendente até realmente realizada.

## Evidências da implementação inicial

- Entregue fluxo completo com banco e cenários isolados.
- Testes automatizados verificam concorrência, capacidade, idempotência e propriedade da viagem.
- Hospedagem publicada com Docker Swarm e túnel dedicado. Backup restaurado em banco separado.
- Teste de navegador detectou reinício indevido da demo ao recarregar; a correção preserva a viagem ativa e restringe reinício ao botão explícito.
- Desvio arquitetural: SQL parametrizado via pg substitui Prisma para reduzir camadas nesta implementação; modelo e integridade permanecem no PostgreSQL.
- Impedimento de ferramenta: token GitHub disponível não possui os escopos `project`/`read:project`; GitHub Projects não foi criado. Issues e quadro em Markdown permitem acompanhar até habilitar a permissão.

## Revisão e retrospectiva a preencher pelo aluno

Revisão de sprint: data real, incremento demonstrado, critérios aprovados, feedback recebido e ajustes no backlog.

Retrospectiva: o que ajudou, o que dificultou e uma ação mensurável para a próxima sprint. Não preencher antecipadamente como se tivesse acontecido.
