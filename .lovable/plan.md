# Diagnóstico do envio de fotos (auditoria e NC) — somente leitura

Nada foi alterado. As regras de acesso, os arquivos e os dados continuam como estavam.

## 1. O que foi confirmado
| Item | Situação atual |
|---|---|
| Bucket | `audit-photos`, privado, sem limite de tamanho no servidor, sem filtro de tipo |
| Limite no app | 10 MB; tipos JPG, PNG, WEBP, GIF (conferido pela extensão também) |
| Regras do armazenamento | 4 regras: ler, enviar, substituir e apagar liberados para **qualquer usuário logado**, sem checar unidade, área ou papel. Nenhuma foi mudada na Fase 2A |
| Regras de auditoria/NC | Alterar exige o papel antigo administrador, gestor ou auditor. Nenhuma foi mudada na Fase 2A |
| Último arquivo gravado | 22/09 12:23 (foto de tratativa). Nenhum envio depois disso |
| Registros de erro recentes | Os registros do servidor e do banco da última hora estão vazios. A mensagem real ainda não foi capturada |

## 2. Fluxos e caminhos gerados
| Tela | Método | Caminho | Grava em |
|---|---|---|---|
| Nova auditoria, foto da pergunta NÃO | upload com **upsert (substituir)** | `{auditoria}/nc-{pergunta}-{hora}.{ext}` | respostas / NC (`foto_urls`) |
| Nova auditoria, fotos gerais | upload | `{auditoria}/auditoria-{hora}-{aleatório}.{ext}` | `auditorias.fotos` |
| Auditoria existente, nova NC | upload **sem tipo informado** | `{auditoria}/{hora}.{ext}` | `nao_conformidades.foto_url` (inserção) |
| Tratativa de NC | upload e depois link assinado de 60 s para confirmar | `{auditoria ou nc}/tratativa-{nc}-{hora}-{aleatório}.{ext}` | `foto_urls`, `documento_urls` (alteração) |
| Pré-visualização | link assinado de 1 h | — | — |

A extensão vem do nome original. Espaços e acentos não entram no caminho. Isso não causa o erro.

## 3. Hipóteses (ainda não confirmadas)
Pelas regras atuais, o envio do arquivo não deveria ser bloqueado para nenhum usuário logado. Então o erro provavelmente acontece **depois do envio**, ao gravar o registro:
1. **Gatilho de unidade da Fase 2A** (`set_unit_from_area`) na inserção de NC ou na tratativa: "Registro sem unidade válida", "Área inativa" ou "Auditoria e registro pertencem a unidades diferentes". A nova NC da tela de auditoria existente envia `area_id`, mas pode enviar uma área vazia ou inativa.
2. **Substituir (upsert) na nova auditoria**: se a política de substituição não se aplicar ao dono do arquivo, a resposta é "new row violates row-level security policy".
3. **Gravação parcial**: o arquivo é enviado antes da gravação no banco. Se a gravação falha, o arquivo fica órfão e não aparece na tela.
4. Papel antigo "consulta" ou usuário sem papel antigo: alteração da NC bloqueada (comportamento esperado).

## 4. Próximo passo: reproduzir sem usar a conta da Kivia
1. Criar 3 contas de teste temporárias (ADMIN_UNIDADE, LIDER com área, CONSULTOR), só na unidade MOT, identificadas como teste.
2. Com cada conta, rodar os 12 cenários (JPG pequeno, PNG, nome com espaço, nome com acento, arquivo acima de 10 MB, auditoria nova, auditoria existente, NC existente) usando uma auditoria de teste.
3. Registrar para cada cenário: operação, status HTTP, código, mensagem real, mensagem exibida, regra ou gatilho responsável, se o arquivo foi criado e se o caminho foi gravado. O cenário ADMIN_GLOBAL será simulado com a conta de teste promovida temporariamente, com registro no histórico.
4. Entregar a tabela completa com a causa raiz confirmada.
5. Depois do teste: desativar as contas, apagar a auditoria de teste e remover os arquivos de teste. Os órfãos existentes não serão tocados.

## 5. Correção mínima provável (só após confirmar e aprovar)
- Se for o gatilho: a nova NC herda a área da auditoria quando o campo vier vazio, e a mensagem mostrada ao usuário explica o motivo.
- Se for o upsert: trocar por envio simples com nome único.
- Em qualquer caso: informar o tipo do arquivo no envio da nova NC e remover o arquivo recém-enviado quando a gravação no banco falhar, para evitar novos órfãos.
- As regras de acesso não mudam, nenhuma regra é removida e a Fase 2B não começa.

## Detalhes técnicos
- Não foi possível simular pelo banco como usuário logado: a sessão de diagnóstico não tem permissão para assumir o papel `authenticated`.
- Nenhum token, chave ou senha será exibido nos resultados.
