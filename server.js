const express=require("express");
const path=require("path"),fs=require("fs"),crypto=require("crypto");
const {spawn}=require("child_process");
const multer=require("multer");
const app=express(),PORT=process.env.PORT||3000;
app.disable("x-powered-by");
app.set("trust proxy",1);
const ROOT=__dirname,DOWNLOADS=path.join(ROOT,"downloads"),UPLOADS=path.join(ROOT,"uploads"),REPORTS_FILE=path.join(ROOT,"bug-reports.json"),PREMIUM_FILE=path.join(ROOT,"premium-data.json");
const adminSessions=new Map();
fs.mkdirSync(DOWNLOADS,{recursive:true});fs.mkdirSync(UPLOADS,{recursive:true});
const upload=multer({dest:UPLOADS,limits:{fileSize:100*1024*1024,files:1},fileFilter:(req,file,cb)=>{if(!/^video\/(mp4|webm|quicktime|x-matroska|x-msvideo)$/i.test(file.mimetype||""))return cb(new Error("Format video tidak didukung."));cb(null,true)}});
app.use(express.json({limit:"1mb"}));
// Simple per-IP throttling for public endpoints. For multi-instance deployments, use a shared store.
const rateBuckets=new Map();
function rateLimit({windowMs=60_000,max=30}={}){return (req,res,next)=>{const now=Date.now(),ip=String(req.ip||req.socket.remoteAddress||"unknown");let b=rateBuckets.get(ip);if(!b||now-b.start>=windowMs)b={start:now,count:0};b.count++;rateBuckets.set(ip,b);if(rateBuckets.size>5000){for(const [k,v] of rateBuckets)if(now-v.start>=windowMs)rateBuckets.delete(k)}if(b.count>max){res.setHeader("Retry-After",String(Math.ceil((windowMs-(now-b.start))/1000)));return res.status(429).json({error:"Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi."})}next()}}
// Never serve server source, secrets, JSON storage, uploads, or project metadata as static files.
app.use((req,res,next)=>{const p=decodeURIComponent((req.path||"/").toLowerCase());if(p.startsWith("/uploads/")||p.startsWith("/data/")||p==="/server.js"||p==="/package.json"||p==="/package-lock.json"||p==="/render.yaml"||p==="/dockerfile"||p==="/readme.md"||p==="/bug-reports.json"||p==="/premium-data.json"||p==="/ai_upscale.py"||p==="/setup_ai.sh"||p==="/.env"||p.startsWith("/.git/"))return res.status(404).send("Not found");next()});
app.use(express.static(ROOT,{index:"index.html",dotfiles:"deny",setHeaders:(res,filePath)=>{res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");res.setHeader("X-Frame-Options","DENY");if(/\.(html|js|css)$/i.test(filePath))res.setHeader("Cache-Control","no-cache")}}));
function readReports(){try{return JSON.parse(fs.readFileSync(REPORTS_FILE,"utf8"))}catch{return []}}
function saveReports(rows){fs.writeFileSync(REPORTS_FILE,JSON.stringify(rows,null,2),{mode:0o600})}
function readPremium(){try{const d=JSON.parse(fs.readFileSync(PREMIUM_FILE,"utf8"));return {links:Array.isArray(d.links)?d.links:[],users:d.users&&typeof d.users==="object"?d.users:{}}}catch{return {links:[],users:{}}}}
function savePremium(d){fs.writeFileSync(PREMIUM_FILE,JSON.stringify(d,null,2),{mode:0o600})}
function validUserId(id){return typeof id==="string"&&/^[a-f0-9]{32}$/.test(id)}
function adminAuth(req,res,next){const token=String(req.headers.authorization||"").replace(/^Bearer\s+/i,"");const created=token&&adminSessions.get(token);if(!created||Date.now()-created>8*60*60*1000){if(token)adminSessions.delete(token);return res.status(401).json({error:"Sesi admin berakhir. Silakan login kembali."});}next()}
app.get("/admin",(req,res)=>res.sendFile(path.join(ROOT,"admin.html")));
app.post("/api/admin/login",rateLimit({windowMs:15*60_000,max:10}),(req,res)=>{const configured=process.env.ADMIN_PASSWORD;if(!configured)return res.status(503).json({error:"Password admin belum diatur. Set environment ADMIN_PASSWORD sebelum menjalankan server."});const password=String((req.body||{}).password||"");if(password.length>200||!crypto.timingSafeEqual(Buffer.from(crypto.createHash("sha256").update(password).digest()),Buffer.from(crypto.createHash("sha256").update(configured).digest())))return res.status(401).json({error:"Password admin salah."});const token=crypto.randomBytes(32).toString("hex");adminSessions.set(token,Date.now());res.json({token})});
app.get("/api/admin/reports",adminAuth,(req,res)=>res.json({reports:readReports()}));
app.post("/api/admin/premium-links",adminAuth,(req,res)=>{const days=Number((req.body||{}).days||30);if(!Number.isInteger(days)||days<1||days>365)return res.status(400).json({error:"Durasi harus 1–365 hari."});const data=readPremium(),token=crypto.randomBytes(24).toString("hex"),item={token,days,createdAt:new Date().toISOString(),expiresAt:null,usedAt:null,usedBy:null};data.links.unshift(item);savePremium(data);const base=(process.env.PUBLIC_URL||`${req.protocol}://${req.get("host")}`).replace(/\/$/,"");res.status(201).json({ok:true,link:`${base}/?premium=${token}`,days})});
app.get("/api/premium/status",(req,res)=>{const id=String(req.query.userId||"");if(!validUserId(id))return res.status(400).json({error:"ID perangkat tidak valid."});const data=readPremium(),entry=data.users[id];const active=!!entry&&entry.expiresAt>Date.now();res.json({premium:active,expiresAt:active?new Date(entry.expiresAt).toISOString():null})});
app.post("/api/premium/redeem",(req,res)=>{const token=String((req.body||{}).token||""),userId=String((req.body||{}).userId||"");if(!/^[a-f0-9]{48}$/.test(token)||!validUserId(userId))return res.status(400).json({error:"Magic link atau perangkat tidak valid."});const data=readPremium(),link=data.links.find(x=>x.token===token);if(!link)return res.status(404).json({error:"Magic link tidak ditemukan atau sudah tidak berlaku."});if(link.usedAt)return res.status(409).json({error:"Magic link ini sudah pernah digunakan."});const now=Date.now(),current=data.users[userId];const expiresAt=Math.max(now,current&&current.expiresAt>now?current.expiresAt:now)+link.days*86400000;data.users[userId]={expiresAt,source:"magic-link"};link.usedAt=new Date(now).toISOString();link.usedBy=userId;link.expiresAt=new Date(expiresAt).toISOString();savePremium(data);res.json({ok:true,premium:true,expiresAt:new Date(expiresAt).toISOString(),message:`AM Premium aktif selama ${link.days} hari di perangkat ini.`})});
app.patch("/api/admin/reports/:id",adminAuth,(req,res)=>{const rows=readReports(),item=rows.find(x=>x.id===req.params.id);if(!item)return res.status(404).json({error:"Laporan tidak ditemukan."});const status=String((req.body||{}).status||"");if(!["baru","diproses","selesai"].includes(status))return res.status(400).json({error:"Status tidak valid."});item.status=status;item.updatedAt=new Date().toISOString();saveReports(rows);res.json({ok:true,report:item})});
app.delete("/api/admin/reports/:id",adminAuth,(req,res)=>{const rows=readReports(),next=rows.filter(x=>x.id!==req.params.id);if(next.length===rows.length)return res.status(404).json({error:"Laporan tidak ditemukan."});saveReports(next);res.json({ok:true})});
app.post("/api/reports",rateLimit({windowMs:10*60_000,max:8}),(req,res)=>{const body=req.body||{},description=String(body.description||"").trim();if(description.length<3)return res.status(400).json({error:"Jelaskan kendala minimal 3 karakter."});if(description.length>1200)return res.status(400).json({error:"Laporan maksimal 1200 karakter."});const rows=readReports(),report={id:crypto.randomBytes(8).toString("hex"),description,category:String(body.category||"Lainnya").slice(0,40),page:String(body.page||"").slice(0,160),userAgent:String(body.userAgent||"").slice(0,300),createdAt:new Date().toISOString(),status:"baru"};rows.unshift(report);saveReports(rows.slice(0,1000));res.status(201).json({ok:true,id:report.id,message:"Laporan tersimpan untuk admin."})});

function clean(s){return String(s||"file").replace(/[^a-z0-9._-]/gi,"_").slice(0,70)}
function run(cmd,args){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{stdio:["ignore","ignore","pipe"]});let err="";p.stderr.on("data",d=>{err=(err+d).slice(-5000)});p.on("error",reject);p.on("close",c=>c===0?resolve():reject(new Error(err.slice(-1600))))})}
function getUserId(req,res){let id=req.headers["x-vinn-user"];if(!id||!/^[a-f0-9]{32}$/.test(id)){id=crypto.randomBytes(16).toString("hex");res.setHeader("X-VINN-User",id)}return id}
app.get("/api/account",(req,res)=>res.json({coins:null,costs:{},reward:0}));
function commandAvailable(cmd,args=["--version"]){try{const r=require("child_process").spawnSync(cmd,args,{encoding:"utf8",timeout:5000,windowsHide:true});return !r.error&&r.status===0}catch{return false}}
app.get("/api/health",(req,res)=>{const checks={node:true,downloads:fs.existsSync(DOWNLOADS),uploads:fs.existsSync(UPLOADS),ytDlp:commandAvailable("yt-dlp"),ffmpeg:commandAvailable("ffmpeg",["-version"]),geminiConfigured:!!String(process.env.GEMINI_API_KEY||"").trim(),geminiModel:String(process.env.GEMINI_MODEL||"gemini-2.5-flash")};res.json({ok:true,service:"VINN503",timestamp:new Date().toISOString(),checks})});

app.post("/api/download",rateLimit({windowMs:60_000,max:5}),async(req,res)=>{
 const {url,type="youtube",quality="best",format="mp4"}=req.body||{};
 let parsed;try{parsed=new URL(url)}catch{return res.status(400).json({error:"URL tidak valid."})}
 if(!["http:","https:"].includes(parsed.protocol))return res.status(400).json({error:"URL harus HTTP atau HTTPS."});
 if(!["youtube","tiktok"].includes(type))return res.status(400).json({error:"Sumber media tidak didukung."});
 const host=parsed.hostname.toLowerCase();
 const allowed=type==="youtube"?/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)youtube-nocookie\.com$/.test(host):/(^|\.)tiktok\.com$|(^|\.)vm\.tiktok\.com$|(^|\.)vt\.tiktok\.com$/.test(host);
 if(!allowed)return res.status(400).json({error:`Gunakan link ${type==="youtube"?"YouTube":"TikTok"} yang valid.`});
 const fileId=crypto.randomBytes(8).toString("hex"),out=path.join(DOWNLOADS,`${fileId}.%(ext)s`);
 const max={480:480,720:720,1080:1080,1440:1440,2160:2160}[quality];
 let fmt=max?`bestvideo[height<=${max}]+bestaudio/best[height<=${max}]/best`:(format==="mp3"?"bestaudio/best":"bestvideo+bestaudio/best");
 const args=["--no-playlist","--newline","--restrict-filenames","--retries","3","--fragment-retries","3","--socket-timeout","25","--verbose","-f",fmt,"--merge-output-format",format==="webm"?"webm":"mp4","-o",out];
 if(format==="mp3")args.push("-x","--audio-format","mp3");
 if(format==="webm")args.splice(args.indexOf("--merge-output-format")+1,1,"webm");
 args.push(parsed.href);
 try{await run("yt-dlp",args);const file=fs.readdirSync(DOWNLOADS).find(x=>x.startsWith(fileId+"."));if(!file)throw new Error("File hasil tidak ditemukan. Pastikan yt-dlp dan FFmpeg terpasang.");res.json({downloadUrl:"/downloads/"+encodeURIComponent(file)})}
 catch(e){for(const f of fs.readdirSync(DOWNLOADS).filter(x=>x.startsWith(fileId+"."))){try{fs.unlinkSync(path.join(DOWNLOADS,f))}catch{}}const detail=String(e.message||"");console.error(`[download] yt-dlp failed for host=${host}: ${detail.slice(-4000)}`);const msg=/ENOENT/.test(detail)?"yt-dlp atau FFmpeg belum terpasang di server.":/private|login|sign in|403|forbidden/i.test(detail)?"Media privat atau dibatasi platform. Coba link publik yang dapat diakses.":"Download gagal. Perbarui yt-dlp dan pastikan FFmpeg terpasang; beberapa link mungkin dibatasi platform.";res.status(500).json({error:msg})}
});

