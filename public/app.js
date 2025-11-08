const userTextEl = document.getElementById('userText');
const startBtn = document.getElementById('startBtn');
const audioContainer = document.getElementById('audioContainer');
const chatEl = document.getElementById('chat');

function logChat(sender, text) {
  const p = document.createElement('div');
  p.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatEl.appendChild(p);
  chatEl.scrollTop = chatEl.scrollHeight;
}

async function startSession(prompt, lang='es') {
  logChat('Usuario', prompt);

  try {
    const res = await fetch('/ai-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, lang })
    });
    const data = await res.json();
    if (data.audio_url) {
      audioContainer.innerHTML = `<audio controls autoplay src="${data.audio_url}"></audio>`;
      logChat('Sistema', data.message);
    }
  } catch (err) {
    logChat('Error', err.message);
  }
}

startBtn.addEventListener('click', () => {
  if (userTextEl.value.trim()) startSession(userTextEl.value);
});

document.querySelectorAll('.quick-buttons button').forEach(btn => {
  btn.addEventListener('click', () => startSession(btn.dataset.emotion));
});
