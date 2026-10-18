// Sign-up and sign-in rules shared by the server and the screens: a short, easy password (but not one of the
// passwords everyone guesses first), and a nudge when an email looks mistyped.

export const PASSWORD_MIN = 6;
const COMMON = new Set([
  "123456", "1234567", "12345678", "123456789", "1234567890", "654321", "111111", "000000", "121212", "123123",
  "112233", "666666", "888888", "password", "password1", "passw0rd", "qwerty", "qwerty123", "abc123", "abcdef",
  "iloveyou", "letmein", "welcome", "monkey", "dragon", "football", "naija", "naija123", "lagos", "lagos123",
  "nigeria", "nigeria1", "jesus", "jesus123", "god123", "hustle", "hustle123", "asdfgh", "zxcvbn", "qazwsx",
]);

/** What's wrong with a new password, or null if it's fine. */
export function passwordProblem(password: string, nickname?: string): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > 200) return "That password is too long.";
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return "That password is too easy to guess. Add a word or a few numbers.";
  if (nickname && lower === nickname.toLowerCase()) return "Don't use your nickname as your password.";
  return null;
}

const DOMAINS: Record<string, string> = {
  "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gmai.com": "gmail.com", "gamil.com": "gmail.com", "gnail.com": "gmail.com",
  "gmail.co": "gmail.com", "gmail.con": "gmail.com", "gmail.cm": "gmail.com", "gmail.om": "gmail.com", "gmaill.com": "gmail.com",
  "yaho.com": "yahoo.com", "yahoo.co": "yahoo.com", "yahoo.con": "yahoo.com", "yhoo.com": "yahoo.com",
  "hotmial.com": "hotmail.com", "hotmail.co": "hotmail.com", "hotmail.con": "hotmail.com", "homail.com": "hotmail.com",
  "outlok.com": "outlook.com", "outlook.co": "outlook.com", "outlook.con": "outlook.com", "icloud.co": "icloud.com",
};

/** A likely fix for a mistyped email ("ayo@gmial.com" → "ayo@gmail.com"), or null. */
export function emailSuggestion(email: string): string | null {
  const at = email.trim().lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.trim().slice(at + 1).toLowerCase();
  const fix = DOMAINS[domain];
  return fix ? `${email.trim().slice(0, at)}@${fix}` : null;
}
