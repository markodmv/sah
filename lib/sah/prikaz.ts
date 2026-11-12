// "Prvenstvo … za 2026. :: dječaci U10 ::" → "Prvenstvo … za 2026. – dječaci U10"
export const ljepsiNaziv = (n: string) => n.replace(/\s*::\s*([^:]+?)\s*(?:::\s*)?$/, " – $1").trim();
