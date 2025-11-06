// File: server.js
// Backend completo (Node.js + Express) - integra Stripe, webhook, Gemini TTS, gestión de sesiones y VIP.
// Requisitos: Node 18+, npm install express stripe body-parser cors node-fetch fs-extra

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

// Static public
const PUBLIC_DIR = path.join(process.cwd(), 'public');
await fs.ensureDir(path.join(PUBLIC_DIR, 'audio'));
await fs.ensureDir(path.join(PUBLIC_DIR, 'data'));

// Simple persistent storage (JSON file)
const SESSIONS_FILE = path.join(PUBLIC_DIR, 'data', 'sessions.json');
let DB = { sessions: [], vipSessions: [], dailyLimits: {} };
if(await fs.pathExists(SESSIONS_FILE)) {
  try { DB = await fs.readJson(SESSIONS_FILE); } catch(e){ DB = { sessions: [], vipSessions: [], dailyLimits: {} }; }
}
const saveDB = async () => { await fs.writeJson(SESSIONS_FILE, DB, { spaces: 2 }); };

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

// Utilities
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,9);
const TODAY_KEY = () => {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()+1}-${d.getUTCDate()}`;
};

// --- Routes ---

// Health
app.get('/health', (req,res) => res.json({ ok: true }));

// Root serves index.html via static

// Create Stripe Checkout Session (generic for any amount)
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { amount, currency='usd', description='Frecuencia Central - Servicio', metadata={} } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency,
          product_data: { name: description },
          unit_amount: parseInt(amount,10),
        },
        quantity: 1,
      }],
      mode: 'payment',
      metadata,
      success_url: `${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel.html`,
    });
    res.json({ url: session.url, id: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook endpoint - set Stripe webhook secret in RENDER env STRIPE_WEBHOOK_SECRET
app.post('/webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const actionType = session.metadata?.actionType || 'unknown';
      const refId = session.metadata?.refId || null;

      if(actionType === 'full_session') {
        const s = {
          id: uid(),
          type: 'full_session',
          amount: session.amount_total,
          currency: session.currency,
          paid: true,
          stripeSessionId: session.id,
          created: Date.now(),
          mood: session.metadata?.mood || 'unknown',
          voice: session.metadata?.voice || 'Miguel',
          userRef: refId || uid(),
          expiresAt: Date.now() + (20 * 60 * 1000)
        };
        DB.sessions.push(s);
        await saveDB();
      } else if(actionType === 'vip_initial') {
        const vip = {
          id: uid(),
          phase: 'initial_paid',
          paidAmount: session.amount_total,
          stripeSessionId: session.id,
          created: Date.now(),
          complete: false,
          ref: session.metadata?.refId || uid(),
        };
        DB.vipSessions.push(vip);
        await saveDB();
      } else if(actionType === 'vip_donation') {
        const ref = session.metadata?.refId || null;
        let vip = null;
        if(ref) vip = DB.vipSessions.find(v=>v.ref===ref && !v.complete);
        if(!vip) vip = DB.vipSessions.reverse().find(v=>v.phase==='initial_paid' && !v.complete);
        if(vip){
          vip.paidAmount = (vip.paidAmount||0) + session.amount_total;
          vip.phase = 'complete';
          vip.complete = true;
          vip.completedAt = Date.now();
          const s = {
            id: uid(),
            type: 'vip_full',
            amount: vip.paidAmount,
            currency: session.currency,
            paid: true,
            stripeSessionId: session.id,
            created: Date.now(),
            voice: vip.voice || 'Miguel',
            ref: vip.ref,
            expiresAt: Date.now() + (1000*60*60*2)
          };
          DB.sessions.push(s);
          await saveDB();
        }
      } else {
        const s = {
          id: uid(),
          type: 'payment_other',
          amount: session.amount_total,
          currency: session.currency,
          stripeSessionId: session.id,
          created: Date.now()
        };
        DB.sessions.push(s);
        await saveDB();
      }
    }
    res.json({received:true});
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// --- AI / TTS Gemini SOLO AL PRESIONAR PLAY ---
app.post('/ai-response', async (req, res) => {
  try {
    const { prompt, voice='Miguel', longForm=false } = req.body;

    // Solo genera audio cuando el usuario presiona "play"
    const gRes = await fetch('https://api.generative.google.com/v1beta1/text:synthesize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: { text: prompt },
        voice: { name: voice==='Maria' ? 'female-1' : 'male-1', languageCode: 'es-ES' },
        audioConfig: { audioEncoding: 'MP3' }
      })
    });

    if(!gRes.ok){
      const errText = await gRes.text();
      return res.status(500).json({ error: 'Gemini TTS error', details: errText });
    }

    const gJson = await gRes.json();
    const base64 = gJson.audioContent || gJson.audio || '';
    const buffer = Buffer.from(base64, 'base64');
    const filename = `tts_${Date.now()}_${Math.random().toString(36).slice(2,8)}.mp3`;
    const filePath = path.join(PUBLIC_DIR, 'audio', filename);
    await fs.writeFile(filePath, buffer);
    const publicUrl = `/audio/${filename}`;

    const conv = { id: uid(), prompt, voice, audio: publicUrl, created: Date.now() };
    DB.sessions.push({ conv });
    await saveDB();

    res.json({ audio_url: publicUrl, file: filename, prompt });
  } catch (err) {
    console.error('AI response error', err);
    res.status(500).json({ error: err.message });
  }
});

// --- VIP Checkout ---
app.post('/create-vip-checkout', async (req, res) => {
  try {
    const { step='initial', ref=null, currency='usd' } = req.body;
    if(step==='initial'){
      const amount=1000000;
      const refId = ref||uid();
      const session = await stripe.checkout.sessions.create({
        payment_method_types:['card'],
        line_items:[{ price_data:{ currency, product_data:{ name:'VIP Ultra - initial $10k'}, unit_amount:amount}, quantity:1}],
        mode:'payment',
        metadata:{ actionType:'vip_initial', refId },
        success_url:`${req.headers.origin}/success.html`,
        cancel_url:`${req.headers.origin}/cancel.html`
      });
      res.json({ url:session.url, refId });
    } else if(step==='donation'){
      const amount=500000;
      const refId = ref;
      const session = await stripe.checkout.sessions.create({
        payment_method_types:['card'],
        line_items:[{ price_data:{ currency, product_data:{ name:'VIP Ultra - donation $5k'}, unit_amount:amount}, quantity:1}],
        mode:'payment',
        metadata:{ actionType:'vip_donation', refId },
        success_url:`${req.headers.origin}/success.html`,
        cancel_url:`${req.headers.origin}/cancel.html`
      });
      res.json({ url:session.url, refId });
    } else {
      res.status(400).json({ error:'Invalid VIP step' });
    }
  } catch(err){ res.status(500).json({ error: err.message }); }
});

// --- Micro-upsell checkout ---
app.post('/create-upsell-checkout', async (req,res)=>{
  try{
    const { type='2min', currency='usd', mood='general', voice='Miguel' }=req.body;
    let amount=1000, desc='Micro-upsell 2 min';
    if(type==='5min'){ amount=5000; desc='Micro-upsell 5 min'; }
    if(type==='unlimited'){ amount=50000; desc='Sesion extra ilimitada'; }
    const session=await stripe.checkout.sessions.create({
      payment_method_types:['card'],
      line_items:[{ price_data:{ currency, product_data:{ name:desc }, unit_amount:amount }, quantity:1 }],
      mode:'payment',
      metadata:{ actionType:'upsell', type, mood, voice },
      success_url:`${req.headers.origin}/success.html`,
      cancel_url:`${req.headers.origin}/cancel.html`
    });
    res.json({ url:session.url });
  } catch(err){ res.status(500).json({ error: err.message }); }
});

// --- Admin / debug ---
app.get('/admin/db', async (req,res)=>{ res.json(DB); });

// Graceful shutdown save
process.on('SIGINT', async()=>{ await saveDB(); process.exit(); });
process.on('SIGTERM', async()=>{ await saveDB(); process.exit(); });

app.listen(PORT, ()=>console.log(`Server listening on port ${PORT}`));
