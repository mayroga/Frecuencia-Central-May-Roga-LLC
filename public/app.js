// Archivo: public/app.js
const freeBtn = document.getElementById('freeBtn');
const fullBtn = document.getElementById('fullBtn');
const vipBtn = document.getElementById('vipBtn');
const moodEl = document.getElementById('mood');
const intensityEl = document.getElementById('intensity');
const sessionTypeEl = document.getElementById('sessionType');
const userTextEl = document.getElementById('userText');
const playBtn = document.getElementById('playBtn');
const audioContainer = document.getElementById('audioContainer');
const chatEl = document.getElementById('chat');

let testAccessActive = false;

// Audio map
const audioMap = {
  mood: {
    love: '/audio/mood_love.mp3',
    calm: '/audio/mood_calm.mp3',
    success: '/audio/mood_success.mp3',
    sad: '/audio/mood_sad.mp3',
    neutral: '/audio/mood_neutral.mp3'
  },
  vip: {
    love: '/audio/vip_love.mp3',
    calm: '/audio/vip_calm.mp3',
    success: '/audio/vip_success.mp3',
    sad: '/audio/vip_sad.mp3',
    neutral: '/audio/vip_neutral.mp3'
  }
};

function logChat(sender, text) {
  const p = document.createElement('div');
  p.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatEl.appendChild(p);
  chatEl.scrollTop = chatEl.scrollHeight;
}

// Reproduce audio según estado de ánimo y tipo de sesión
function playMoodAudio(mood, type='mood') {
  const src = audioMap[type][mood];
  if (!src) return;
  const audio = new Audio(src);
  audio.volume = intensityEl.value / 100;
  audio.play();
  return audio;
}

// Sesión gratuita 8s
freeBtn.onclick = async () => {
  const mood = moodEl.value;
  const type = sessionTypeEl.value;
  logChat('Sistema', `Iniciando sesión gratuita de 8 segundos para estado ${mood} y sesión ${type}`);
  
  const audio = playMoodAudio(mood, 'mood');
  
  setTimeout(()=> {
    if(audio) audio.pause();
    logChat('Sistema', 'Sesión gratuita finalizada.');
  }, 8000);
};

// Sesión completa con Stripe
fullBtn.onclick = async () => {
  const mood = moodEl.value;
  const type = sessionTypeEl.value;
  const amount = 5000; // $50 ejemplo
  const res = await fetch('/create-checkout-session', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ amount, description:`Sesión completa ${mood}`, metadata:{actionType:'full_session', mood, voice:'Miguel', sessionType:type}})
  });
  const data = await res.json();
  if(data.url) window.location.href = data.url;
  else logChat('Error','No se pudo iniciar pago');
};

// Sesión VIP con Stripe
vipBtn.onclick = async () => {
  const type = sessionTypeEl.value;
  const res = await fetch('/create-vip-checkout',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({step:'initial', sessionType:type})
  });
  const data = await res.json();
  if(data.url) window.location.href = data.url;
  else logChat('Error','No se pudo iniciar VIP');
};

// Chat IA
async function sendAIMessage() {
  const text = userTextEl.value.trim();
  if(!text) return alert('Escribe algo primero');

  logChat('Usuario', text);
  const mood = moodEl.value;
  const type = testAccessActive ? 'vip' : 'mood';

  // Reproduce audio correspondiente
  playMoodAudio(mood, type);

  try {
    const res = await fetch('/ai-response',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({prompt:text, voice:'Miguel'})
    });
    const data = await res.json();
    if(data.audio_url){
      audioContainer.innerHTML = `<audio controls autoplay src="${data.audio_url}"></audio>`;
      logChat('Sistema', 'Respuesta de IA generada y reproducida.');
    } else {
      logChat('Sistema','Error generando audio de IA');
    }
  } catch(err){
    logChat('Error', err.message);
  }
}

// Botón enviar chat
playBtn.addEventListener('click', sendAIMessage);

// Acceso de prueba de 5 minutos (oculto)
testAccessActive = true;
logChat('Sistema', 'Acceso de prueba de 5 minutos activado.');
