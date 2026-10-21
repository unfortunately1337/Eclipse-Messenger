function randomIndex(limit: number): number {
  // Reject the incomplete bucket so every character has the same probability.
  const ceiling = Math.floor(0x100000000 / limit) * limit;
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0] >= ceiling);
  return value[0] % limit;
}

export function generateSecurePassword(): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const alphabet = upper + lower + digits;
  const chars = [upper[randomIndex(upper.length)], lower[randomIndex(lower.length)], digits[randomIndex(digits.length)]];
  while (chars.length < 15) chars.push(alphabet[randomIndex(alphabet.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
