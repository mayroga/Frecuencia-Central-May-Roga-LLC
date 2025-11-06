// === server.js ===
// Servidor de May Roga LLC — Ateneo Clínico IA
// Versión completa con API de audio integrada

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 5000;

// === Middlewares ===
app.use(cors());
app.use(bodyParser.json());

// === Ruta raíz (para verificar que el servidor corre) ===
app.get("/", (req, res) => {
  res.send("🌿 Servidor May Roga LLC activo y funcionando.");
});

// === NUEVO: Generador de audio TTS pregrabado ===
app.post("/api/generate-audio", async (req, res) => {
  try {
    const { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Texto requerido" });
    }

    // Usamos una voz por defecto si no se especifica
    const voiceId = voice || "alloy";

    // Llamada a la API de OpenAI TTS
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: voiceId,
        input: text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error en respuesta TTS:", errorText);
      return res.status(500).json({ error: "Error generando el audio" });
    }

    // Convertimos el audio a base64 para enviar al cliente
    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");

    res.json({ audio: audioBase64 });
  } catch (error) {
    console.error("Error en /api/generate-audio:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// === Servidor ===
app.listen(PORT, () => {
  console.log(`🚀 Servidor activo en puerto ${PORT}`);
});
