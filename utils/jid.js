// @path: utils/jid.js (new file)
import { jidNormalizedUser } from "@whiskeysockets/baileys"

export function resolveJid(m, sock){
  const k = m?.key
  const raw = k?.fromMe ? sock?.user?.id : (k?.participantAlt || k?.remoteJidAlt || k?.participant || k?.remoteJid)
  return raw && jidNormalizedUser(raw)
}
