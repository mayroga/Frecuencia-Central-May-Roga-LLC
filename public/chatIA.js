// chatIA.js
// Maneja la interacción dinámica durante la sesión
const followUpBtn = document.getElementById('followUp');
let sessionInterval = null;

// Función para seguimiento durante sesión
async function checkStatus(need){
  const res = await fetch(`/map/${need}`);
  const data = await res.json();
  playAudio(data.sounds[0]);
  logChat('Sistema', `Revisando tu estado emocional... adaptando sesión a ${need}`);
}

// Inicia seguimiento cada 5 minutos (o ajustable)
function startSessionFollowUp(need){
  if(sessionInterval) clearInterval(sessionInterval);
  sessionInterval = setInterval(()=>checkStatus(need), 300000); // 5 min
}

// Botón seguimiento manual
if(followUpBtn){
  followUpBtn.onclick=()=>{
    const need = document.getElementById('mood').value;
    checkStatus(need);
  }
}

// Función para adaptar vibraciones si dispositivo soporta
export function vibratePattern(pattern){
  if(navigator.vibrate) navigator.vibrate(pattern);
}

// Ejemplo: activar micro-pulsos según necesidad
export function adaptVibration(need){
  const patterns = {
    miedo:[20,220,20],
    dinero:[60,40,60,40,200],
    energia:[70,40,70,40,200],
    amor:[120,60,120,120],
    duelo:[40,150,40],
    sueño:[10,50,10],
    seguridad:[100,80,100]
  };
  vibratePattern(patterns[need] || [30,30,30]);
}
