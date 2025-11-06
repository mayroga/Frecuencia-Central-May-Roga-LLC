// === NUEVO: Generador de audio TTS pregrabado ===
app.post("/api/generate-audio", async (req, res) => {
  try {
    const { text, voice = "Miguel" } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Falta el texto para generar audio." });
    }

    // --- 1️⃣ Generar texto (usando Gemini API correcto) ---
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text }] }],
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", errText);
      return res.status(500).json({ error: "Error en Gemini API", details: errText });
    }

    const geminiJson = await geminiRes.json();
    const generatedText =
      geminiJson.candidates?.[0]?.content?.parts?.[0]?.text || text;

    // --- 2️⃣ Generar audio MP3 con Google Cloud TTS ---
    const ttsRes = await fetch(
      "https://texttospeech.googleapis.com/v1/text:synthesize?key=" +
        process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text: generatedText },
          voice: {
            languageCode: "es-ES",
            name: voice === "Maria" ? "es-ES-Standard-A" : "es-ES-Standard-B",
          },
          audioConfig: { audioEncoding: "MP3" },
        }),
      }
    );

    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      console.error("Error TTS:", errText);
      return res.status(500).json({ error: "Error generando audio", details: errText });
    }

    const ttsJson = await ttsRes.json();
    const base64Audio = ttsJson.audioContent;
    if (!base64Audio) {
      return res.status(500).json({ error: "No se recibió audio desde TTS." });
    }

    // --- 3️⃣ Guardar archivo en /public/audio ---
    const filename = `tts_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}.mp3`;
    const filePath = path.join(PUBLIC_DIR, "audio", filename);
    await fs.writeFile(filePath, Buffer.from(base64Audio, "base64"));

    const publicUrl = `/audio/${filename}`;
    res.json({
      success: true,
      audio_url: publicUrl,
      text: generatedText,
    });
  } catch (err) {
    console.error("Error en /api/generate-audio:", err);
    res.status(500).json({ error: err.message });
  }
});
