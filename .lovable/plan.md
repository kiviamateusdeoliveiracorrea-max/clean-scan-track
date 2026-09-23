# Perfil LIDER, tratativas, evidências e aprovação

## 1. Diagnóstico (lido agora no banco)

Tabelas usadas hoje:
- Ocorrências + tratativas + aprovação: tudo em `nao_conformidades` (causa_raiz, acao_corretiva, acao_preventiva, responsavel_acao_id, prazo, aprovador_id, parecer_aprovador, data_aprovacao, aprovado_por, status).
- Evidências: listas de endereços `foto_urls` / `documento_urls` dentro da própria NC; arquivos no armazenamento privado `audit-photos`. Não há registro de quem anexou, quando, nem versões.
- Histórico/auditoria: `nc_historico` (por NC), `admin_logs`, `auditorias_log`.
- Perfis: `user_roles` (papéis: administrador, gestor, auditor, consulta). **Não existe papel LIDER.**
- Áreas autorizadas: apenas `profiles.area_id` (uma área por usuário). Não há tabela de áreas autorizadas.

Regras atuais (RLS):
- NC: leitura para qualquer usuário logado (todas as áreas); criar/alterar só administrador, auditor ou gestor; excluir administrador ou gestor. Não há controle de status nem de campos.
- Histórico: leitura por todos; inclusão só administrador/auditor/gestor.
- Arquivos: qualquer usuário logado lê, envia, substitui e **apaga** qualquer arquivo do armazenamento.

O que bloqueia o líder: como não existe papel LIDER, o líder fica como "consulta", que não pode alterar NC nem gravar histórico. Por isso foi promovido a administrador.

Hoje há 12 administradores e 2 gestores. Pelo cargo cadastrado, **9 administradores parecem temporários** (cargo "Líder"): Claudio Trindade, Ícaro Vasconcellos, Ícaro Camilo, Paulo Roberto, Anderson Souza, Leandro Alencar, Jorge M Lima, Claudete G de Moura. Os demais (Jefferson Leandro – Coordenador; Lucas N. Santana, Gleisson Nogueira, Kivia Correa – Qualidade) serão apenas listados para você decidir. Nada será rebaixado automaticamente.

Status atuais das NCs: aberta 5, em_andamento 1, aprovada 1, encerrada 11, cancelada 16.

## 2. O que será feito

**Papéis (sem apagar nada)**
- Adicionar o papel `lider` ao cadastro de perfis. Gestor = aprovador. Administrador segue igual. Auditor e consulta mantidos.
- Criar "áreas autorizadas" por usuário (várias áreas), preenchida inicialmente com a área atual de cada perfil. Admin/gestor editam; ninguém edita a si próprio.

**Status padronizados**
- Novos: ABERTA, ATRIBUIDA, EM_TRATATIVA, AGUARDANDO_EVIDENCIA, ENVIADA_PARA_APROVACAO, DEVOLVIDA_PARA_CORRECAO, APROVADA, REPROVADA, CONCLUIDA, CANCELADA, VENCIDA.
- Conversão dos existentes (sem perder histórico): aberta→ABERTA, em_andamento→EM_TRATATIVA, aguardando_aprovacao→ENVIADA_PARA_APROVACAO, aprovada→APROVADA, reprovada→DEVOLVIDA_PARA_CORRECAO, encerrada→CONCLUIDA, cancelada→CANCELADA. VENCIDA é calculada pelo prazo (não sobrescreve o status).

