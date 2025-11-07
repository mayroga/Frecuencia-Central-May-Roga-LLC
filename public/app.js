// File: public/app.js
const freeBtn = document.getElementById('freeBtn');
const fullBtn = document.getElementById('fullBtn');
const vipBtn = document.getElementById('vipBtn');
const moodEl = document.getElementById('mood');
const voiceEl = document.getElementById('voice');
const audioEl = document.getElementById('audio');
const chatEl = document.getElementById('chat');
const upsellBtns = document.querySelectorAll('.upsellBtn');
const volumeSlider = document.getElementById('volumeSlider');

let audioDuration = 8000; // 8s gratis default
let testMode = false; // modo prueba oculto

// Map de pistas por estado de ánimo
const moodAudioMap = {
  'love': '/audio/mood_love.mp3',
  'calm': '/audio/mood_calm.mp3',
  'success': '/audio/mood_success.mp3',
  'sad': '/audio/mood_sad.mp3',
  'neutral': '/audio/mood_neutral.mp3',
};

// VIP pistas (opcional)
const vipAudioMap = {
  'love': '/audio/vip_love.mp3',
  'calm': '/audio/vip_calm.mp3',
  'success': '/audio/vip_success.mp3',
  'sad': '/audio/vip_sad.mp3',
  'neutral': '/audio/vip_neutral.mp3',
};

function logChat(sender, text){
  const p = document.createElement('div');
  p.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatEl.appendChild(p);
  chatEl.scrollTop = chatEl.scrollHeight;
}

// Reproduce audio según estado de ánimo y duración
function playMoodAudio(mood, duration=8000){
  const src = testMode ? Object.values(moodAudioMap) : moodAudioMap[mood] || moodAudioMap['neutral'];
  const audioSrc = Array.isArray(src) ? src[0] : src; // si testMode -> tomamos primera pista
  audioEl.src = audioSrc;
  audioEl.volume = volumeSlider.value;
  audioEl.play();
  logChat('Sistema', `Reproduciendo "${mood}" por ${duration/1000} segundos.`);
  setTimeout(() => {
    audioEl.pause();
    logChat('Sistema', 'Sesión finalizada.');
  }, duration);
}

// Free 8s session
freeBtn.onclick = async () => {
  const mood = moodEl.value;
  const userText = document.getElementById('userText').value.trim();

  // modo prueba si escribes "Probando"
  if(userText.toLowerCase() === 'probando'){
    testMode = true;
    audioDuration = 5*60*1000; // 5 minutos
    logChat('Sistema', 'Modo prueba activado: acceso completo a todas las pistas por 5 minutos.');
  } else {
    testMode = false;
    audioDuration = 8000;
  }

  logChat('Usuario', `Inicia sesión gratis - ${mood}`);
  playMoodAudio(mood, audioDuration);
};

// Volumen slider
volumeSlider.oninput = () => {
  audioEl.volume = volumeSlider.value;
};

// Full session (Stripe)
fullBtn.onclick = async () => {
  const mood = moodEl.value;
  const voice = voiceEl.value;
  const amount = 5000;
  const body = { amount, description: `Sesión completa ${mood}`, metadata: { actionType: 'full_session', mood, voice } };
  const res = await fetch('/create-checkout-session', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  const data = await res.json();
  if(data.url) window.location.href = data.url;
  else logChat('Error', 'No se pudo iniciar pago');
};

// VIP button
vipBtn.onclick = async () => {
  const voice = voiceEl.value;
  const res = await fetch('/create-vip-checkout', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ step:'initial' }) });
  const data = await res.json();
  if(data.url) window.location.href = data.url;
  else logChat('Error', 'No se pudo iniciar VIP');
};

// Upsells
upsellBtns.forEach(b=>{
  b.addEventListener('click', async (e)=>{
    const type = e.currentTarget.dataset.type;
    const body = { type, mood: moodEl.value, voice: voiceEl.value };
    const res = await fetch('/create-upsell-checkout', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    const d = await res.json();
    if(d.url) window.location.href = d.url;
    else logChat('Error', 'No se pudo iniciar pago de upsell');
  });
});

// Chat IA helper
async function callAIAndPlay(prompt, voice){
  logChat('Sistema', 'Generando respuesta de IA...');
  try{
    const res = await fetch('/ai-response', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ prompt, voice })
    });
    const data = await res.json();
    if(data.audio_url){
      audioEl.src = data.audio_url;
      await audioEl.play().catch(()=>{});
      logChat(voice, prompt);
    } else logChat('Error', 'No se pudo generar audio');
  } catch(err){ logChat('Error', err.message); }
}

// Guía inicial
window.onload = () => {
  logChat('Sistema', 'Bienvenido a Frecuencia Central - May Roga LLC');
  logChat('Sistema', 'Selecciona tu estado de ánimo y pulsa sesión gratuita de 8 segundos o prueba el modo completo si eres administrador.');
};
