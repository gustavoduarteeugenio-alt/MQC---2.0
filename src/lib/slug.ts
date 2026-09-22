/** Slug estável para editais e nós de conteúdo: sem acento, minúsculo, com hífens. */
export const slugify = (value: string, max = 60) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);

/** Garante que o slug não colida com os já usados no mesmo escopo. */
export const uniqueSlug = (value: string, taken: string[], max = 60) => {
  const base = slugify(value, max) || "item";
  if (!taken.includes(base)) return base;
  for (let i = 2; i < 100; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
};
