# Diagnóstico multiunidade e plano da Fase 2 (nada será alterado sem aprovação)

Levantamento feito agora, só com leitura. Nada foi alterado.

## 1. Tabelas e quantidade de registros

| Tabela | Registros | unit_id | area_id | Registros sem unidade |
|---|---|---|---|---|
| units | 1 | — | — | — |
| areas | 13 | sim | — | 0 |
| user_unit_permissions | 23 | sim | — | 0 |
| user_area_permissions | 19 | sim | sim | 0 |
| unit_audit_log | 43 | sim | — | — |
| auditorias | 21 | não | sim | 21 (0 sem área) |
| nao_conformidades (tratativas, aprovações, evidências) | 34 | não | sim | 34 (0 sem área) |
| nc_historico | 68 | não | não (via NC) | 68 |
| respostas_auditoria | 0 | não | não (via auditoria) | 0 |
| auditorias_log | 8 | não | sim | 8 |
| melhorias | 0 | não | sim | 0 |
| gemba_visitas | 0 | não | sim | 0 |
| alertas_processo | 0 | não | sim | 0 |
| profiles | 23 | não | sim (3 sem área) | via permissões |
| user_roles | 14 | não | não | papel global |
| auditores | 8 | não | não | 8 (cadastro global) |
| perguntas_auditoria | 7 | não | não (área por nome) | 7 (modelo global) |
| admin_logs | 19 | não | não | 19 |
| Arquivos de evidência (armazenamento privado) | 120 | caminho sem unidade | — | 120 |

Todos os registros operacionais têm área, e todas as áreas pertencem à Cummins Motores. Por isso a unidade de cada registro atual é conhecida sem ambiguidade.

## 2. Regras de acesso atuais (RLS)
- **Operacionais** (auditorias, NCs, melhorias, gemba, alertas, áreas, auditores, perguntas, histórico, logs de auditoria): **qualquer usuário logado lê tudo**; criar, alterar e excluir dependem só do papel global (administrador/gestor/auditor). Não existe filtro por unidade nem por área.
- **respostas_auditoria**: administrador/gestor total; auditor só nas próprias; consulta lê.
- **profiles**: leitura por usuário logado (colunas limitadas); edição do próprio perfil ou pelo administrador.
- **user_roles**: usuário lê o próprio; administrador gerencia.
- **Tabelas novas da Fase 1**: usuário vê só os próprios vínculos; administrador vê tudo; ninguém grava pela aplicação.
- **Armazenamento de evidências**: qualquer usuário logado lê, envia, substitui e apaga qualquer arquivo.

## 3. Vínculos atuais
```text
unidade ─< áreas ─< auditorias ─< respostas_auditoria
                 │            └─< nao_conformidades ─< nc_historico
                 ├─< melhorias / gemba_visitas / alertas_processo
usuário ─ profiles.area_id (1 área) + user_roles (papel global)
        └─ user_unit_permissions / user_area_permissions (Fase 1, ainda sem efeito)
Tratativa, aprovação e evidências = colunas dentro de nao_conformidades
Evidências = listas de caminhos de arquivo, sem autor, data ou versão
```

## 4. Riscos da migração
1. **Bloqueio de acesso**: ao trocar as regras, usuários sem vínculo válido (3 sem área, 11 administradores pendentes de validação) podem perder acesso. Mitigação: regras novas aceitam temporariamente o papel antigo até a validação.
2. **Dados globais x locais**: auditores, perguntas e logs não têm área; decidir se viram globais ou da unidade.
3. **Evidências**: 120 arquivos sem unidade no caminho; mover arquivos quebraria links. Mitigação: não mover; controlar acesso pelo registro dono do arquivo.
4. **Lentidão**: regras com verificação de vínculo em cada linha. Mitigação: índices e funções auxiliares.
5. **Funções do servidor com acesso privilegiado** (usuários, senhas) ignoram as regras; precisam validar unidade no código.
6. **Telas**: consultas atuais não filtram unidade; com as regras novas, podem mostrar listas vazias se a unidade não for selecionada.

## 5. Plano proposto (Fase 2 — só após sua aprovação)
1. Criar funções de verificação: acesso à unidade, acesso à área, papel na unidade, administrador global, administrador da unidade.
2. Adicionar unidade (opcional no início) em auditorias, NCs, melhorias, gemba, alertas e logs; preencher a partir da área; histórico e respostas herdam do registro pai (documentado, sem coluna nova).
3. Gatilho que define a unidade pela área em cada novo registro e impede trocar a unidade depois.
4. Índices por unidade, unidade+área e unidade+status.
5. Novas regras de acesso lado a lado com as antigas, em modo de convivência; conferir contagens por usuário; só depois remover as antigas.
6. Regras de acesso às evidências baseadas no registro dono do arquivo.
7. Só então tornar a unidade obrigatória.

Nenhuma unidade de teste é criada nem papel alterado sem sua confirmação.

## 6. Rollback
- Antes: salvar contagens por tabela e a lista completa das regras de acesso atuais.
- Reversão em ordem: recriar as regras antigas salvas; remover regras novas; remover gatilhos, índices e funções novas; remover as colunas de unidade adicionadas (os dados originais não dependem delas).
- Nada é apagado nem tem ID alterado; os arquivos não são movidos. A versão anterior do projeto também pode ser restaurada pelo histórico.

## Detalhes técnicos
- Funções `security definer` com `search_path=public` lendo `user_unit_permissions`/`user_area_permissions` com fallback `app_private.has_role`.
- `unit_id uuid references units` nulável → backfill `update ... from areas` → `NOT NULL` só depois de 0 nulos.
- Trigger BEFORE INSERT/UPDATE: `new.unit_id := (select unit_id from areas where id = new.area_id)`; bloqueia mudança em UPDATE.
- Storage: policies em `storage.objects` via join do caminho com `foto_urls`/`documento_urls`.
- Sem publicação automática.
