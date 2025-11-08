import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import jwt from "jsonwebtoken";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Stripe y OpenAI
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuración de sesiones
const MAX_SESSIONS = 10;
let activeSessions = 0;

// Tokens JWT
const generateToken = (payload) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "25m" });
const verifyToken = (token) => {
  try { return jwt.verify(token, process.env.JWT_SECRET); }
  catch { return null; }
};

// Limite de sesiones simultaneas
const sessionLimiter = (req, res, next) => {
  if(activeSessions >= MAX_SESSIONS) return res.status(429).json({ error: "Máximo de sesiones activas alcanzado" });
  activeSessions++;
  res.on("finish", () => { activeSessions--; });
  next();
};

// Mapa de emociones a sonidos, instrumentos y vibraciones
const emotionProfiles = {
  miedo: { naturaleza: ["lluvia suave","mar lejano","latido lento"], instrumentos:["pad cálido","cello grave","flauta baja"], bpm:[40,60], binaural:"4-7Hz", vibration:[20,220,20] },
  tristeza: { naturaleza:["lluvia tenue","hojas cayendo"], instrumentos:["cello","piano lento","coros etéreos"], bpm:[30,50], binaural:"3-5Hz", vibration:[40,150,40] },
  soledad: { naturaleza:["brisa nocturna"], instrumentos:["pad etéreo","guitarra suave"], bpm:[35,55], binaural:"3-5Hz", vibration:[30,100,30] },
  alegria: { naturaleza:["cantos de aves","río"], instrumentos:["guitarra rítmica","percusión ligera","synth alegre"], bpm:[100,130], binaural:"10Hz", vibration:[70,40,70,40,200] },
  motivacion: { naturaleza:["viento en pinos"], instrumentos:["piano arpegios","cuerdas ascendentes"], bpm:[60,80], binaural:"6-9Hz", vibration:[70,40,70,40,200] },
  amor: { naturaleza:["lluvia fina","coros etéreos"], instrumentos:["guitarra jazz","sax suave","piano mayor/7"], bpm:[60,70], binaural:"6Hz", vibration:[120,60,120,120] },
  dinero: { naturaleza:["ambiente urbano suave","campanas distantes"], instrumentos:["piano bajo marcado","cuerdas tensas con resolución positiva"], bpm:[90,110], binaural:"6-9Hz", vibration:[70,40,70,40,200] },
  exito: { naturaleza:["café lejano","suave ambiente estudio"], instrumentos:["pads claros","piano tempo medio","arpegios binaurales 10Hz"], bpm:[80,100], binaural:"10Hz", vibration:[100,80,100] },
  seguridad: { naturaleza:["fuego hogar suave"], instrumentos:["cuerdas ostinato grave"], bpm:[50,60], binaural:"4-6Hz", vibration:[100,80,100] },
  sueño: { naturaleza:["olas suaves","grillos nocturnos","viento en hojas"], instrumentos:["pads largos","arpegios lentos"], bpm:[30,50], binaural:"1-4Hz", vibration:[20,220,20] },
  deseo: { naturaleza:["ambiente natural sutil"], instrumentos:["piano suave","cuerdas etéreas"], bpm:[60,80], binaural:"6Hz", vibration:[70,40,70,40,200] }
};

// Detectar emoción (IA)
const detectEmotion = async (text) => {
  const response = await openai.chat.completions.create({
    model:"gpt-5-mini",
    messages:[
      { role:"system", content:"Detecta emoción y necesidad: miedo, tristeza, soledad, alegría, motivacion, amor, dinero, exito, seguridad, sueño, deseo" },
      { role:"user", content:text }
    ]
  });
  return response.choices[0].message.content.toLowerCase();
};

// Generar respuesta empática IA
const generateAIResponse = async (text, emotion, lang="es") => {
  const prompt = `
Usuario: "${text}"
Emoción detectada: "${emotion}"
Responde con empatía, guía emocional y explica música, sonidos naturales y vibración. 
Duración sugerida: 8-20 min. Responde en ${lang}.
`;
  const response = await openai.chat.completions.create({
    model:"gpt-5-mini",
    messages:[{role:"user", content:prompt}]
  });
  return response.choices[0].message.content;
};

// Detección de idioma simple
const detectLanguage = (text) => {
  // Aquí se podría integrar librería Intl o Google API; fallback simplificado:
  if(/[áéíóúñ]/i.test(text)) return "es";
  if(/[a-zA-Z]/i.test(text)) return "en";
  return "es";
};

// Stripe - crear sesión de pago
app.post("/api/payment", async (req,res)=>{
  try {
    const { category, amount } = req.body;
    const session = await stripe.checkout.sessions.create({
      payment_method_types:["card"],
      line_items:[{
        price_data:{ currency:"usd", product_data:{ name:`Frecuencia Central - ${category}` }, unit_amount: amount*100 },
        quantity:1
      }],
      mode:"payment",
      success_url:`${req.headers.origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${req.headers.origin}/?canceled=true`
    });
    const token = generateToken({ sessionId:session.id, category });
    res.json({ url:session.url, token });
  } catch(e){ console.error(e); res.status(500).json({error:"Error creando sesión Stripe"});}
});

// Iniciar sesión emocional
app.post("/api/session/start", sessionLimiter, async (req,res)=>{
  const { userInput, token, freeTrial=false } = req.body;
  const access = verifyToken(token);
  if(!access) return res.status(403).json({ error:"Acceso no autorizado o expirado" });

  try {
    const lang = detectLanguage(userInput);
    const emotion = await detectEmotion(userInput);
    const profile = emotionProfiles[emotion] || emotionProfiles["motivacion"];
    const aiMessage = await generateAIResponse(userInput, emotion, lang);

    // Ajustes de duración
    let duration = freeTrial ? 8 : 20*60; // 8 segundos gratis o hasta 20 min en segundos

    res.json({ emotion, profile, aiMessage, duration });
  } catch(e){
    console.error(e);
    res.status(500).json({ error:"Error iniciando sesión emocional" });
  }
});

// Ruta principal
app.get("/", (req,res)=>res.send("Frecuencia Central – Human Resonance Experience Running"));

// Configuración de puerto
const PORT = process.env.PORT || 5000;
app.listen(PORT, ()=>console.log(`Server escuchando en puerto ${PORT}`));
