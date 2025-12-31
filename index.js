// @path: index.js
import makeWASocket,{useMultiFileAuthState,fetchLatestBaileysVersion,DisconnectReason}from"@whiskeysockets/baileys"
import{resolveJid}from"./utils/jid.js"
import qrcode from"qrcode-terminal"
import express from"express"
import cors from"cors"
const app=express();app.use(cors({origin:"*"}));app.use(express.json())
let sock,inbox=[];const MAX=200
async function start(){
  const{state,saveCreds}=await useMultiFileAuthState("./auth"),{version}=await fetchLatestBaileysVersion()
  sock=makeWASocket({auth:state,version,emitOwnEvents:!0})
  sock.ev.on("creds.update",saveCreds)
  sock.ev.on("connection.update",({connection,qr,lastDisconnect})=>{
    if(qr)qrcode.generate(qr,{small:!0})
    if(connection==="close"){
      const c=lastDisconnect?.error?.output?.statusCode
      c!==DisconnectReason.loggedOut?start():console.log("Session terminée. Supprimez ./auth.")
    }
    if(connection==="open")console.log("Connecté")
  })
  sock.ev.on("messages.upsert",({messages})=>{
    for(const m of messages||[]){
      if(!m?.message)continue
      const t=m.message.conversation||m.message?.extendedTextMessage?.text||m.message?.imageMessage?.caption||"",
            k=m.key||{},from=resolveJid(m,sock),ts=m.messageTimestamp
      inbox.push({from,text:t,ts,fromMe:!!k.fromMe});inbox.length>MAX&&inbox.shift()
    }
  })
}
app.post("/send",async(req,res)=>{
  if(!sock)return res.status(503).json({error:"Service non prêt"})
  const{to,text}=req.body;if(!to||!text)return res.status(400).json({error:"Champs manquants"})
  try{await sock.sendMessage(to.includes("@")?to:`${to}@s.whatsapp.net`,{text});res.json({ok:!0})}
  catch{res.status(500).json({error:"Échec"})}
})
app.get("/messages",(_,res)=>{const m=[...inbox];inbox.length=0;res.json(m)})
start().catch(e=>console.error(e))
app.listen(3000,()=>console.log("API 3000"))
