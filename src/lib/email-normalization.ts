const CUMMINS_DOMAINS = new Set(["cummins.com.br", "cummins.com", "cummin.com.br", "cummin.com"]);

function splitEmail(value: string) {
  const email = value.trim().toLowerCase();
  const at = email.indexOf("@");
  if (at <= 0) return { email, local: "", domain: "" };
  return {
    email,
    local: email.slice(0, at),
    domain: email.slice(at + 1),
  };
}

export function normalizeUserEmail(value: string) {
  const { email, local, domain } = splitEmail(value);
  if (!local || !domain) return email;
  if (CUMMINS_DOMAINS.has(domain)) return `${local}@cummins.com.br`;
  return email;
}

export function getLoginEmailCandidates(value: string) {
  const { email, local, domain } = splitEmail(value);
  if (!local || !domain) return [email].filter(Boolean);

  const official = normalizeUserEmail(email);
  const candidates = [email, official];

  if (CUMMINS_DOMAINS.has(domain)) {
    candidates.push(
      `${local}@cummins.com`,
      `${local}@cummin.com.br`,
      `${local}@cummin.com`,
    );
  }

  return Array.from(new Set(candidates.filter(Boolean)));
}