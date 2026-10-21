export function extractSecondaryLinks(user: {
  link2?: string | null;
  link3?: string | null;
  link4?: string | null;
  link5?: string | null;
} | null | undefined): string[] {
  if (!user) return [];
  const links: string[] = [];
  const candidates = [user.link2, user.link3, user.link4, user.link5];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) {
      links.push(c.trim());
    }
  }
  return links;
}

export function buildUserLinkOrFilter(link: string) {
  return [
    { link },
    { link2: link },
    { link3: link },
    { link4: link },
    { link5: link },
  ];
}
