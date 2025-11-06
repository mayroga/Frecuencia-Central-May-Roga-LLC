// server.js
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import Stripe from 'stripe';
import fs from 'fs-extra';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 5000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PUBLIC_DIR = path.join(process.cwd(), 'public');
await fs.ensureDir(path.join(PUBLIC_DIR, 'data'));

const SESSIONS_FILE = path.join(PUBLIC_DIR, 'data', 'sessions.json');
let DB = { sessions: [], vipSessions: [], dailyLimits: {} };
if(await fs.pathExists(SESSIONS_FILE)){
  try { DB = await fs.readJson(SESSIONS_FILE); } catch(e){ DB = { sessions: [], vipSessions: [], dailyLimits: {} }; }
}
const saveDB = async () => { await fs.writeJson(SESSIONS_FILE, DB, { spaces: 2 }); };

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,9);

// Health
app.get('/health', (req,res) => res.json({ ok: true }));

// Stripe Checkout
app.post('/create-checkout-session', async (req,res) => {
  try {
    const { amount, currency='usd', description='Frecuencia Central - Servicio', metadata={} } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types:['card'],
      line_items:[{
        price_data:{ currency, product_data:{ name: description }, unit_amount: parseInt(amount,10) },
        quantity:1
      }],
      mode:'payment',
      metadata,
      success_url:`${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${req.headers.origin}/cancel.html`,
    });
    res.json({ url: session.url, id: session.id });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// Webhook
app.post('/webhook', bodyParser.raw({type:'application/json'}), async (req,res)=>{
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    if(event.type==='checkout.session.completed'){
      const session = event.data.object;
      const s = { id: uid(), type:'payment', amount:session.amount_total, currency:session.currency, stripeSessionId: session.id, created: Date.now() };
      DB.sessions.push(s);
      await saveDB();
    }
    res.json({ received:true });
  } catch(err){
    console.error('Webhook error:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// Admin DB
app.get('/admin/db', async (req,res)=>res.json(DB));

process.on('SIGINT', async ()=>{ await saveDB(); process.exit(); });
process.on('SIGTERM', async ()=>{ await saveDB(); process.exit(); });

app.listen(PORT, ()=>console.log(`Server listening on port ${PORT}`));
