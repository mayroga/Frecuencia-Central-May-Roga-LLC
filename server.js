// server.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import Stripe from 'stripe';
import fs from 'fs-extra';
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Stripe setup
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Middlewares
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Configuración de sesiones activas y tokens
let activeSessions = []; // máximo 10 simultáneas
const MAX_SESSIONS = 10;

// Mapa de sonidos y vibraciones según necesidad
const audioMap = {
  miedo: { sounds: ['/audio/miedo1.mp3'], vibration: [20,220,20] },
  dinero: { sounds: ['/audio/dinero1.mp3'], vibration: [60,40,60,40,200] },
  energia: { sounds: ['/audio/energia1.mp3'], vibration: [70,40,70,40,200] },
  amor: { sounds: ['/audio/amor1.mp3'], vibration: [120,60,120,120] },
  duelo: { sounds: ['/audio/duelo1.mp3'], vibration: [40,150,40] },
  sueño: { sounds: ['/audio/sueno1.mp3'], vibration: [10,50,10] },
  seguridad: { sounds: ['/audio/seguridad1.mp3'], vibration: [100,80,100] },
  // agregar más según mapa que enviaste
};

// Función para generar token temporal
function generateToken(sessionId) {
  return jwt.sign({ sessionId }, process.env.JWT_SECRET, { expiresIn: '30m' });
}

// Función para validar acceso y límites
function canStartSession(sessionId) {
  return activeSessions.length < MAX_SESSIONS && !activeSessions.includes(sessionId);
}

// Endpoint: crear sesión gratuita
app.post('/free-session', (req, res) => {
  const { userToken } = req.body;
  if (!canStartSession(userToken)) {
    return res.status(429).json({ error: 'Máximo de sesiones activas alcanzado' });
  }
  activeSessions.push(userToken);
  setTimeout(() => {
    activeSessions = activeSessions.filter(s => s !== userToken);
  }, 8000); // 8 segundos de sesión gratuita
  const token = generateToken(userToken);
  res.json({ token, duration: 8, message: 'Sesión gratuita iniciada' });
});

// Endpoint: crear sesión de pago
app.post('/create-checkout-session', async (req, res) => {
  try {
    const { amount, description, metadata } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: description },
          unit_amount: amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.headers.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel`,
      metadata,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: IA emocional / respuesta
app.post('/ai-response', async (req, res) => {
  try {
    const { prompt, voice } = req.body;
    // Lógica: Gemini + OpenAI fallback
    let aiResponse = '';
    try {
      // Aquí llamas a Gemini si disponible
      const geminiResp = await fetch('https://api.gemini.ai/respond', {
        method:'POST',
        headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${process.env.GEMINI_KEY}`},
        body: JSON.stringify({ prompt, voice })
      });
      const geminiData = await geminiResp.json();
      aiResponse = geminiData.text || '';
    } catch {
      // fallback OpenAI
      const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},
        body: JSON.stringify({
          model: "gpt-4",
          messages:[{role:"user", content:prompt}]
        })
      });
      const openaiData = await openaiResp.json();
      aiResponse = openaiData.choices[0].message.content;
    }

    // Simular URL de audio (para reproducción)
    const audioUrl = `/audio/generated_${Date.now()}.mp3`;

    // Guardar audio dummy (en producción aquí iría TTS real)
    await fs.writeFile(`./public${audioUrl}`, ''); // placeholder

    res.json({ text: aiResponse, audio_url: audioUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: obtener mapa de audio/vibraciones según necesidad
app.get('/map/:need', (req, res) => {
  const { need } = req.params;
  const data = audioMap[need.toLowerCase()];
  if (!data) return res.status(404).json({ error: 'Necesidad no encontrada' });
  res.json(data);
});

// Endpoint: token validación sesión premium
app.post('/validate-session', (req, res) => {
  const { token } = req.body;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ valid: true, sessionId: decoded.sessionId });
  } catch {
    res.json({ valid: false });
  }
});

// Iniciar servidor
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
