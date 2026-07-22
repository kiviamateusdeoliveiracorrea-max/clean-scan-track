// Normalização de e-mail intencionalmente mínima: apenas trim + lowercase.
// Não adicionamos, removemos ou substituímos domínios automaticamente.
// O valor digitado pelo usuário é preservado (ex.: gmail.com, outlook.com,
// empresa.com, empresa.com.br etc.).

export function normalizeUserEmail(value: string) {
  return (value ?? "").trim().toLowerCase();
}

export function getLoginEmailCandidates(value: string) {
  const email = normalizeUserEmail(value);
  return email ? [email] : [];
}
