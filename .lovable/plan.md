# Validação de administradores e usuários sem área

Só muda o papel da unidade e o status de validação. Os papéis atuais (tabela de papéis antiga) **não mudam**, então ninguém perde ou ganha acesso agora: a troca só vale quando as regras novas entrarem (Fase 2B). Nada é publicado.

## Matriz final (Cummins Motores)

| Nome | Cargo | Área | Papel novo | Situação |
|---|---|---|---|---|
| Anderson Souza | Líder | Embalagem | LIDER | VALIDADO |
| Claudete G de Moura | Líder | Recebimento | LIDER | VALIDADO |
| Claudio Trindade | Líder | PSBU | LIDER | VALIDADO |
| Ícaro Camilo | Líder | Ativação | LIDER | VALIDADO |
| Ícaro Vasconcellos | Líder | Ativação | LIDER | VALIDADO |
| Jorge M Lima | Líder | Almoxarifado | LIDER | VALIDADO |
| Leandro Alencar | Líder | Ativação | LIDER | VALIDADO |
| Paulo Roberto | Líder | CTT | LIDER | VALIDADO |
| Gleisson Nogueira | Analista Qualidade | Qualidade | ADMIN_UNIDADE | VALIDADO |
| Lucas N. Santana | Assistente Qualidade | Qualidade | ADMIN_UNIDADE | VALIDADO |
| Jefferson Leandro | Coordenador | Almoxarifado | ADMIN_UNIDADE | VALIDADO |
| Alessandro Ventura | Gerente | Ativação | GERENTE | VALIDADO |
| Caroline Clemente | Coordenadora | Qualidade | COORDENADOR | VALIDADO + acesso à área Qualidade |

Kivia continua ADMIN_GLOBAL. Contas de teste inativas (Test, TESTE - SENHA TEMPORARIA, teste.senhatemp): continuam inativas, sem área, marcadas como revisadas.

## Atenção
Os 8 líderes ainda são "administrador" no papel antigo. Isso só será retirado na Fase 2B, com a lista mostrada antes, conforme combinado.

## Testes
- 13 vínculos validados; 0 ativos pendentes.
- Caroline com 1 área (Qualidade); nenhum outro usuário ganhou área.
- Tabela de papéis antiga com os mesmos 14 registros.
- Cada alteração registrada no log da unidade (valor anterior e novo).

## Desfazer
Voltar papel e situação anteriores (salvos no log) e remover o vínculo de área da Caroline.

## Detalhes técnicos
- UPDATE em user_unit_permissions (role, validation_status, updated_by) por user_id; INSERT em user_area_permissions para Caroline; INSERT em unit_audit_log com previous_value/new_value; contas de teste: validation_status mantido, log "REVISADO".
- Sem migração de esquema, sem mudança de RLS nem de user_roles.
