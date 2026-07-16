# Plano de melhorias

Escopo grande — divido em 5 entregas para revisar antes de implementar.

## 1. Controle de acesso por perfil (RBAC)

Perfis já existem no banco (`administrador`, `auditor`, `gestor`, `consulta`). Vou:

- Consolidar em 3 perfis conforme solicitado: **administrador**, **auditor**, **consulta** (mantendo `gestor` como sinônimo de admin em transição).
- Criar guarda de rota por perfil (`useCurrentRole`) e ocultar botões de criar/editar/excluir para `consulta`.
- Restringir server functions (auditorias, NCs) por role usando `has_role()`.
- Página `/usuarios` (admin) ganha campos: **Cargo**, **Área**, **Status ativo/inativo**.

## 2. Cadastro de usuários ampliado

Migração adicionando em `profiles`: `cargo text`, `area_id uuid → areas`, `ativo boolean default true`.
Tela `/usuarios` atualizada com esses campos + toggle ativo/inativo (usuários inativos não conseguem logar — checado via `beforeLoad`).

## 3. Módulo de Tratativas expandido

Colunas novas em `nao_conformidades`:
- `causa_raiz text`, `acao_corretiva text`, `acao_preventiva text`
- `documento_urls text[]` (para PDF além das fotos já existentes)
- `updated_by uuid`

Nova tabela `nc_historico` (auditoria de alterações): id, nc_id, user_id, acao, comentario, created_at.

UI de tratativa ganha:
- Campos Causa raiz, Ação corretiva, Ação preventiva
- Upload de PDF + imagens (bucket `audit-photos` já existe; aceito `application/pdf`)
- Linha do tempo de histórico exibindo quem/quando alterou

Status "Atrasado" calculado automaticamente quando `prazo < hoje` e status ≠ concluído.

## 4. Dashboard Executivo

Nova rota `/dashboard` (index já é dashboard — vou expandir) com cards:
- Total auditorias, score médio Housekeeping, score médio Processos
- Auditorias por área (gráfico barras)
- NCs abertas / vencidas
- Planos concluídos
- Ranking de áreas (por score)
- Evolução mensal (gráfico linha) usando `recharts`

## 5. Notificações por e-mail

Usar **Lovable Emails** (infra gerenciada). Requer domínio de e-mail configurado — vou pedir no momento.

Templates (React Email):
- `nc-aberta` → notifica responsável
- `tratativa-atribuida` → notifica responsável
- `nc-prazo-proximo` → 2 dias antes (cron/pg_cron chamando rota `/api/public/cron/nc-prazos`)
- `nc-vencida` → dia seguinte ao vencimento
- `nc-concluida` → notifica criador da auditoria

Disparos síncronos em server functions ao criar/atualizar NC. Cron diário para varredura de prazos.

## Ordem de execução

1. Migração (perfis, campos usuário, campos NC, histórico)
2. Server functions + guards de role
3. UI: usuários ampliado, tratativa ampliada, dashboard
4. Setup de e-mail (pedirei domínio) + templates + cron

## Perguntas antes de começar

- **Perfis**: consolido `gestor` em `administrador` ou mantenho os 4?
- **E-mail**: você tem um domínio próprio (ex.: `empresa.com.br`) para configurar como remetente? Sem domínio verificado, as notificações não podem ser enviadas.
- **Área do usuário**: vincular a `areas` existente (dropdown) ou texto livre?

Confirme ou ajuste e eu implemento em sequência.