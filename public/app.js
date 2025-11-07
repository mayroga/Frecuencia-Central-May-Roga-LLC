// Elementos
const freeBtn = document.getElementById('freeBtn');
const fullBtn = document.getElementById('fullBtn');
const vipBtn = document.getElementById('vipBtn');
const moodEl = document.getElementById('mood');
const userText = document.getElementById('userText');
const playBtn = document.getElementById('playBtn');
const audioContainer = document.getElementById('audioContainer');
const chatEl = document.getElementById('chat');
const volumeSlider = document.getElementById('volumeSlider');
const sessionList = document.getElementById('sessionList');

// Map de pistas mp3 por estado de ánimo
const freeAudioMap = {
  love: '/audio/mood_love.mp3',
  calm: '/audio/mood_calm.mp3',
  success: '/audio/mood_success.mp3',
  sad: '/audio/mood_sad.mp3',
  neutral: '/audio/mood_neutral.mp3'
};

const vipAudioMap = {
  love: '/audio/vip_love.mp3',
  calm: '/audio/vip_calm.mp3',
  success: '/audio/vip_success.mp3',
  sad: '/audio/vip_sad.mp3',
  neutral: '/audio/vip_neutral.mp3'
};

let testAccess = true; // Acceso de prueba interno de 5 minutos
let testTimer;

// Helper chat
function logChat(sender, text){
  const p = document.createElement('div');
  p.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatEl.appendChild(p);
  chatEl.scrollTop = chatEl.scrollHeight;
}

// Reproducir audio con volumen ajustable
function playAudio(url, duration=8000){
  const audio = new Audio(url);
  audio.volume = volumeSlider.value/100;
  audio.play();
  audioContainer.innerHTML = `<audio controls autoplay src="${url}"></audio>`;
  if(duration){
    setTimeout(()=> logChat('Sistema', 'Sesión gratuita finalizada.'), duration);
  }
}

// Free 8s session
freeBtn.onclick = () => {
  const mood = moodEl.value;
  logChat('Sistema', `Inicia sesión gratuita de 8 segundos - Estado de ánimo: ${mood}`);
  playAudio(freeAudioMap[mood], 8000);
  if(testAccess){
    clearTimeout(testTimer);
    testTimer = setTimeout(()=> logChat('Sistema', 'Fin del acceso de prueba de 5 minutos'), 5*60*1000);
  }
};

// Full session (Stripe intacto)
fullBtn.onclick = async () => {
  const mood = moodEl.value;
  const amount = 5000; // ejemplo
  const body = { amount, description: `Sesión completa ${mood}`, metadata: { actionType: 'full_session', mood, voice:'Miguel' } };
  const res = await fetch('/create-checkout-session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const data = await res.json();
  if(data.url) window.location.href = data.url;
  else logChat('Error', 'No se pudo iniciar pago');
};

// VIP session (Stripe intacto)
vipBtn.onclick = async () => {
  const mood = moodEl.value;
  playAudio(vipAudioMap[mood], null);
  const res = await fetch('/create-vip-checkout', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ step:'initial' })
  });
  const data = await res.json();
  if(data.url) window.location.href = data.url;
};

// Play TTS / Chat IA
playBtn.onclick = async () => {
  const text = userText.value.trim();
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
      playAudio(data.audio_url, null);
      addSessionRecord(text, 'Miguel', data.audio_url);
    }
  } catch(e){
    logChat('Error', e.message);
  }
};

function addSessionRecord(prompt, voice, url){
  const item = document.createElement('div');
  item.className = 'session-item';
  item.innerHTML = `<strong>[${voice}]</strong>: ${prompt}<br><audio controls src="${url}"></audio>`;
  sessionList.prepend(item);
}

// Mensaje inicial
logChat('Sistema', 'Bienvenido a Frecuencia Central. Selecciona tu estado de ánimo y pulsa sesión gratuita o completa.');
