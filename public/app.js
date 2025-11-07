const freeBtn = document.getElementById('freeBtn');
const fullBtn = document.getElementById('fullBtn');
const vipBtn = document.getElementById('vipBtn');
const moodSelect = document.getElementById('moodSelect');
const moodText = document.getElementById('moodText');
const volumeSlider = document.getElementById('volumeSlider');
const sessionList = document.getElementById('sessionList');
const audioContainer = document.getElementById('audioContainer');
const playChatBtn = document.getElementById('playChatBtn');
const userChat = document.getElementById('userChat');
const serviceBtns = document.querySelectorAll('.serviceBtn');

let currentMood = 'neutral';
let sessionType = 'private';
let testAccessUsed = false;

const moodFiles = {
  love: '/audio/mood_love.mp3',
  calm: '/audio/mood_calm.mp3',
  success: '/audio/mood_success.mp3',
  sad: '/audio/mood_sad.mp3',
  neutral: '/audio/mood_neutral.mp3'
};

const vipFiles = {
  love: '/audio/vip_love.mp3',
  calm: '/audio/vip_calm.mp3',
  success: '/audio/vip_success.mp3',
  sad: '/audio/vip_sad.mp3',
  neutral: '/audio/vip_neutral.mp3'
};

function logSession(message) {
  const item = document.createElement('div');
  item.innerHTML = message;
  sessionList.prepend(item);
}

function getMood() {
  return moodText.value.trim() || moodSelect.value || 'neutral';
}

function playAudio(file) {
  audioContainer.innerHTML = `<audio id="sessionAudio" src="${file}" autoplay></audio>`;
  const audio = document.getElementById('sessionAudio');
  audio.volume = volumeSlider.value / 100;
}

serviceBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    sessionType = btn.dataset.type;
    logSession(`Sistema: Has seleccionado sesión tipo <strong>${sessionType}</strong>`);
  });
});

freeBtn.onclick = () => {
  if (!testAccessUsed) {
    testAccessUsed = true;
    logSession('Sistema: Acceso de prueba de 5 minutos activado.');
    setTimeout(()=> logSession('Sistema: Fin del acceso de prueba.'), 5*60*1000);
  }
  const mood = getMood();
  logSession(`Sistema: Iniciando sesión gratuita de 8 segundos para estado <strong>${mood}</strong>`);
  playAudio(moodFiles[mood]);
  setTimeout(()=> logSession('Sistema: Sesión gratuita finalizada.'), 8000);
};

fullBtn.onclick = async () => {
  const mood = getMood();
  const body = { amount: 5000, description:`Sesión completa ${mood}`, metadata:{ actionType:'full_session', mood, voice:'Miguel', sessionType } };
  const res = await fetch('/create-checkout-session',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  const data = await res.json();
  if(data.url) window.location.href = data.url;
  else logSession('Error: no se pudo iniciar el pago.');
};

vipBtn.onclick = async () => {
  const mood = getMood();
  const body = { step:'initial', metadata:{ mood, sessionType } };
  const res = await fetch('/create-vip-checkout',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
  const data = await res.json();
  if(data.url) window.location.href = data.url;
  else logSession('Error: no se pudo iniciar VIP.');
};

playChatBtn.onclick = async () => {
  const text = userChat.value.trim();
  if(!text) return alert('Escribe algo primero');
  logSession(`<strong>Usuario:</strong> ${text}`);
  const res = await fetch('/ai-response',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({prompt:text, voice:'Miguel'})});
  const data = await res.json();
  if(data.audio_url){
    playAudio(data.audio_url);
    logSession(`<strong>Sistema:</strong> Respuesta generada y reproducida.`);
  } else {
    logSession('Error generando audio.');
  }
};

moodSelect.addEventListener('change', ()=> {
  currentMood = moodSelect.value;
  logSession(`Sistema: Estado de ánimo seleccionado: ${currentMood}`);
});

moodText.addEventListener('input', ()=> {
  currentMood = moodText.value.trim();
});

volumeSlider.addEventListener('input', ()=> {
  const audio = document.getElementById('sessionAudio');
  if(audio) audio.volume = volumeSlider.value/100;
});
