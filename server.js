import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON
app.use(bodyParser.json());
app.use(express.static("public"));

// Simulación de control de sesiones
let activeSessions = 0;
const MAX_SESSIONS = 10;

// Endpoint principal: recibir emoción/deseo
app.post("/api/analyze", async (req, res) => {
  const { text, language } = req.body;

  if (activeSessions >= MAX_SESSIONS) {
    return res.json({
      error: true,
      message: "Máximo de sesiones activas alcanzado. Intenta más tarde."
    });
  }

  activeSessions++;

  try {
    // Llamada a OpenAI
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: "Eres un guía emocional, calmante y empático." },
          { role: "user", content: `Usuario dice: ${text}` }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const message = data.choices[0].message.content;

    // Selección de música y vibración según emoción (simple ejemplo)
    let music = "";
    let vibration = [];

    const lowerText = text.toLowerCase();
    if (lowerText.includes("asustado") || lowerText.includes("miedo")) {
      music = "/sounds/miedo.mp3";
      vibration = [20, 220, 20];
    } else if (lowerText.includes("dinero") || lowerText.includes("trabajo")) {
      music = "/sounds/dinero.mp3";
      vibration = [70, 40, 70, 40, 200];
    } else if (lowerText.includes("amor") || lowerText.includes("pasión")) {
      music = "/sounds/amor.mp3";
      vibration = [120, 60, 120, 120];
    } else {
      music = "/sounds/neutral.mp3";
      vibration = [20, 180, 20, 180];
    }

    res.json({
      error: false,
      message,
      music,
      vibration
    });

  } catch (err) {
    console.error(err);
    res.json({ error: true, message: "Error interno del servidor" });
  } finally {
    activeSessions--;
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
