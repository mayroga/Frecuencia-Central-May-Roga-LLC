import { soundMap } from './soundMap.js';

async function startSession(prompt, lang='es') {
  logChat('Usuario', prompt);

  try {
    const res = await fetch('/ai-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, lang })
    });
    const data = await res.json();

    // Elegir audio, vibración y mensaje según emoción detectada
    const map = soundMap[data.emotion] || soundMap.neutral;

    audioContainer.innerHTML = `<audio controls autoplay src="${map.audio}"></audio>`;
    
    // Activar vibración (si disponible)
    if (navigator.vibrate) navigator.vibrate(map.vibrationPattern);

    logChat('Sistema', map.description[lang] || map.description.es);
  } catch (err) {
    logChat('Error', err.message);
  }
}
