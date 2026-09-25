# Fase 2B — Isolamento por unidade e área

Nenhuma regra antiga é removida nesta etapa. O isolamento é aplicado por regras adicionais "obrigatórias" que se somam às atuais: o acesso só é liberado se a regra antiga (papel) **e** a nova (unidade/área) permitirem. Remover as antigas fica para depois dos resultados.

## Situação dos usuários hoje (MOT)
- 16 vínculos ativos e validados, todos com área: 1 ADMIN_GLOBAL, 3 ADMIN_UNIDADE, 10 LIDER, 1 COORDENADOR, 1 GERENTE.
- 10 vínculos inativos/pendentes (contas inativas): perdem acesso aos dados — hoje já não conseguem entrar.
- Fallback controlado: 8 LIDERs ainda têm o papel antigo "administrador", por isso continuam vendo todas as áreas da MOT até o fallback ser retirado. Isso será listado nos resultados como impacto.

## O que será feito
1. **Regras por unidade e área** (leitura, criação, edição, exclusão) em: áreas, auditorias, NCs (tratativa e aprovação incluídas), histórico de NC, respostas, log de auditorias, melhorias, gemba, alertas.
2. **Logs administrativos**: admin_logs e unit_audit_log visíveis só para admins da mesma unidade (global vê tudo).
3. **Unidades**: cada usuário só vê as unidades onde tem vínculo ativo.
4. **Troca manual de unidade / área de outra unidade**: já bloqueada pelo gatilho da 2A; será incluída nos testes.
5. **Evidências (armazenamento)**: novos arquivos passam a ser gravados como `{unidade}/{registro}/arquivo`. Leitura/envio/exclusão só se o usuário tem acesso à unidade/área do registro dono do arquivo. Os 120 arquivos antigos não são movidos: o acesso deles é decidido pelo registro ao qual estão vinculados; os 11 órfãos ficam visíveis só para admins.
6. **Tentativas bloqueadas**: registro em `unit_audit_log` (ação ACESSO_NEGADO) quando o servidor recusa uma operação entre unidades, e quando uma gravação é recusada pelo banco (via gatilho de verificação nas tabelas principais).
7. **Telas**: seletor de unidade no topo quando o usuário tiver mais de uma; consultas passam a filtrar pela unidade ativa.

## Testes (somente unidades de teste)
- Criar **TST-A** e **TST-B** (marcadas como teste, uma área cada) e 4 contas de teste temporárias: Líder A, Gestor/Gerente B, Admin de unidade A, Consultor B. Nada nas unidades ou contas reais.
- Executar os 10 cenários pedidos (acesso cruzado A↔B, alteração, aprovação, upload, download, exportação, API direta, URL direta, troca de unidade), mais: usuários reais da MOT continuam vendo seus dados (contagens antes/depois).
- Resultado em tabela: usuário, perfil, unidade, ação, esperado, obtido, regra aplicada, APROVADO/REPROVADO.
- Ao final: unidades e contas de teste desativadas (não apagadas, até sua aprovação).

## Rollback
- Salvar antes: lista completa das regras atuais e contagens por tabela.
- Reverter: apagar apenas as regras novas "obrigatórias" e as de armazenamento novas → volta exatamente ao estado da 2A. Nenhum dado, ID ou arquivo é alterado.

## Não será feito
Remover regras antigas, retirar o fallback, mover arquivos, alterar papéis reais, publicar.

## Detalhes técnicos
- Políticas `AS RESTRICTIVE` por comando usando `user_has_unit_access(unit_id)` / `user_has_area_access(area_id)`; filhas (nc_historico, respostas_auditoria) via EXISTS no pai.
- `units` SELECT restritiva: `user_has_unit_access(id)`.
- storage.objects: função `evidence_path_allowed(name)` security definer que resolve o registro dono (prefixo de unidade novo ou busca em foto_urls/documento_urls/fotos) e checa acesso; políticas restritivas para select/insert/update/delete no bucket audit-photos.
- `upload-photos.ts` / `nc-photo-upload.ts`: prefixo `{unit_id}/`.
- Unidades de teste: coluna `is_test boolean default false` em units.
