// public/apps.js
const EMOTIONAL_MAP = {
  Miedo: { sound: "Miedo", duration: 600 },
  Dinero: { sound: "Dinero", duration: 600 },
  Duelo: { sound: "Duelo", duration: 1200 },
  Sueño: { sound: "Sueño", duration: 1200 },
  Default: { sound: "Default", duration: 900 },
};

let synth = null;
let sessionTimer = null;

const playAudio = async (category) => {
  const audio = new Audio(`/audio/${category}`);
  await audio.play();
};

const startVibration = async (category) => {
  const res = await fetch(`/vibration/${category}`);
  const pattern = await res.json();
  if ("vibrate" in navigator) navigator.vibrate(pattern);
};

const startSession = async (category) => {
  clearInterval(sessionTimer);
  const { sound, duration } = EMOTIONAL_MAP[category] || EMOTIONAL_MAP.Default;
  document.getElementById("session-view").classList.remove("hidden");
  document.getElementById("response-view").classList.add("hidden");
  document.getElementById("initial-view").classList.add("hidden");

  await playAudio(sound);
  await startVibration(sound);

  let elapsed = 0;
  const timerEl = document.getElementById("timer");
  sessionTimer = setInterval(() => {
    elapsed++;
    const remaining = duration - elapsed;
    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
    const seconds = String(remaining % 60).padStart(2, "0");
    timerEl.textContent = `${minutes}:${seconds}`;
    if (remaining <= 0) {
      clearInterval(sessionTimer);
      stopSession();
    }
  }, 1000);
};

const stopSession = () => {
  clearInterval(sessionTimer);
  if (synth) synth.dispose();
  navigator.vibrate(0);
  document.getElementById("session-view").classList.add("hidden");
  document.getElementById("initial-view").classList.remove("hidden");
};
