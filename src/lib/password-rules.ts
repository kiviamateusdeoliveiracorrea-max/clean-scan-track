export type PasswordRule = { label: string; ok: boolean };

/** Requisitos da nova senha definitiva do usuário. */
export function passwordRules(senha: string, email: string | null): PasswordRule[] {
  const trimmed = senha.trim();
  return [
    { label: "Mínimo de 10 caracteres", ok: senha.length >= 10 },
    { label: "Letra maiúscula", ok: /[A-Z]/.test(senha) },
    { label: "Letra minúscula", ok: /[a-z]/.test(senha) },
    { label: "Número", ok: /[0-9]/.test(senha) },
    { label: "Caractere especial", ok: /[^A-Za-z0-9]/.test(senha) },
    { label: "Sem espaços no início ou fim", ok: senha.length > 0 && trimmed === senha },
    {
      label: "Diferente do e-mail",
      ok: !!senha && (!email || senha.toLowerCase() !== email.toLowerCase()),
    },
  ];
}
