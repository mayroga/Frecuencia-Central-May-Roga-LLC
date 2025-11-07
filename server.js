// File: server.js
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

// --- Asegura carpetas sin romper deploy ---
try {
  await fs.ensureDir(path.join(PUBLIC_DIR, 'audio'));
  await fs.ensureDir(path.join(PUBLIC_DIR, 'data'));
} catch (err) {
  console.log('Carpetas ya existen, continuando...');
}

// --- Base de datos simple ---
const SESSIONS_FILE = path.join(PUBLIC_DIR, 'data', 'sessions.json');
let DB = { sessions: [], vipSessions: [], dailyLimits: {} };

if (await fs.pathExists(SESSIONS_FILE)) {
  try { DB = await fs.readJson(SESSIONS_FILE); } 
  catch(e) { DB = { sessions: [], vipSessions: [], dailyLimits: {} }; }
}

const saveDB = async () => { await fs.writeJson(SESSIONS_FILE, DB, { spaces: 2 }); };

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

// --- Utilidades ---
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,9);

// --- Rutas ---
app.get('/health', (req,res) => res.json({ ok: true }));

// Stripe checkout sessions
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { amount, currency='usd', description='Frecuencia Central - Servicio', metadata={} } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency,
          product_data: { name: description },
          unit_amount: parseInt(amount,10)
        },
        quantity: 1
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

// Webhook Stripe
app.post('/webhook', bodyParser.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const actionType = session.metadata?.actionType || 'unknown';
      const refId = session.metadata?.refId || null;

      // Manejo de pagos
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
          expiresAt: Date.now() + (20*60*1000) // 20 min
        };
        DB.sessions.push(s);
        await saveDB();
      } else if(actionType==='vip_initial') {
        const vip = {
          id: uid(),
          phase: 'initial_paid',
          paidAmount: session.amount_total,
          stripeSessionId: session.id,
          created: Date.now(),
          complete: false,
          ref: session.metadata?.refId || uid()
        };
        DB.vipSessions.push(vip);
        await saveDB();
      } else if(actionType==='vip_donation') {
        const ref = session.metadata?.refId || null;
        let vip = ref ? DB.vipSessions.find(v=>v.ref===ref && !v.complete) : null;
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
            expiresAt: Date.now() + (1000*60*60*2) // 2 horas
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

// TTS / AI via Gemini
app.post('/ai-response', async (req, res) => {
  try {
    const { prompt, voice='Miguel' } = req.body;
    const gRes = await fetch('https://api.generative.google/v1beta1/text:synthesize', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
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
    res.json({ audio_url: publicUrl, file: filename, prompt });
  } catch (err) {
    console.error('AI response error', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoint
app.get('/admin/db', async (req, res) => res.json(DB));

// --- Señales de cierre ---
process.on('SIGINT', async () => { await saveDB(); process.exit(); });
process.on('SIGTERM', async () => { await saveDB(); process.exit(); });

// --- Arranque del servidor ---
app.listen(PORT, () => console.log(`Servidor Frecuencia Central en puerto ${PORT}`));
