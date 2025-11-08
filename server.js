// ======================= server.js =======================
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import Stripe from 'stripe';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

// --- CLAVES EN RENDER (nunca .env) ---
const STRIPE_SECRET_KEY = 'tu_stripe_secret_key_aqui';
const JWT_SECRET = 'clave_jwt_para_tokens_temporales';

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-08-16' });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== Generar token temporal para sesiones premium =====
function generateToken(data, expiresIn = '20m') {
  if (!JWT_SECRET) throw new Error('secretOrPrivateKey must have a value');
  return jwt.sign(data, JWT_SECRET, { expiresIn });
}

// ===== Stripe Checkout =====
app.post('/create-checkout-session', async (req, res) => {
  const { amount, description, metadata } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price_data: { currency: 'usd', product_data: { name: description }, unit_amount: amount }, quantity: 1 }],
      mode: 'payment',
      success_url: `${req.headers.origin}/?session=success`,
      cancel_url: `${req.headers.origin}/?session=cancel`,
      metadata
    });
    res.json({ url: session.url });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== AI Response (Gemini/OpenAI placeholder) =====
app.post('/ai-response', async (req, res) => {
  const { prompt, voice } = req.body;
  // Aquí integrarías Gemini/OpenAI real
  // Respuesta simulada:
  res.json({ audio_url: `/audio/mood_success.mp3`, message: `IA responde: ${prompt}` });
});

// ===== HTML catch-all =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));


// ======================= public/app.js =======================
const freeBtn = document.getElementById('freeBtn');
const fullBtn = document.getElementById('fullBtn');
const vipBtn = document.getElementById('vipBtn');
const moodEl = document.getElementById('mood');
const intensityEl = document.getElementById('intensity');
const sessionTypeEl = document.getElementById('sessionType');
const userTextEl = document.getElementById('userText');
const playBtn = document.getElementById('playBtn');
const audioContainer = document.getElementById('audioContainer');
const chatEl = document.getElementById('chat');

// === Modo desarrollador solo para ti ===
const isDevUser = window.location.href.includes('dev=true');
let testAccessActive = false;

if (isDevUser) {
  testAccessActive = true;
  logChat('Sistema', 'Modo desarrollador activo: acceso completo por 5 minutos.');
  setTimeout(() => {
    testAccessActive = false;
    logChat('Sistema', 'Modo desarrollador expirado.');
  }, 5 * 60 * 1000);
}

// === Audio map ===
const audioMap = {
  mood: { love:'/audio/mood_love.mp3', calm:'/audio/mood_calm.mp3', success:'/audio/mood_success.mp3', sad:'/audio/mood_sad.mp3', neutral:'/audio/mood_neutral.mp3' },
  vip: { love:'/audio/vip_love.mp3', calm:'/audio/vip_calm.mp3', success:'/audio/vip_success.mp3', sad:'/audio/vip_sad.mp3', neutral:'/audio/vip_neutral.mp3' }
};

function logChat(sender, text){
  const p = document.createElement('div');
  p.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatEl.appendChild(p);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function playMoodAudio(mood, type='mood'){
  const src = audioMap[type][mood];
  if (!src) return;
  const audio = new Audio(src);
  audio.volume = intensityEl.value / 100;
  audio.play();
  return audio;
}

// === Sesión gratuita 8s para usuarios normales, 5min para dev ===
freeBtn.onclick = () => {
  const mood = moodEl.value;
  const type = sessionTypeEl.value;
  logChat('Sistema', `Iniciando sesión gratuita para estado ${mood} y sesión ${type}`);
  
  const audio = playMoodAudio(mood, testAccessActive ? 'vip' : 'mood');
  
  setTimeout(() => {
    if(audio) audio.pause();
    logChat('Sistema', testAccessActive ? 'Sesión de desarrollo finalizada (5min).' : 'Sesión gratuita finalizada (8s).');
  }, testAccessActive ? 5*60*1000 : 8000);
};

// === Sesión completa Stripe ===
fullBtn.onclick = async () => {
  const mood = moodEl.value;
  const type = sessionTypeEl.value;
  let amount = 0;
  switch(type){
    case 'private': amount=2000; break;
    case 'personalized': amount=5000; break;
    case 'group': amount=10000; break;
    case 'corporate': amount=50000; break;
    case 'hospital': amount=40000; break;
    default: amount=2000;
  }
  try{
    const res = await fetch('/create-checkout-session',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ amount, description:`Sesión completa ${mood}`, metadata:{actionType:'full_session', mood, voice:'Miguel', sessionType:type} })
    });
    const data = await res.json();
    if(data.url) window.location.href = data.url;
    else logChat('Error','No se pudo iniciar pago');
  }catch(err){
    logChat('Error',err.message);
  }
};

// === Sesión VIP Stripe ===
vipBtn.onclick = async () => {
  const type = sessionTypeEl.value;
  try{
    const res = await fetch('/create-vip-checkout',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({step:'initial', sessionType:type})
    });
    const data = await res.json();
    if(data.url) window.location.href = data.url;
    else logChat('Error','No se pudo iniciar VIP');
  }catch(err){
    logChat('Error',err.message);
  }
};

// === Chat IA ===
async function sendAIMessage(){
  const text = userTextEl.value.trim();
  if(!text) return alert('Escribe algo primero');
  logChat('Usuario', text);
  const mood = moodEl.value;
  const type = testAccessActive ? 'vip' : 'mood';
  playMoodAudio(mood,type);
  try{
    const res = await fetch('/ai-response',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({prompt:text, voice:'Miguel'})
    });
    const data = await res.json();
    if(data.audio_url){
      audioContainer.innerHTML = `<audio controls autoplay src="${data.audio_url}"></audio>`;
      logChat('Sistema', 'Respuesta de IA generada y reproducida.');
    }else{
      logChat('Sistema','Error generando audio de IA');
    }
  }catch(err){
    logChat('Error',err.message);
  }
}
playBtn.addEventListener('click', sendAIMessage);
