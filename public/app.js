// --- App.js actualizado para Frecuencia Central ---
const freeBtn = document.getElementById('freeBtn');
const fullBtn = document.getElementById('fullBtn');
const vipBtn = document.getElementById('vipBtn');
const moodEl = document.getElementById('mood');
const volumeSlider = document.getElementById('volumeSlider');
const audioEl = document.createElement('audio');
audioEl.controls = true;
const chatEl = document.getElementById('chat');
const sessionList = document.getElementById('sessionList');
const audioContainer = document.getElementById('audioContainer');

let selectedMood = 'neutral';
const moodBtns = document.querySelectorAll('.moodBtn');

const moodAudioMap = {
  free: {
    love: '/audio/mood_love.mp3',
    calm: '/audio/mood_calm.mp3',
    success: '/audio/mood_success.mp3',
    sad: '/audio/mood_sad.mp3',
    neutral: '/audio/mood_neutral.mp3',
  },
  vip: {
    love: '/audio/vip_love.mp3',
    calm: '/audio/vip_calm.mp3',
    success: '/audio/vip_success.mp3',
    sad: '/audio/vip_sad.mp3',
    neutral: '/audio/vip_neutral.mp3',
  }
};

// Función de chat
function logChat(sender, text){
  const p = document.createElement('div');
  p.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatEl.appendChild(p);
  chatEl.scrollTop = chatEl.scrollHeight;
}

// Guía inicial al usuario
logChat('Sistema', 'Bienvenido a Frecuencia Central. Selecciona tu estado de ánimo y ajusta la intensidad para comenzar.');
logChat('Sistema', 'Puedes probar una sesión gratuita de 8 segundos antes de decidir.');

// Selección de estado de ánimo
moodBtns.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    selectedMood = btn.dataset.mood;
    logChat('Sistema', `Has seleccionado: ${selectedMood}. Ahora puedes iniciar tu sesión.`);
  });
});

// Volumen
volumeSlider.addEventListener('input', ()=>{
  audioEl.volume = volumeSlider.value / 100;
});

// Helper para reproducir pista
async function playMoodAudio(sessionType='free', duration=8000){
  const src = moodAudioMap[sessionType][selectedMood] || moodAudioMap[sessionType].neutral;
  audioEl.src = src;
  audioEl.volume = volumeSlider.value / 100;
  audioContainer.innerHTML = '';
  audioContainer.appendChild(audioEl);
  await audioEl.play();
  logChat('Sistema', `Reproduciendo sesión ${sessionType} para ${selectedMood} (${duration/1000}s)`);
  setTimeout(()=>{
    audioEl.pause();
    logChat('Sistema', 'Sesión finalizada.');
  }, duration);
}

// Sesión gratuita 8s
freeBtn.onclick = async () => {
  await playMoodAudio('free', 8000);
};

// Full session (Stripe)
fullBtn.onclick = async () => {
  const amount = 5000;
  const body = { amount, description: `Sesión completa ${selectedMood}`, metadata: { actionType: 'full_session', mood: selectedMood, voice: 'Miguel' } };
  const res = await fetch('/create-checkout-session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const data = await res.json();
  if(data.url) window.location.href = data.url;
  else logChat('Error', 'No se pudo iniciar pago');
};

// VIP session
vipBtn.onclick = async () => {
  const res = await fetch('/create-vip-checkout', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ step:'initial' })
  });
  const data = await res.json();
  if(data.url) window.location.href = data.url;
  else logChat('Error', 'No se pudo iniciar VIP');
};

// Play texto con TTS / IA
document.getElementById('playBtn').addEventListener('click', async ()=>{
  const text = document.getElementById('userText').value.trim();
  if(!text) return alert('Escribe algo primero');
  logChat('Usuario', text);
  try{
    const res = await fetch('/ai-response', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ prompt:text, voice:'Miguel' })
    });
    const data = await res.json();
    if(data.audio_url){
      const ttsAudio = new Audio(data.audio_url);
      ttsAudio.volume = volumeSlider.value / 100;
      ttsAudio.play();
      logChat('Sistema', 'Respuesta generada por IA.');
      addSessionRecord(text, 'Miguel', data.audio_url);
    }
  }catch(e){
    logChat('Error', e.message);
  }
});

// Registro de sesiones
function addSessionRecord(prompt, voice, url){
  const item = document.createElement('div');
  item.className = 'session-item';
  item.innerHTML = `<strong>[${voice}]</strong>: ${prompt} <br><audio controls src="${url}"></audio>`;
  sessionList.prepend(item);
}
