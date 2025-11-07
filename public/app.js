const freeBtn = document.getElementById('freeBtn');
const fullBtn = document.getElementById('fullBtn');
const vipBtn = document.getElementById('vipBtn');
const userMoodEl = document.getElementById('userMood');
const userTextEl = document.getElementById('userText');
const chatEl = document.getElementById('chat');
const audioContainer = document.getElementById('audioContainer');
const volumeSlider = document.getElementById('volumeSlider');

let testAccess = false; // acceso de prueba interno 5 min
const TEST_MINUTES = 5;

const moodTracks = {
  'amor': '/audio/mood_love.mp3',
  'calma': '/audio/mood_calm.mp3',
  'exito': '/audio/mood_success.mp3',
  'tristeza': '/audio/mood_sad.mp3',
  'neutral': '/audio/mood_neutral.mp3'
};

const vipTracks = {
  'amor': '/audio/vip_love.mp3',
  'calma': '/audio/vip_calm.mp3',
  'exito': '/audio/vip_success.mp3',
  'tristeza': '/audio/vip_sad.mp3',
  'neutral': '/audio/vip_neutral.mp3'
};

function logChat(sender, text){
  const p = document.createElement('div');
  p.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatEl.appendChild(p);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function playAudio(src){
  const audio = new Audio(src);
  audio.volume = volumeSlider.value / 100;
  audio.play();
  return audio;
}

// función para reproducir sesión gratuita de 8s
freeBtn.onclick = async () => {
  const mood = userMoodEl.value.trim().toLowerCase() || 'neutral';
  logChat('Sistema', `Iniciando sesión gratuita de 8 segundos para "${mood}".`);
  const track = moodTracks[mood] || moodTracks['neutral'];
  const audio = playAudio(track);
  setTimeout(()=> {
    audio.pause();
    logChat('Sistema', 'Sesión gratuita finalizada.');
  }, 8000);
};

// flujo completo de pago (Stripe)
fullBtn.onclick = async () => {
  const mood = userMoodEl.value.trim() || 'neutral';
  const amount = 5000; // ejemplo base
  const res = await fetch('/create-checkout-session', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ amount, description: `Sesión completa ${mood}`, metadata: { actionType: 'full_session', mood } })
  });
  const data = await res.json();
  if(data.url) window.location.href = data.url;
  else logChat('Error', 'No se pudo iniciar pago');
};

// flujo VIP intacto
vipBtn.onclick = async () => {
  const res = await fetch('/create-vip-checkout', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ step:'initial' })
  });
  const data = await res.json();
  if(data.url) window.location.href = data.url;
  else logChat('Error', 'No se pudo iniciar VIP');
};

// play texto con Chat IA (OpenAI)
document.getElementById('playBtn').addEventListener('click', async ()=>{
  const text = userTextEl.value.trim();
  if(!text) return alert('Escribe algo primero');

  logChat('Usuario', text);

  try{
    const res = await fetch('/ai-response', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ prompt:text, voice:'Miguel' })
    });
    const data = await res.json();
    if(data.audio_url){
      const audioEl = document.createElement('audio');
      audioEl.src = data.audio_url;
      audioEl.controls = true;
      audioEl.autoplay = true;
      audioEl.volume = volumeSlider.value/100;
      audioContainer.innerHTML = '';
      audioContainer.appendChild(audioEl);
      logChat('Sistema', 'Respuesta generada y reproducida.');
    }
  } catch(err){
    logChat('Error', err.message);
  }
});

// acceso de prueba interno de 5 minutos
if(testAccess){
  logChat('Sistema', `Modo de prueba activado: acceso completo a todos los servicios durante ${TEST_MINUTES} minutos.`);
}

logChat('Sistema', 'Por favor escribe tu estado de ánimo o lo que deseas lograr, luego pulsa "Sesión Gratis 8s" o "Sesión Completa".');
