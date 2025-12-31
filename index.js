// index.js
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  jidNormalizedUser
} from "@whiskeysockets/baileys"
import qrcode from "qrcode-terminal"
import express from "express"
import cors from "cors"

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json())
let sock, inbox = [], MAX = 200

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth")
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({
    auth: state,
    version,
    emitOwnEvents: true
  })

  sock.ev.on("creds.update", saveCreds)
  sock.ev.on("connection.update", ({ connection, qr, lastDisconnect }) => {
    if (qr) qrcode.generate(qr, { small: !0 })
    if (connection === "close") {
      const c = lastDisconnect?.error?.output?.statusCode
      c !== DisconnectReason.loggedOut ? start() : console.log("Session terminée. Supprimez ./auth.")
    }
    if (connection === "open") console.log("Connecté")
  })

  sock.ev.on("messages.upsert", ({ messages }) => {
    for (const m of messages || []) {
      if (!m?.message) continue
      const text = m.message.conversation || m.message?.extendedTextMessage?.text || m.message?.imageMessage?.caption || ""
      const key = m.key || {}
      const altId = key.participantAlt || key.remoteJidAlt
      const primaryId = key.participant || key.remoteJid
      const rawId = key.fromMe ? sock?.user?.id : (altId || primaryId)
      const from = jidNormalizedUser(rawId)
      const ts = m.messageTimestamp
      inbox.push({ from, text, ts, fromMe: !!key.fromMe })
      if (inbox.length > MAX) inbox.shift()
    }
  })
}

app.post("/send", async (req, res) => {
  if (!sock) return res.status(503).json({ error: "Service non prêt" })
  const { to, text } = req.body;
  if (!to || !text) return res.status(400).json({ error: "Champs manquants" })
  try {
    await sock.sendMessage(to.includes("@") ? to : `${to}@s.whatsapp.net`, { text });
    res.json({ ok: !0 })
  } catch {
    res.status(500).json({ error: "Échec" })
  }
})

app.get("/messages", (_, res) => {
  const m = [...inbox];
  inbox.length = 0;
  res.json(m)
})

start();
app.listen(3000, () => console.log("API 3000"))