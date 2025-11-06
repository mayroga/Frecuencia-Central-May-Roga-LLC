import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import fs from "fs-extra";
import Stripe from "stripe";
import bodyParser from "body-parser";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Directorio de audios pregrabados
const AUDIO_DIR = "./audios";

// Rutas
app.get("/", (req, res) => {
  res.send("Frecuencia Central - May Roga LLC");
});

// Generar audio pregrabado usando Gemini API
app.post("/api/generate-audio", async (req, res) => {
  const { text, voice } = req.body;
  try {
    const response = await fetch("https://api.gemini.ai/v1/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GEMINI_API_KEY}`
      },
      body: JSON.stringify({ text, voice })
    });
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const filename = `${AUDIO_DIR}/${Date.now()}_${voice}.mp3`;
    await fs.ensureDir(AUDIO_DIR);
    await fs.writeFile(filename, audioBuffer);
    res.json({ success: true, file: filename });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Error generando audio" });
  }
});

// Crear pago único con Stripe
app.post("/api/create-payment-intent", async (req, res) => {
  const { amount, currency, description } = req.body;
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      description,
      automatic_payment_methods: { enabled: true }
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creando PaymentIntent" });
  }
});

// Escuchar Webhooks de Stripe
app.post("/api/webhook", bodyParser.raw({ type: "application/json" }), (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log("Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  // Aquí manejarás eventos como 'payment_intent.succeeded' y desbloqueos
  res.json({ received: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
