// @path: backend.js
import makeWASocket,{
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
}from"@whiskeysockets/baileys"
import{resolveJid}from"./utils/jid.js"
import qr from"qrcode-terminal"
import express from"express"
import cors from"cors"

const app=express()
app.use(cors())
app.use(express.json())

let sock
const box=[],MAX=200
const push=m=>(box.push(m),box.length>MAX&&box.shift())

const start=async()=>{
  const{state,saveCreds}=await useMultiFileAuthState("./auth")
  const{version}=await fetchLatestBaileysVersion()
  sock=makeWASocket({auth:state,version,emitOwnEvents:true})

  sock.ev.on("creds.update",saveCreds)

  sock.ev.on("connection.update",u=>{
    u.qr&&qr.generate(u.qr,{small:true})
    if(u.connection==="close"){
      u.lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut
        ? start()
        : console.log("Supprimez ./auth")
    }
  })

  sock.ev.on("messages.upsert",({messages=[]})=>{
    for(const m of messages){
      const x=m.message
      if(!x)continue
      push({
        from:resolveJid(m,sock),
        text:x.conversation||x.extendedTextMessage?.text||x.imageMessage?.caption||"",
        ts:m.messageTimestamp,
        fromMe:!!m.key?.fromMe
      })
    }
  })
}

app.post("/send",async(req,res)=>{
  if(!sock)return res.sendStatus(503)
  const{to,text}=req.body
  if(!to||!text)return res.sendStatus(400)
  try{
    await sock.sendMessage(to.includes("@")?to:`${to}@s.whatsapp.net`,{text})
    res.json({ok:true})
  }catch{res.sendStatus(500)}
})

app.get("/messages",(_,res)=>res.json(box.splice(0)))

start()
app.listen(3000)
