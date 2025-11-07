// server.js — Frecuencia Central / May Roga LLC
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import Stripe from "stripe";
import fetch from "node-fetch";
import fs from "fs-extra";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Directorio público
const PUBLIC_DIR = path.join(process.cwd(), "public");
await fs.ensureDir(path.join(PUBLIC_DIR, "audio"));
await fs.ensureDir(path.join(PUBLIC_DIR, "data"));

// Base de datos simple (archivo JSON)
const DB_FILE = path.join(PUBLIC_DIR, "data", "sessions.json");
let DB = { sessions: [], vipSessions: [], donations: [] };
if (await fs.pathExists(DB_FILE)) {
  try {
    DB = await fs.readJson(DB_FILE);
  } catch {
    DB = { sessions: [], vipSessions: [], donations: [] };
  }
}
const saveDB = async () =>
  await fs.writeJson(DB_FILE, DB, { spaces: 2 });

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

// Utilidad para IDs únicos
const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

// Health Check
app.get("/health", (req, res) => res.json({ ok: true }));

// 🔵 Crear sesión de pago Stripe
app.post("/create-checkout-session", async (req, res) => {
  try {
    const {
      amount,
      currency = "usd",
      description = "Frecuencia Central - Servicio",
      metadata = {},
    } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: description },
            unit_amount: parseInt(amount, 10),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata,
      success_url: `${req.headers.origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/cancel.html`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔵 Webhook de Stripe (procesa pagos)
app.post(
  "/webhook",
  bodyParser.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      if (event.type === "checkout.session.completed") {
        const s = event.data.object;
        const actionType = s.metadata?.actionType || "unknown";

        if (actionType === "full_session") {
          DB.sessions.push({
            id: uid(),
            type: "full_session",
            amount: s.amount_total,
            paid: true,
            created: Date.now(),
          });
        } else if (actionType === "vip_initial") {
          DB.vipSessions.push({
            id: uid(),
            type: "vip_initial",
            amount: s.amount_total,
            paid: true,
            created: Date.now(),
          });
        } else if (actionType === "donation") {
          DB.donations.push({
            id: uid(),
            amount: s.amount_total,
            donor: s.customer_email || "anónimo",
            created: Date.now(),
          });
        }
        await saveDB();
      }

      res.json({ received: true });
    } catch (err) {
      console.error("Webhook error:", err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// 🔵 IA - Generador de voz (Gemini TTS)
app.post("/ai-response", async (req, res) => {
  try {
    const { prompt, voice = "Miguel" } = req.body;
    const gRes = await fetch("https://api.generative.google/v1beta1/text:synthesize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text: prompt },
        voice: { name: voice === "Maria" ? "female-1" : "male-1", languageCode: "es-ES" },
        audioConfig: { audioEncoding: "MP3" },
      }),
    });

    if (!gRes.ok) {
      const errText = await gRes.text();
      return res.status(500).json({ error: "Gemini TTS error", details: errText });
    }

    const gJson = await gRes.json();
    const base64 = gJson.audioContent || gJson.audio || "";
    const buffer = Buffer.from(base64, "base64");
    const filename = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`;
    const filePath = path.join(PUBLIC_DIR, "audio", filename);
    await fs.writeFile(filePath, buffer);
    res.json({ audio_url: `/audio/${filename}` });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🔵 Admin: ver base de datos
app.get("/admin/db", async (req, res) => res.json(DB));

// Guardar al salir
process.on("SIGINT", async () => {
  await saveDB();
  process.exit();
});
process.on("SIGTERM", async () => {
  await saveDB();
  process.exit();
});

app.listen(PORT, () =>
  console.log(`🚀 Servidor Frecuencia Central en puerto ${PORT}`)
);
