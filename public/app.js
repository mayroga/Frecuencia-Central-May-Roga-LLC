const { useState, useEffect } = React;

function App() {
  const [text, setText] = useState("");
  const [lang, setLang] = useState("es");
  const [freq, setFreq] = useState(432);
  const [volume, setVolume] = useState(0.5);
  const [voice, setVoice] = useState("Miguel");
  const [chatMode, setChatMode] = useState(false);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    const langDetect = navigator.language || "es";
    setLang(langDetect.startsWith("es") ? "es" : "en");
  }, []);

  const handlePlay = async () => {
    if (!text.trim()) return alert("Escribe algo primero.");
    const res = await fetch("/ai-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: text, voice }),
    });
    const data = await res.json();
    if (data.audio_url) {
      const a = new Audio(data.audio_url);
      a.volume = volume;
      a.play();
      setSessions((prev) => [
        { text, url: data.audio_url, voice },
        ...prev,
      ]);
    }
    playTone(freq, volume);
  };

  const startPayment = async (type, amount, desc) => {
    const res = await fetch("/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        description: desc,
        metadata: { actionType: type },
      }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  // 🟡 NUEVA FUNCIÓN DE DONACIÓN DIRECTA
  const donate = async () => {
    const amount = prompt("¿Cuánto deseas donar en USD?", "20");
    if (!amount || isNaN(amount) || amount <= 0) return;
    const res = await fetch("/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(parseFloat(amount) * 100),
        description: `Donación directa May Roga Organics`,
        metadata: { actionType: "donation" },
      }),
    });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  return (
    <div className="container">
      <h1>Frecuencia Central</h1>
      <p>
        Sesiones de terapia vibracional, música y bienestar natural. Ajusta tu frecuencia, volumen y consulta personalizada si lo deseas.
      </p>

      <div className="controls">
        <label>Frecuencia: {freq} Hz</label>
        <input
          type="range"
          min="396"
          max="963"
          step="1"
          value={freq}
          onChange={(e) => setFreq(e.target.value)}
        />
        <label>Volumen: {(volume * 100).toFixed(0)}%</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
        />
      </div>

      <textarea
        rows="3"
        value={text}
        placeholder="Escribe cómo te sientes..."
        onChange={(e) => setText(e.target.value)}
      />

      <div className="actions">
        <button onClick={handlePlay}>▶️ Play Terapia</button>
        <button onClick={() => startPayment("full_session", 5000, "Sesión Completa $50")}>
          💎 Sesión Completa $50
        </button>
        <button onClick={() => startPayment("vip_initial", 1000000, "Sesión Exclusiva $10,000")}>
          👑 Exclusiva $10,000
        </button>
        <button onClick={donate}>
          🌿 Donar a May Roga Organics
        </button>
        <button onClick={() => setChatMode(!chatMode)}>
          💬 {chatMode ? "Cerrar Chat IA" : "Consulta Personalizada"}
        </button>
      </div>

      {chatMode && <ChatIA />}

      <div className="session-list">
        <h2>Historial de Sesiones</h2>
        {sessions.map((s, i) => (
          <div key={i} className="session-item">
            <strong>[{s.voice}]</strong> {s.text}
            <br />
            <audio controls src={s.url}></audio>
          </div>
        ))}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
