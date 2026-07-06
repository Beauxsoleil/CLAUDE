const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L to avoid confusion

export function generateCampCode(length = 5): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}

export function normalizeCampCode(code: string): string {
  return code.trim().toUpperCase();
}
