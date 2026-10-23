/**
 * Admin password policy: at least 12 characters with letters and numbers,
 * or a passphrase of 20 characters or more. Common weak choices are refused.
 */
const weak = ["password", "123456", "qwerty", "admin", "letmein", "welcome", "auction"];

export function passwordProblem(password: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 256) return "Use at most 256 characters.";
  const lower = password.toLowerCase();
  if (weak.some((w) => lower.includes(w)) && password.length < 20) {
    return "That password contains a common word. Choose something less predictable.";
  }
  if (password.length < 20 && !(/[a-zA-Z]/.test(password) && /[0-9]/.test(password))) {
    return "Use both letters and numbers, or a passphrase of 20 characters or more.";
  }
  if (/^(.)\1+$/.test(password)) return "Do not repeat one character.";
  return null;
}
