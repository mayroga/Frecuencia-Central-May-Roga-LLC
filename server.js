import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import Stripe from 'stripe';
import fetch from 'node-fetch';
import fs from 'fs-extra';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// --- Directorio público ---
const PUBLIC_DIR = path.join(process.cwd(), 'public');

// --- Asegurar carpetas ---
await fs.ensureDir(path.join(PUBLIC_DIR,'audio'));
await fs.ensureDir(path.join(PUBLIC_DIR,'data'));

// --- Base de datos simple ---
const SESSIONS_FILE = path.join(PUBLIC_DIR,'data','sessions.json');
let DB = { sessions: [], vipSessions: [], dailyLimits: {} };
if(await fs.pathExists(SESSIONS_FILE)){
  try{ DB = await fs.readJson(SESSIONS_FILE); } 
  catch(e){ DB={ sessions: [], vipSessions: [], dailyLimits:{} }; }
}

const saveDB = async()=>{ await fs.writeJson(SESSIONS_FILE,DB,{spaces:2}); };

// --- Middlewares ---
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static(PUBLIC_DIR));

// --- Utilidad ID ---
const uid = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,9);

// --- Precios escalables ---
const PRICES = {
  basic: 2000,       // $20
  premium: [5000,25000],  // $50-$250
  corporate: [50000,150000], // $500-$1500
  hospital: [40000,100000], // $400-$1000
  vip: 500000        // $5000
};

// --- Rutas ---
app.get('/health',(req,res)=>res.json({ok:true}));

// --- Checkout sesión general ---
app.post('/create-checkout-session', async(req,res)=>{
  try{
    const { amount, description='Frecuencia Central - Servicio', metadata={} } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types:['card'],
      line_items:[{
        price_data:{
          currency:'usd',
          product_data:{name:description},
          unit_amount:parseInt(amount,10)
        },
        quantity:1
      }],
      mode:'payment',
      metadata,
      success_url:`${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${req.headers.origin}/cancel.html`
    });
    res.json({url:session.url, id:session.id});
  }catch(err){ res.status(500).json({error:err.message}); }
});

// --- Webhook Stripe ---
app.post('/webhook', bodyParser.raw({type:'application/json'}), async(req,res)=>{
  const sig = req.headers['stripe-signature'];
  try{
    const event = stripe.webhooks.constructEvent(req.body,sig,process.env.STRIPE_WEBHOOK_SECRET);
    if(event.type==='checkout.session.completed'){
      const session = event.data.object;
      const actionType = session.metadata?.actionType || 'unknown';
      const refId = session.metadata?.refId || null;

      const userKey = session.customer_email || session.payment_intent;

      // Limitar a 1 sesión por tarjeta por día
      const today = new Date().toISOString().slice(0,10);
      if(!DB.dailyLimits[today]) DB.dailyLimits[today]={};
      if(!DB.dailyLimits[today][userKey]) DB.dailyLimits[today][userKey]=0;
      DB.dailyLimits[today][userKey]++;

      if(DB.dailyLimits[today][userKey]>1){
        console.log('Usuario ya realizó sesión hoy');
        return res.json({received:true,message:'Limite diario alcanzado'});
      }

      // Manejo pagos
      if(actionType==='full_session'){
        const s = {
          id: uid(),
          type:'full_session',
          amount:session.amount_total,
          currency:session.currency,
          paid:true,
          stripeSessionId:session.id,
          created:Date.now(),
          mood:session.metadata?.mood||'unknown',
          voice:session.metadata?.voice||'Miguel',
          sessionType:session.metadata?.sessionType||'basic',
          expiresAt:Date.now() + 20*60*1000
        };
        DB.sessions.push(s);
        await saveDB();
      } else if(actionType==='vip_initial'){
        const vip = {
          id:uid(),
          phase:'initial_paid',
          paidAmount:session.amount_total,
          stripeSessionId:session.id,
          created:Date.now(),
          complete:false,
          ref:session.metadata?.refId || uid(),
          voice:session.metadata?.voice||'Miguel'
        };
        DB.vipSessions.push(vip);
        await saveDB();
      } else if(actionType==='vip_donation'){
        const ref = session.metadata?.refId || null;
        let vip = ref ? DB.vipSessions.find(v=>v.ref===ref && !v.complete) : null;
        if(!vip) vip=DB.vipSessions.reverse().find(v=>v.phase==='initial_paid' && !v.complete);
        if(vip){
          vip.paidAmount=(vip.paidAmount||0)+session.amount_total;
          vip.phase='complete';
          vip.complete=true;
          vip.completedAt=Date.now();
          const s={
            id:uid(),
            type:'vip_full',
            amount:vip.paidAmount,
            currency:session.currency,
            paid:true,
            stripeSessionId:session.id,
            created:Date.now(),
            voice:vip.voice,
            ref:vip.ref,
            expiresAt:Date.now() + 1000*60*60*2
          };
          DB.sessions.push(s);
          await saveDB();
        }
      } else {
        const s={
          id:uid(),
          type:'payment_other',
          amount:session.amount_total,
          currency:session.currency,
          stripeSessionId:session.id,
          created:Date.now()
        };
        DB.sessions.push(s);
        await saveDB();
      }
    }
    res.json({received:true});
  }catch(err){ console.error('Webhook error:',err.message); res.status(400).send(`Webhook Error: ${err.message}`);}
});

// --- AI Response ---
app.post('/ai-response', async(req,res)=>{
  try{
    const { prompt, voice='Miguel' } = req.body;
    // Primero Gemini
    let gRes = await fetch('https://api.generative.google/v1beta1/text:synthesize',{
      method:'POST',
      headers:{ 'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`, 'Content-Type':'application/json'},
      body: JSON.stringify({ input:{text:prompt}, voice:{name:voice==='Maria'?'female-1':'male-1',languageCode:'es-ES'}, audioConfig:{audioEncoding:'MP3'} })
    });
    let audioData=null;
    if(gRes.ok){
      const gJson=await gRes.json();
      audioData=gJson.audioContent || gJson.audio || '';
    } else {
      // Fallback OpenAI
      const openaiRes = await fetch('https://api.openai.com/v1/audio/speech',{
        method:'POST',
        headers:{ 'Authorization':`Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type':'application/json' },
        body:JSON.stringify({ input:prompt, voice:voice==='Maria'?'alloy':'miguel', format:'mp3' })
      });
      if(openaiRes.ok){
        const openJson = await openaiRes.json();
        audioData=openJson.audio || '';
      } else return res.status(500).json({error:'Error TTS', details:await openaiRes.text()});
    }

    const buffer = Buffer.from(audioData,'base64');
    const filename = `tts_${Date.now()}_${Math.random().toString(36).slice(2,8)}.mp3`;
    const filePath = path.join(PUBLIC_DIR,'audio',filename);
    await fs.writeFile(filePath,buffer);
    res.json({audio_url:`/audio/${filename}`, file:filename, prompt});
  }catch(err){ console.error('AI response error',err); res.status(500).json({error:err.message});}
});

// --- Admin DB ---
app.get('/admin/db', async(req,res)=>res.json(DB));

// --- Señales de cierre ---
process.on('SIGINT', async()=>{await saveDB();process.exit();});
process.on('SIGTERM', async()=>{await saveDB();process.exit();});

// --- Arranque ---
app.listen(PORT,()=>console.log(`Servidor Frecuencia Central en puerto ${PORT}`));
