// @path: utils/jid.js (new file)
import { jidNormalizedUser } from "@whiskeysockets/baileys"

export function resolveJid(m, sock){
  const key = m.key || {}
  const altId = key.participantAlt || key.remoteJidAlt
  const primaryId = key.participant || key.remoteJid
  const rawId = key.fromMe ? sock?.user?.id : (altId || primaryId)
  return jidNormalizedUser(rawId)
}
