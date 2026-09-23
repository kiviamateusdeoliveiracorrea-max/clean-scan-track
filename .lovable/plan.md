# Fase 1 — Estrutura multiunidade (somente estrutura)

Nada muda para os usuários nesta fase: as regras de acesso atuais, os papéis atuais e as telas continuam iguais. Nenhuma unidade extra é criada. Sem publicação.

## 1. Validação antes da execução

**Unidade que será criada (única)**

| Nome | Código | Empresa | Cidade | Estado | Status |
|---|---|---|---|---|---|
| Cummins Motores | MOT | Cummins | Guarulhos | SP | ATIVA |

**13 áreas atuais (todas ligadas à Cummins Motores; código fica vazio, pendente de preenchimento pelo admin)**
Almoxarifado (EBU), Ativação (EBU), Blocado, CEM (CEM), CTT (CTT), Embalagem (ADM), Estocagem, Expedição, Oleamento (Expedição), PSBU (PSBU), Qualidade (Qualidade), Recebimento (EBU), Usinagem.

**Usuários: 23 cadastros**
- 14 ativos com papel · 4 inativos sem papel · 5 excluídos (vinculados como inativos, conforme sua escolha).

**Administradores atuais (12)** e papel novo proposto:

| Nome | E-mail | Área | Papel atual | Papel novo | Situação |
|---|---|---|---|---|---|
| Kivia Mateus de Oliveira Correa | as73i@cummins.com | Qualidade | administrador | ADMIN_GLOBAL | VALIDADO |
| Gleisson Nogueira | bc98w@cummins.com | Qualidade | administrador | ADMIN_UNIDADE | PENDENTE_DE_VALIDACAO |
| Lucas N. Santana | ua228@cummins.com | Qualidade | administrador | ADMIN_UNIDADE | PENDENTE_DE_VALIDACAO |
| Jefferson Leandro | ax14n@cummins.com | Almoxarifado | administrador | ADMIN_UNIDADE | PENDENTE_DE_VALIDACAO |
| Jorge M Lima | xf113@cummins.com | Almoxarifado | administrador | ADMIN_UNIDADE | PENDENTE_DE_VALIDACAO |
| Anderson Souza | st541@cummins.com | Embalagem | administrador | ADMIN_UNIDADE | PENDENTE_DE_VALIDACAO |
| Claudete G de Moura | be25a@cummins.com | Recebimento | administrador | ADMIN_UNIDADE | PENDENTE_DE_VALIDACAO |
| Claudio Trindade | kj810@cummins.com | PSBU | administrador | ADMIN_UNIDADE | PENDENTE_DE_VALIDACAO |
| Ícaro Camilo | rz024@cummins.com | Ativação | administrador | ADMIN_UNIDADE | PENDENTE_DE_VALIDACAO |
| Ícaro Vasconcellos | qw887@cummins.com | Ativação | administrador | ADMIN_UNIDADE | PENDENTE_DE_VALIDACAO |
| Leandro Alencar | bd58d@cummins.com | Ativação | administrador | ADMIN_UNIDADE | PENDENTE_DE_VALIDACAO |
| Paulo Roberto | bc50u@cummins.com | CTT | administrador | ADMIN_UNIDADE | PENDENTE_DE_VALIDACAO |

Obs.: vários administradores têm cargo "Líder" — ficam pendentes para decisão (provavelmente LIDER). Nada é alterado no papel atual.

**Gestores atuais (2)**

| Nome | E-mail | Área | Papel novo | Situação |
|---|---|---|---|---|
| Alessandro Ventura | ba93n@cummins.com | Ativação | GERENTE | PENDENTE_DE_VALIDACAO |
| Caroline Clemente | yd669@cummins.com | sem área | GERENTE | PENDENTE_AREA |

**Auditores atuais:** nenhum. **Consulta atuais:** nenhum.

**Sem papel (9) — ficam inativos, papel novo em branco, PENDENTE_DE_VALIDACAO**
Lucas Nunes (Qualidade, inativo), Lucas Santana (Qualidade, inativo), Wesley Ferrarezi (Recebimento, inativo), Test (sem área, inativo), TESTE - SENHA TEMPORARIA (excluído), teste.senhatemp+... (excluído), 3 × "Usuário excluído" (Almoxarifado, Almoxarifado, Recebimento).

**Usuários sem área (4) — PENDENTE_AREA, nenhuma área inventada**
Caroline Clemente, Test, TESTE - SENHA TEMPORARIA, teste.senhatemp+1790120934.

**Registros que serão criados**
- units: 1
- user_unit_permissions: 23 (todos com unidade padrão = Cummins Motores; ativo = situação atual; excluídos inativos)
- user_area_permissions: 19 (somente a área atual de cada um; 4 sem área não recebem)
- unit_audit_log: 1 (criação da unidade) + 1 por vínculo de área/usuário

## 2. O que a migração faz
- Cria `units`, papéis novos (lista separada, não substitui a atual), `user_unit_permissions` (com situação de validação), `user_area_permissions` e `unit_audit_log`.
- `areas`: adiciona unidade (ainda opcional), código, ativo e data de atualização; regra de código único por unidade (códigos vazios permitidos).
- Liga as 13 áreas à Cummins Motores e cria os vínculos acima.
- Novas tabelas com leitura restrita: cada usuário vê só os próprios vínculos; administradores atuais veem tudo; gravação só pelo servidor. Isso não muda o acesso a nenhum dado existente.
- Não toca em: user_roles, regras de acesso atuais, auditorias, NCs, histórico, perfis.

## 3. Testes após execução
1 unidade única · 2 código de unidade duplicado rejeitado · 3 todas as áreas com unidade · 4 código de área repetido na mesma unidade rejeitado · 5 23 vínculos de unidade · 6 os 4 sem área pendentes · 7 nenhuma área extra (cada usuário ≤ 1 área, igual à atual) · 8 user_roles com 14 registros idênticos · 9 login continua · 10 auditorias (21) e NCs (34) acessíveis com mesmas contagens. Mais: comparação das regras de acesso antigas antes/depois (mesma lista).

## 4. Rollback
Script pronto que remove somente o que foi adicionado: apaga as tabelas novas, remove as colunas novas de `areas`, remove a lista de papéis nova e a tabela `units`. Nenhum dado antigo depende delas, então a volta é completa. Versão anterior do projeto também fica restaurável pelo histórico.

## Detalhes técnicos
- Enum `unit_role` (ADMIN_GLOBAL, ADMIN_UNIDADE, ANALISTA, LIDER, COORDENADOR, GERENTE, CONSULTOR); `user_unit_permissions.role` nulável; `validation_status` text (VALIDADO, PENDENTE_DE_VALIDACAO, PENDENTE_AREA) validado por trigger.
- `areas.unit_id` FK nulável, `code` text nulo, `active` bool default true, `updated_at` + trigger `set_updated_at`; `UNIQUE (unit_id, code)`; `areas.created_at` já existe.
- Unique `units.code`; unique `(user_id, unit_id)` e `(user_id, area_id)`; índices em user_id, unit_id, area_id.
- GRANTs para authenticated/service_role; RLS com `has_role(auth.uid(),'administrador')` ou `user_id = auth.uid()` para SELECT; sem INSERT/UPDATE/DELETE para authenticated.
- Dados inseridos na mesma migração (INSERT ... SELECT a partir de profiles/user_roles), com mapeamento nominal acima.
- Após executar: consultas de verificação e relatório; Fase 2 não iniciada.
