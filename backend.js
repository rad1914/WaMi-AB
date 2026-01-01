// backend.js 
import makeWASocket,{useMultiFileAuthState,fetchLatestBaileysVersion,DisconnectReason}from"@whiskeysockets/baileys"
import {resolveJid}from"./utils/jid.js"
import qrcode from"qrcode-terminal"
import express from"express"
import cors from"cors"

const app=express()
app.use(cors({origin:"*"}))
app.use(express.json())

let sock,inbox=[]
const MAX=200

async function start(){
  const{state,saveCreds}=await useMultiFileAuthState("./auth")
  const{version}=await fetchLatestBaileysVersion()
  sock=makeWASocket({auth:state,version,emitOwnEvents:true})

  sock.ev.on("creds.update",saveCreds)
  sock.ev.on("connection.update",({connection,qr,lastDisconnect})=>{
    if(qr)qrcode.generate(qr,{small:true})
    if(connection==="close"){
      const c=lastDisconnect?.error?.output?.statusCode
      c!==DisconnectReason.loggedOut?start():console.log("Session terminée. Supprimez ./auth.")
    }
    if(connection==="open")console.log("Connecté")
  })

  sock.ev.on("messages.upsert",({messages})=>{
    for(const m of messages||[]){
      if(!m?.message)continue
      inbox.push({
        from:resolveJid(m,sock),
        text:m.message.conversation||m.message?.extendedTextMessage?.text||m.message?.imageMessage?.caption||"",
        ts:m.messageTimestamp,
        fromMe:!!m.key?.fromMe
      })
      if(inbox.length>MAX)inbox.shift()
    }
  })
}

app.post("/send",async(req,res)=>{
  if(!sock)return res.status(503).json({error:"Service non prêt"})
  const{to,text}=req.body
  if(!to||!text)return res.status(400).json({error:"Champs manquants"})
  try{
    await sock.sendMessage(to.includes("@")?to:`${to}@s.whatsapp.net`,{text})
    res.json({ok:true})
  }catch{
    res.status(500).json({error:"Échec"})
  }
})

app.get("/messages",(_,res)=>{
  const m=[...inbox]
  inbox.length=0
  res.json(m)
})

start().catch(console.error)
app.listen(3000,()=>console.log("API 3000"))// @path: utils/jid.js
import { jidNormalizedUser } from "@whiskeysockets/baileys"

export function resolveJid(m, sock){
  const k = m?.key || {}
  const remote = k.remoteJid || m?.remoteJid
  const participant = k.participant || m?.participant
  const fromMe = !!k.fromMe

  if (remote && typeof remote === "string" && remote.endsWith("@g.us")) {
    const groupJid = jidNormalizedUser(remote)
    const userRaw = participant || (fromMe ? sock?.user?.id : remote)
    const userJid = userRaw && jidNormalizedUser(userRaw)
    return userJid ? `${groupJid}|${userJid}` : groupJid
  }

  const raw = fromMe ? sock?.user?.id : (participant || remote)
  return raw && jidNormalizedUser(raw)
}