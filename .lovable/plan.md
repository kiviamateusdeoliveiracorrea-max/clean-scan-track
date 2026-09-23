# Multiunidade — Diagnóstico e Plano de Migração

## 1. Diagnóstico inicial (levantado agora no banco)

Checkpoint: cada alteração gera uma versão restaurável no histórico do projeto; a versão atual (antes de qualquer mudança) fica como ponto de retorno.

Tabelas existentes e vínculo com unidade:

| Tabela | Registros | unit_id | area_id | Sem área | Como a unidade será determinada |
|---|---|---|---|---|---|
| areas | 13 | não | — | — | receberá unit_id direto |
| auditorias | 21 | não | sim | 0 | unit_id direto (derivado da área) |
| respostas_auditoria | 0 | não | não | — | indireto via auditoria_id |
| nao_conformidades | 34 | não | sim | 0 | unit_id direto (derivado da área/auditoria) |
| nc_historico | 68 | não | não | — | indireto via nc_id |
| melhorias | 0 | não | sim | 0 | unit_id direto |
| gemba_visitas | 0 | não | sim | 0 | unit_id direto |
| alertas_processo | 0 | não | sim | 0 | unit_id direto |
| auditorias_log | 8 | não | sim (texto) | — | unit_id direto (log imutável) |
| auditores | 8 | não | não | — | unit_id direto |
| perguntas_auditoria | 7 | não | area_nome (texto) | — | modelo global + cópia por unidade |
| profiles | 23 | não | sim | 4 | permissão via user_unit_permissions |
| user_roles | 14 | não | não | — | vira papel global; papel local vai para user_unit_permissions |
| admin_logs | 15 | não | não | — | unit_id opcional (ação global = nulo) |

- Não existe tabela `units`, nem `user_unit_permissions`, nem `user_area_permissions` (será criada).
- Tabelas citadas no pedido que **não existem** no app (inspections, checklists, schedules, reports, notifications, import_batches/rows, approvals, evidences, treatments): não serão criadas vazias. Aprovações, tratativas e evidências já vivem dentro de `nao_conformidades` (campos de aprovação, `foto_urls`, `documento_urls`) e herdam o unit_id dela.
- Registros sem unidade: 100% (nenhuma tabela possui unit_id). Registros sem área identificável: 0 em auditorias/NC; 4 perfis sem área (ficam só com a unidade, pendentes de validação).
- RLS atual: todas as tabelas operacionais leem com "qualquer usuário autenticado" e escrevem por papel global (`has_role`). Armazenamento `audit-photos` é privado mas qualquer autenticado lê/grava qualquer arquivo. Não há isolamento por unidade hoje.

## 2. Pergunta antes de executar

Preciso do nome/código reais da unidade atual (ex.: "Cummins – Motores", código "MOT", cidade/UF). Não inventarei esses dados.

## 3. Plano (executado em fases, cada uma testada antes da próxima)

**Fase 1 — Estrutura (sem mudar comportamento)**
- Criar `units` com os campos pedidos e inserir somente a unidade atual.
- `areas`: adicionar unit_id, codigo, ativo; único (unit_id, codigo).
- Adicionar unit_id em auditorias, nao_conformidades, melhorias, gemba_visitas, alertas_processo, auditores, auditorias_log, admin_logs; preencher todos com a unidade atual; só depois tornar obrigatório. IDs, datas, responsáveis, fotos e vínculos intactos.
- Criar `user_unit_permissions` e `user_area_permissions`; todos os 23 usuários recebem acesso à unidade atual com papel mapeado do atual.
- Novo enum de papéis: ADMIN_GLOBAL, ADMIN_UNIDADE, ANALISTA, LIDER, COORDENADOR, GERENTE, CONSULTOR. Mapeamento proposto: administrador → ADMIN_GLOBAL; gestor → GERENTE; auditor → LIDER; consulta → CONSULTOR. `user_roles` mantido (não apagado) para rollback.
- Tabela `unit_audit_log` (unit_id, usuário, ação, registro, valor anterior/novo, justificativa).
- Índices: unit_id, (unit_id, area_id), (unit_id, status), created_at, user_id — sem duplicar existentes.

**Fase 2 — Segurança no banco**
- Funções: is_global_admin(), user_has_unit_access(unit), user_has_area_access(area), user_has_unit_role(unit, role), is_unit_admin(unit).
- Gatilhos que definem unit_id a partir da área/registro de origem (ignoram valor do navegador) e bloqueiam troca de unit_id.
- Substituir as políticas atuais por SELECT/INSERT/UPDATE/DELETE separadas por unidade e papel; exclusão física bloqueada em auditorias/NC (cancelamento já existente).
- Líder não aprova a própria tratativa (gatilho).
- Evidências: novo caminho `unidades/{unit_id}/...`; política de armazenamento valida unidade pelo caminho + acesso; arquivos antigos continuam acessíveis pela unidade atual; links só assinados temporários.

**Fase 3 — Interface**
- Seletor "Unidade selecionada: X" no cabeçalho (nome fixo se só uma), lembra a última, revalida, limpa cache e filtros na troca e registra no log.
- Todas as consultas filtradas pela unidade selecionada (além da RLS); páginas aguardam unidade definida.
- Página "Unidades" (só ADMIN_GLOBAL): cadastrar, editar, inativar (sem exclusão se houver registros), áreas, admins locais, logo, cores, contagens.
- Usuários e Acessos: gestão de unidades/áreas por usuário; admin local restrito à sua unidade; ninguém se autoatribui.
- Dashboard: local por padrão; visão consolidada explícita para ADMIN_GLOBAL, com unidade identificada.
- Perguntas: modelo global + "copiar para unidade"; respostas preservam o texto/peso usados na data da auditoria.
- Unidade visível em auditorias, NCs, aprovações, usuários, histórico.
- Exportação/importação: hoje não existem no app; ficam fora deste escopo (posso criar depois seguindo as mesmas regras).

**Fase 4 — Testes**
- Criar TESTE - UNIDADE A e B com áreas, usuários, auditorias, NCs e evidências de teste; executar os 15 testes de isolamento aplicáveis (via chamadas reais ao banco com sessão de cada usuário) e a regressão; tabela com usuário, papel, unidade, ação, esperado, obtido, política, APROVADO/REPROVADO. Os testes de exportação/importação/notificações serão marcados "não aplicável" pois o recurso não existe.
- Remover os dados de teste ao final (ou manter, se você preferir).

**Fase 5 — Entrega**
- Relatório com tabelas/colunas/políticas/índices, contagem antes x depois (prova de nenhum registro perdido), permissões por perfil e resultados. Sem publicar.

## Rollback
- Colunas novas são aditivas; `user_roles` e políticas antigas guardadas em script de reversão (recria políticas antigas, remove colunas/tabelas novas). Snapshot das contagens e dos IDs antes da migração. Versão do projeto restaurável pelo histórico.

## Detalhes técnicos
- Mudança de papéis impacta `useCurrentRole`, `users.functions.ts` (assertAdmin, countActiveAdmins, createUser) e todas as páginas com checagens de papel — serão reescritas para papel por unidade.
- Unidade selecionada guardada em localStorage + validada contra `user_unit_permissions`; chave do React Query inclui unit_id e `queryClient.clear()` na troca.
