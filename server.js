// ==============================
// File: server.js
// ==============================

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import Stripe from "stripe";
import fetch from "node-fetch";
import fs from "fs-extra";
import path from "path";

const app = express();
const PORT = process.env.PORT || 5000;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// === Static public ===
const PUBLIC_DIR = path.join(process.cwd(), "public");
await fs.ensureDir(path.join(PUBLIC_DIR, "audio"));
await fs.ensureDir(path.join(PUBLIC_DIR, "data"));

// === Simple storage ===
const SESSIONS_FILE = path.join(PUBLIC_DIR, "data", "sessions.json");
let DB = { sessions: [], vipSessions: [], dailyLimits: {} };
if (await fs.pathExists(SESSIONS_FILE)) {
  try {
    DB = await fs.readJson(SESSIONS_FILE);
  } catch {
    DB = { sessions: [], vipSessions: [], dailyLimits: {} };
  }
}
const saveDB = async () => {
  await fs.writeJson(SESSIONS_FILE, DB, { spaces: 2 });
};

// === Middleware ===
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

// === Utilities ===
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

// === Health ===
app.get("/health", (req, res) => res.json({ ok: true }));

// === Stripe checkout (igual que antes) ===
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { amount, currency = "usd", description = "Frecuencia Central - Servicio", metadata = {} } = req.body;
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
    res.json({ url: session.url, id: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// === Webhook (sin cambios) ===
app.post("/webhook", bodyParser.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const actionType = session.metadata?.actionType || "unknown";
      const refId = session.metadata?.refId || null;

      if (actionType === "full_session") {
        const s = {
          id: uid(),
          type: "full_session",
          amount: session.amount_total,
          currency: session.currency,
          paid: true,
          stripeSessionId: session.id,
          created: Date.now(),
          voice: session.metadata?.voice || "Miguel",
          userRef: refId || uid(),
          expiresAt: Date.now() + 20 * 60 * 1000,
        };
        DB.sessions.push(s);
        await saveDB();
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// === NUEVO: Generador de audio TTS pregrabado ===
app.post("/api/generate-audio", async (req, res) => {
  try {
    const { text, voice = "Miguel" } = req.body;
    if (!text || text.trim() === "") return res.status(400).json({ error: "Falta el texto para generar audio." });

    const ttsResponse = await fetch("https://api.generative.google/v1beta1/text:synthesize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text },
        voice: { name: voice === "Maria" ? "female-1" : "male-1", languageCode: "es-ES" },
        audioConfig: { audioEncoding: "MP3" },
      }),
    });

    if (!ttsResponse.ok) {
      const errText = await ttsResponse.text();
      return res.status(500).json({ error: "Gemini TTS error", details: errText });
    }

    const ttsJson = await ttsResponse.json();
    const base64Audio = ttsJson.audioContent || "";
    if (!base64Audio) return res.status(500).json({ error: "No se recibió audio desde Gemini." });

    // Guardar archivo en /public/audio
    const filename = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`;
    const filePath = path.join(PUBLIC_DIR, "audio", filename);
    await fs.writeFile(filePath, Buffer.from(base64Audio, "base64"));

    const publicUrl = `/audio/${filename}`;
    res.json({ success: true, audio_url: publicUrl });
  } catch (err) {
    console.error("Error en /api/generate-audio:", err);
    res.status(500).json({ error: err.message });
  }
});

// === Endpoint admin/debug ===
app.get("/admin/db", async (req, res) => res.json(DB));

// === Safe exit ===
process.on("SIGINT", async () => {
  await saveDB();
  process.exit();
});
process.on("SIGTERM", async () => {
  await saveDB();
  process.exit();
});

app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
