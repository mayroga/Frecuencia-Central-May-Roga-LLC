// app.js
const moodEl = document.getElementById('mood');
const userTextEl = document.getElementById('userText');
const playBtn = document.getElementById('playBtn');
const chatEl = document.getElementById('chat');
const audioContainer = document.getElementById('audioContainer');

const freeBtns = document.querySelectorAll('.btn-free');
const sessionBtns = document.querySelectorAll('.btn-session');
let currentToken = null;

// Función para log de chat
function logChat(sender, text){
  const p = document.createElement('div');
  p.innerHTML = `<strong>${sender}:</strong> ${text}`;
  chatEl.appendChild(p);
  chatEl.scrollTop = chatEl.scrollHeight;
}

// Reproduce audio
function playAudio(url){
  audioContainer.innerHTML = `<audio controls autoplay src="${url}"></audio>`;
}

// Detectar necesidad desde botones rápidos
async function startQuickSession(need, free=false){
  logChat('Sistema', `Procesando tu necesidad: ${need}`);
  if(free){
    // Sesión gratuita 8s
    const res = await fetch('/free-session', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ userToken: need })
    });
    const data = await res.json();
    logChat('Sistema', data.message);
    currentToken = data.token;
    // Reproducir audio inicial
    const mapRes = await fetch(`/map/${need}`);
    const mapData = await mapRes.json();
    playAudio(mapData.sounds[0]);
  } else {
    // Sesión de pago: pedir monto según necesidad
    let amount = 0;
    switch(need){
      case 'basico': amount=2000; break;
      case 'premium': amount=5000; break;
      case 'corporate': amount=50000; break;
      case 'hospital': amount=40000; break;
      case 'vip': amount=500000; break;
      default: amount=2000;
    }
    const res = await fetch('/create-checkout-session',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        amount,
        description:`Sesión ${need}`,
        metadata:{ actionType:need }
      })
    });
    const data = await res.json();
    if(data.url) window.location.href = data.url;
    else logChat('Error','No se pudo iniciar pago');
  }
}

// Botones rápidos de emociones
freeBtns.forEach(btn=>{
  btn.onclick=()=>startQuickSession(btn.dataset.need,true);
});
sessionBtns.forEach(btn=>{
  btn.onclick=()=>startQuickSession(btn.dataset.need,false);
});

// Enviar texto libre a IA
async function sendText(){
  const text = userTextEl.value.trim();
  if(!text) return alert('Escribe algo primero');
  logChat('Usuario', text);
  try{
    const res = await fetch('/ai-response',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ prompt:text, voice:'Miguel' })
    });
    const data = await res.json();
    logChat('Sistema', data.text);
    if(data.audio_url) playAudio(data.audio_url);
  }catch(err){
    logChat('Error', err.message);
  }
}

playBtn.addEventListener('click', sendText);
