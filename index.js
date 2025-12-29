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
      return code !== DisconnectReason.loggedOut ? start() : console.log("Logged out, delete auth folder.")
    }
    if (connection === "open") console.log("Connected")
  })

  sock.ev.on("messages.upsert", ({ messages }) => {
    const m = messages?.[0]
    if (!m?.message) return
    const text =
      m.message.conversation ||
      m.message?.extendedTextMessage?.text ||
      m.message?.imageMessage?.caption ||
      ""
    inbox.push({ from: m.key.remoteJid, text, ts: m.messageTimestamp })
    if (inbox.length > MAX) inbox.shift()
  })
}

app.post("/send", async (req, res) => {
  if (!sock) return res.status(503).json({ error: "not ready" })
  const { to, text } = req.body
  if (!to || !text) return res.status(400).json({ error: "missing fields" })
  await sock.sendMessage(to, { text })
  res.json({ ok: true })
})

app.get("/messages", (_, res) => {
  res.json([...inbox])
  inbox.length = 0
})

start()
app.listen(3000, () => console.log("API running"))