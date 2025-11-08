// server.js
import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';

const __dirname = path.resolve();
const app = express();
const PORT = process.env.PORT || 10000;

// Claves en Render
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY_RENDER;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY_RENDER;
const JWT_SECRET = process.env.JWT_SECRET_RENDER || 'mi_secreto_temporal';

const stripe = new Stripe(STRIPE_SECRET_KEY);

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());

// Tokens para sesiones temporales y control de uso
const sessions = {};
const FREE_DURATION = 8; // 8 segundos gratis
const MAX_DURATION = 20 * 60; // 20 minutos max

// Limitar sesiones activas
let activeSessions = 0;
const MAX_ACTIVE_SESSIONS = 10;

function generateToken(sessionId, durationSec) {
  return jwt.sign({ sessionId, exp: Math.floor(Date.now() / 1000) + durationSec }, JWT_SECRET);
}

// Endpoint para sesión gratuita inicial por tarjeta (8s)
app.post('/start-free-session', (req, res) => {
  const { cardId } = req.body;
  if (!cardId) return res.status(400).json({ error: 'cardId obligatorio' });
  if (sessions[cardId]?.usedFree) return res.status(403).json({ error: 'Ya usaste la prueba gratis con esta tarjeta' });

  const sessionId = `free_${Date.now()}`;
  const token = generateToken(sessionId, FREE_DURATION);
  sessions[cardId] = { token, usedFree: true, start: Date.now() };
  activeSessions++;
  res.json({ token, duration: FREE_DURATION });
});

// Endpoint para crear sesión premium
app.post('/create-session', async (req, res) => {
  const { cardId, amount, description } = req.body;
  if (activeSessions >= MAX_ACTIVE_SESSIONS) return res.status(429).json({ error: 'Sistema saturado. Intenta luego.' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: { currency: 'usd', product_data: { name: description }, unit_amount: amount },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.headers.origin}/?success=true`,
      cancel_url: `${req.headers.origin}/?canceled=true`
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'No se pudo crear sesión de pago' });
  }
});

// Endpoint IA emocional + música + vibraciones
app.post('/ai-session', (req, res) => {
  const { prompt, lang = 'es' } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt obligatorio' });

  // Simulación IA (Gemini + fallback OpenAI)
  let emotion = 'neutral';
  if (/asustado|miedo|ansiedad/.test(prompt)) emotion = 'miedo';
  if (/dinero|abundancia|éxito/.test(prompt)) emotion = 'dinero';
  if (/amor|pareja|deseo/.test(prompt)) emotion = 'amor';
  if (/duelo|tristeza|pérdida/.test(prompt)) emotion = 'duelo';
  if (/energía|aburrimiento/.test(prompt)) emotion = 'energia';
  if (/seguridad|confianza/.test(prompt)) emotion = 'seguridad';
  if (/dormir|sueño/.test(prompt)) emotion = 'sueño';

  // Música + sonido natural + binaurales simulados
  const audioMap = {
    neutral: '/audio/mood_neutral.mp3',
    miedo: '/audio/mood_sad.mp3',
    dinero: '/audio/mood_success.mp3',
    amor: '/audio/mood_love.mp3',
    duelo: '/audio/mood_duelo.mp3',
    energia: '/audio/mood_energia.mp3',
    seguridad: '/audio/mood_seguridad.mp3',
    sueño: '/audio/mood_sueño.mp3'
  };

  const messages = {
    es: {
      miedo: 'Siento tu miedo. Vamos a acompañarlo con olas suaves y pad cálido.',
      dinero: 'Entiendo tu necesidad de prosperar. Vamos a abrir espacio y claridad con melodía motivadora.',
      amor: 'Percibo tu deseo de conexión. Activamos sonidos cálidos y vibraciones suaves.',
      duelo: 'Sé que atraviesas una pérdida. Prepararemos sonidos consoladores y guía emocional.',
      energia: 'Activamos música alegre y naturaleza viva para reactivar tu energía.',
      seguridad: 'Crearemos sensación de estabilidad con acordes graves y latidos regulares.',
      sueño: 'Te ayudamos a relajarte con pads largos y sonidos suaves para dormir.',
      neutral: 'Vamos a equilibrar tus emociones con sonidos armoniosos y guía calmante.'
    },
    en: {
      miedo: 'I sense your fear. We will accompany it with soft waves and warm pad.',
      dinero: 'I understand your need to prosper. Let’s open space and clarity with motivational melody.',
      amor: 'I sense your desire for connection. Activating warm sounds and gentle vibrations.',
      duelo: 'I know you are experiencing loss. We will prepare consoling sounds and emotional guidance.',
      energia: 'Activating joyful music and lively nature sounds to reactivate your energy.',
      seguridad: 'We create stability sensation with deep chords and steady heartbeat.',
      sueño: 'We help you relax with long pads and soft sounds for sleep.',
      neutral: 'We will balance your emotions with harmonious sounds and calming guidance.'
    }
  };

  res.json({ 
    audio_url: audioMap[emotion] || audioMap['neutral'], 
    message: messages[lang]?.[emotion] || messages['es']['neutral'], 
    emotion 
  });
});

app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
