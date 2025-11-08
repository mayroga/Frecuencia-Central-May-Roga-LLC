// Archivo: public/chatIA.js
function ChatIA() {
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState([]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { sender: "Tú", text: input };
    setMessages((m) => [...m, userMsg]);

    try {
      // Intentar Gemini primero
      let res = await fetch("/ai-response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input, voice: "Miguel" }),
      });
      let data = await res.json();

      if(!data.audio_url){
        // Backup: OpenAI
        res = await fetch("/openai-response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: input }),
        });
        data = await res.json();
      }

      if(data.audio_url){
        const a = new Audio(data.audio_url);
        a.play();
        setMessages((m) => [
          ...m,
          { sender: "IA", text: "🎵 Respuesta generada con frecuencia terapéutica." },
        ]);
      } else {
        setMessages((m) => [...m, { sender: "IA", text: "Error generando respuesta." }]);
      }
    } catch(err){
      setMessages((m) => [...m, { sender: "Error", text: err.message }]);
    }

    setInput("");
  };

  return (
    <div className="chat-box">
      <h3>Consulta Personalizada IA</h3>
      <div className="chat">
        {messages.map((m, i) => (
          <div key={i}>
            <strong>{m.sender}:</strong> {m.text}
          </div>
        ))}
      </div>
      <input
        type="text"
        placeholder="Escribe tu pregunta..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <button onClick={sendMessage}>Enviar</button>
    </div>
  );
}
