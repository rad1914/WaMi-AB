// @path: utils/jid.js
import { jidNormalizedUser } from "@whiskeysockets/baileys"

export function resolveJid(m, sock){
  const k = m?.key || {}
  const remote = k.remoteJid || m?.remoteJid
  const participant = k.participant || m?.participant
  const fromMe = !!k.fromMe

  if (remote && typeof remote === "string" && remote.endsWith("@g.us")) {
    const groupJid = jidNormalizedUser(remote)
    const alt = k.remoteJidAlt || k.participantAlt
    const userRaw = alt || participant || (fromMe ? sock?.user?.id : remote)
    const userJid = userRaw && jidNormalizedUser(userRaw)
    return userJid ? `${groupJid}|${userJid}` : groupJid
  }

  const raw = fromMe ? sock?.user?.id : (participant || remote)
  return raw && jidNormalizedUser(raw)
}