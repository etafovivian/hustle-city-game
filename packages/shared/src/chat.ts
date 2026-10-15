// Chat: a room chat at every place (who's there can talk) and private messages between players. Links and phone
// numbers are blocked, because scams start there ("send me your number", "click this").

export const CHAT_MAX = 280;

/** Why a message can't be sent, or null if it's fine. */
export function chatProblem(raw: string): string | null {
  const body = raw.trim();
  if (!body) return "Say something first.";
  if (body.length > CHAT_MAX) return `Keep it under ${CHAT_MAX} characters.`;
  if (/(https?:\/\/|www\.|\.(com|ng|net|org|io|xyz|me|co)\b)/i.test(body)) return "Links aren't allowed in chat, to keep scams out.";
  if (/(\+?234|0)[\s-]?[789][01](?:[\s-]?\d){8}/.test(body) || /\d(?:[\s-]?\d){9,}/.test(body)) return "Phone numbers aren't allowed in chat. Meet in the game first.";
  return null;
}

export interface ChatMessage {
  id: string;
  from: string;
  body: string;
  at: string;
  mine: boolean;
}

export interface DmThread {
  with: string;
  last: string;
  at: string;
  unread: number;
}