**Regras no banco (valem mesmo fora da tela)**
- Líder: vê só NCs das áreas autorizadas; assume se a NC for da sua área e sem responsável ou atribuída a ele; edita só causa, ação imediata, corretiva, responsável da execução, prazo proposto, comentário e status operacional, e só em ABERTA/ATRIBUIDA/EM_TRATATIVA/AGUARDANDO_EVIDENCIA/DEVOLVIDA; não mexe em área, criticidade, descrição, autor nem aprovação; nunca define APROVADA/REPROVADA/CONCLUIDA; não exclui.
- Gestor: vê áreas autorizadas; altera só campos de aprovação e as transições ENVIADA→APROVADA/REPROVADA/DEVOLVIDA, APROVADA→CONCLUIDA; parecer obrigatório; novo prazo ao devolver; não aprova tratativa em que foi o executor.
- Admin: tudo acima, mais reabrir/cancelar com justificativa.
- Exclusão de NC bloqueada após envio para aprovação (usar CANCELADA).
- Toda mudança grava automaticamente no histórico: usuário, data/hora, valor anterior, novo, justificativa, origem. Histórico não pode ser editado nem apagado.

**Evidências**
- Nova tabela de evidências ligada à NC: arquivo, tipo, tamanho, descrição, quem anexou, quando, versão e "substituída por".
- Tipos: JPG, JPEG, PNG, WEBP, PDF, XLSX, DOCX; limite 10 MB (ajustável).
- Arquivos em `nc/{nc_id}/...`; acesso só com link temporário e permissão de área.
- Antes do envio: líder anexa, substitui (nova versão, original preservado) e exclui o que anexou por engano. Após envio: sem exclusão; complemento só quando devolvida.
- Evidências antigas (fotos já anexadas) continuam visíveis; ficam registradas como versão 1.
- Regras de armazenamento restringidas: só envia/lê quem tem acesso à área da NC; ninguém apaga arquivo após envio.

**Envio para aprovação**
- Valida campos obrigatórios e pelo menos uma evidência; muda para ENVIADA_PARA_APROVACAO; bloqueia edição; registra data/usuário; gera aviso no aplicativo para gestores e admins da área (sino no topo).

**Telas**
- Detalhe da tratativa com todos os campos pedidos, bloco de evidências (miniaturas, nome, data, autor, descrição, baixar, substituir), histórico e parecer.
- Botões do aprovador: Aprovar, Devolver para correção, Reprovar, com campos obrigatórios.
- "Minhas Tratativas" (líder): contadores por situação, filtros (período, área, criticidade, status, prazo, responsável) e ações rápidas.
- "Tratativas para Aprovação" (gestor/admin): aguardando, vencidas, críticas, devolvidas, aprovadas no período, tempo médio; filtros.
- Menu: líder não vê Usuários, Perguntas, Áreas, Auditores, Configurações.
- Usuários e Acessos: opção LIDER no perfil e lista "possíveis admins temporários" com botão para trocar para LIDER, preservando áreas e histórico.

**Funções do servidor**
- As funções administrativas continuam exigindo administrador; líder recebe erro ao tentar usá-las.

## 3. Testes
- Criar dados "TESTE - FLUXO TRATATIVA" (área, líder, gestor, gestor de outra área, NC) e rodar os 20 cenários com sessões reais de cada usuário, chamando o banco diretamente (não só a tela). Tabela: perfil, cenário, ação, esperado, obtido, regra aplicada, evidência, APROVADO/REPROVADO. Falhas corrigidas e retestadas sem desligar a segurança. Dados de teste removidos no final.
- Regressão: login, usuários, auditorias, NCs existentes, dashboard, senha.

## 4. Entrega (sem publicar)
Permissões antes x depois, telas e regras alteradas, lista de admins possivelmente temporários, resultados, contagem de NCs/histórico antes e depois comprovando que nada foi perdido.

## Detalhes técnicos
- `ALTER TYPE app_role ADD VALUE 'lider'` em migração separada.
- Tabelas novas: `user_area_permissions`, `nc_evidencias`, `notificacoes` (com GRANT + RLS). Funções security definer: `user_has_area_access`, `nc_transition_guard` (gatilho BEFORE UPDATE validando papel × transição × campos), gatilho de histórico em `nao_conformidades`.
- `NC_STATUS_*` em `audit-constants.ts` atualizados para os novos códigos; dashboard ajustado.
- Mudanças de status via função do servidor (`requireSupabaseAuth`) + gatilho no banco como barreira final.
