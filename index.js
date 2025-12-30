import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from "@whiskeysockets/baileys"
import qrcode from "qrcode-terminal"
import express from "express"
import cors from "cors"

const app = express()
app.use(cors({ origin: "*" }))
app.use(express.json())

let sock
const inbox = []
const MAX = 200

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth")
  const { version } = await fetchLatestBaileysVersion()

  sock = makeWASocket({ auth: state, version })
  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", ({ connection, qr, lastDisconnect }) => {
    if (qr) qrcode.generate(qr, { small: true })
    if (connection === "close") {
      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) {
        start()
      } else {
        console.log("Session terminée. Supprimez le dossier ./auth.")
      }
    }
    if (connection === "open") console.log("Connecté à WhatsApp")
  })

  sock.ev.on("messages.upsert", ({ messages }) => {
    const m = messages?.[0]
    if (!m?.message || m.key.fromMe) return
    
    const text =
      m.message.conversation ||
      m.message?.extendedTextMessage?.text ||
      m.message?.imageMessage?.caption ||
      ""
    
    inbox.push({ from: m.key.remoteJid, text, ts: m.messageTimestamp })
    if (inbox.length > MAX) inbox.shift()
  })
}

// Endpoint POST mis à jour avec normalisation et gestion d'erreurs
app.post("/send", async (req, res) => {
  if (!sock) return res.status(503).json({ error: "Service non prêt" })
  
  const { to, text } = req.body
  if (!to || !text) return res.status(400).json({ error: "Champs manquants" })

  try {
    // Si 'to' est un numéro pur (ex: 33612345678), on ajoute le suffixe JID
    const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`
    
    await sock.sendMessage(jid, { text })
    res.json({ ok: true })
  } catch (e) {
    console.error("Erreur lors de l'envoi :", e)
    res.status(500).json({ error: "Échec de l'envoi du message" })
  }
})

app.get("/messages", (_, res) => {
  const messages = [...inbox]
  inbox.length = 0 // Vide la file après lecture
  res.json(messages)
})

start()
app.listen(3000, () => console.log("API en ligne sur le port 3000"))