app.post("/api/process-video",rateLimit({windowMs:60_000,max:3}), (req,res,next)=>upload.single("video")(req,res,err=>{if(err)return res.status(err.code==="LIMIT_FILE_SIZE"?413:400).json({error:err.code==="LIMIT_FILE_SIZE"?"Ukuran video maksimal 100 MB.":"File video tidak valid atau tidak didukung."});next()}),async(req,res)=>{
 if(!req.file)return res.status(400).json({error:"Video belum dipilih."});
 const q=req.body.quality||"best",fmt=req.body.format==="webm"?"webm":"mp4";
 const fileId=crypto.randomBytes(6).toString("hex"),out=path.join(DOWNLOADS,`${fileId}.${fmt}`),input=req.file.path;
 try{
   let vf=[];if(q!=="best"){const max={480:480,720:720,1080:1080,1440:1440,2160:2160}[q]||1080;vf=[`scale='min(iw,${Math.round(max*16/9)})':'min(ih,${max})':force_original_aspect_ratio=decrease`]}
   const args=["-y","-i",input];if(vf.length)args.push("-vf",vf[0]);
   if(fmt==="mp4")args.push("-c:v","libx264","-preset","veryfast","-crf","18","-c:a","aac","-b:a","192k","-movflags","+faststart");else args.push("-c:v","libvpx-vp9","-crf","30","-b:v","0","-c:a","libopus");
   args.push(out);await run("ffmpeg",args);fs.unlinkSync(input);res.json({downloadUrl:"/downloads/"+encodeURIComponent(path.basename(out))});
 }catch(e){try{fs.unlinkSync(input)}catch{}res.status(500).json({error:/ENOENT/.test(String(e.message))?"FFmpeg belum terpasang di server.":"Video gagal diproses. Periksa format file dan ketersediaan FFmpeg."})}
});
app.use("/downloads",express.static(DOWNLOADS,{setHeaders:(r,filePath)=>{const name=path.basename(filePath).replace(/[\r\n"\\]/g,"_");r.setHeader("Content-Disposition",`attachment; filename="${name}"`);r.setHeader("X-Content-Type-Options","nosniff");}}));


// VINN AI: Gemini API key stays server-side in GEMINI_API_KEY.
app.post("/api/ai-chat", rateLimit({windowMs:60_000,max:12}), async (req,res)=>{
 const key=process.env.GEMINI_API_KEY;
 if(!key) return res.status(503).json({error:"VINN AI belum dikonfigurasi. Tambahkan GEMINI_API_KEY di environment server."});
 const body=req.body||{}, message=String(body.message||"").trim();
 if(!message) return res.status(400).json({error:"Tulis pertanyaan terlebih dahulu."});
 if(message.length<1) return res.status(400).json({error:"Pertanyaan kosong."});
 if(message.length>2000) return res.status(413).json({error:"Pertanyaan terlalu panjang (maksimal 2000 karakter)."});
 const history=Array.isArray(body.history)?body.history.slice(-8).map(x=>({role:x.role==="model"?"model":"user",parts:[{text:String(x.text||"").slice(0,2000)}]})).filter(x=>x.parts[0].text):[];
 try {
  const model=String(process.env.GEMINI_MODEL||"gemini-2.5-flash").trim().replace(/^models\//,"");
  const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent?key="+encodeURIComponent(key),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system_instruction:{parts:[{text:"Kamu adalah VINN AI, asisten ramah berbahasa Indonesia. Jawab pertanyaan umum secara jelas, akurat, dan ringkas. Untuk pertanyaan tentang fitur VINN503, bantu panduan downloader, musik, cuaca BMKG, gempa, dan Termux. Jangan mengaku memiliki akses langsung ke data terbaru jika tidak diberikan. Untuk medis, hukum, keuangan, atau keadaan darurat, berikan informasi umum dan arahkan ke sumber/profesional resmi. Jangan bantu tindakan berbahaya atau ilegal."}]},contents:[...history,{role:"user",parts:[{text:message}]}],generationConfig:{temperature:0.7,maxOutputTokens:800}})});
  const data=await response.json();
  if(!response.ok){console.error("Gemini API error",response.status,JSON.stringify(data).slice(0,1000));return res.status(response.status===429?429:502).json({error:response.status===429?"Batas gratis AI sedang tercapai. Coba lagi nanti.":"Layanan AI sedang tidak tersedia. Periksa API key atau coba lagi."});}
  const answer=(data.candidates||[]).flatMap(c=>c.content?.parts||[]).map(p=>p.text||"").join("\n").trim();
  if(!answer)return res.status(502).json({error:"AI tidak mengirim jawaban. Coba pertanyaan lain."});
  res.json({answer});
 } catch(e){console.error("VINN AI request failed:",e.message);res.status(502).json({error:"Tidak bisa menghubungi layanan AI. Periksa koneksi internet server."});}
});

app.listen(PORT,"0.0.0.0",()=>{console.log(`VINN503 Downloader V2: http://0.0.0.0:${PORT}`);try{const v=require("child_process").spawnSync("yt-dlp",["--version"],{encoding:"utf8",timeout:10000});console.log(`[startup] yt-dlp version: ${(v.stdout||v.stderr||"unavailable").trim()}`)}catch(e){console.error("[startup] yt-dlp version check failed:",e.message)}try{const v=require("child_process").spawnSync("ffmpeg",["-version"],{encoding:"utf8",timeout:10000});console.log(`[startup] ffmpeg: ${v.status===0?"available":"unavailable"}`)}catch(e){console.error("[startup] ffmpeg check failed:",e.message)}});
