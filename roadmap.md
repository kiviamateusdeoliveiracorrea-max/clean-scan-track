# Correção do salvamento de auditorias
- [x] Confirmar causa, adicionar chave única e conclusão transacional sem mudar permissões.
- [x] Comprimir fotos, informar progresso/estimativa e tratar interrupções.
- [x] Recuperar preenchimento automaticamente e impedir rascunhos por cliques repetidos.
- [x] Executar testes automatizados e fluxos reais disponíveis; informar limitações e medições.
- [x] Concluir testes reais de gravação e envio após concessão de execução de has_role, validada anteriormente.

# Promoção das regras de segurança existentes
- [x] Conferir políticas reais e redundância de f2b_units_select; preservar regras de escrita e grants de auditores.
- [x] Aplicar em uma transação as regras de leitura e evidências solicitadas, sem mudar funções ou dados.
- [x] Testar gestora e LIDER/fallback, listas, detalhes 5S/processo, filtros NC, perfis e foto compartilhada; 20 testes 5S aprovados; scanner básico sem achados e antigos marcados corrigidos; teste e foto removidos.
- [ ] Fechar leitura de perguntas 5S entre unidades — bloqueado: requer autorização para alterar a política antiga FOR ALL perguntas_auditoria_write_admin_gestor_auditor, fora do escopo aprovado; LIDER/fallback ainda lê 14 perguntas específicas de unidades não autorizadas. Não publicar.

# Estrutura de Auditoria de Processos
- [x] Criar quatro tabelas independentes, permissões, conclusão transacional e validação.
- [x] Confirmar as 11 áreas e importar as 288 perguntas literais.
- [x] Executar 27 verificações reais de cálculo, conclusão, rollback e acesso; 20 testes de regressão do 5S aprovados.

# Cadastro de Perguntas — Processos
- [x] Criar tela separada espelhando o cadastro 5S, incluindo ordem inteira e filtros.
- [x] Adicionar Perguntas — Processos logo abaixo do cadastro existente no menu.
- [x] Testar criação, edição, exclusão, ativação/desativação, filtros e ordem inteira pela tela; preservar cadastro 5S e remover dados temporários.

# Indicadores de Processos no Dashboard
- [x] Adicionar ranking independente por área ao lado dos indicadores; média, ordem, limite e ausência de dados validados em 4 testes; 20 testes 5S aprovados.
- [ ] Conferir novo ranking na tela com conta autenticada — bloqueado: sessão da solicitante indisponível; requer entrada na prévia ou aprovação de uma conta explícita.
- [x] Adicionar consultas independentes com filtro da unidade e três indicadores, sem modificar consultas ou seções 5S.
- [x] Conferir Dashboard e destinos dos dois botões com sessão de gestora e LIDER; auditoria concluída e rascunho de processo disponíveis e detalhes acessíveis.