import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import * as Tone from 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.min.js';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
let app, db, auth, userId;
let isAuthReady = false;
window.userSessionData = { trialUsed: false, lastSessionDate: null, isPaidForToday: false };

const EMOTIONAL_MAP = {
    'Miedo': { voice: 'Siento miedo...', sound: 'Pad Cálido, Mar Lejano', vibrationPattern: [20,220,20], duration:600, color:'red' },
    'Dinero': { voice:'Quiero éxito...', sound:'Piano, Cuerdas', vibrationPattern:[70,40,70,40,200], duration:600, color:'green' },
    'Duelo': { voice:'Siento pérdida...', sound:'Cello, Coros', vibrationPattern:[40,150,40], duration:1200, color:'gray' },
    'Sueño': { voice:'Necesito dormir...', sound:'Olas, Grillos', vibrationPattern:[100,80,100], duration:1200, color:'indigo' },
    'Default': { voice:'Equilibrio...', sound:'Cuerdas, Ostinato', vibrationPattern:[100,80,100], duration:900, color:'blue' }
};

window.currentSessionCategory = EMOTIONAL_MAP.Default;
window.currentSessionName = 'Default';
window.synth = null; window.sessionTimer = null; window.vibeInterval = null; window.sessionLength = 0; window.sessionStartTime = 0;

async function initializeFirebase() {
    setLogLevel('Debug');
    if(Object.keys(firebaseConfig).length === 0){ userId = crypto.randomUUID(); isAuthReady=true; return; }
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app); db = getFirestore(app);
        await signInAnonymously(auth);
        onAuthStateChanged(auth,(user)=>{ userId=user?.uid||crypto.randomUUID(); isAuthReady=true; loadUserSessionData(); });
    } catch(e){ userId=crypto.randomUUID(); isAuthReady=true; console.error(e); }
}

async function getUserDocRef() {
    if(!isAuthReady || !userId || !db) return null;
    return doc(db, `/artifacts/default-app-id/users/${userId}/frecuencia_central_data/user_metadata`);
}

async function loadUserSessionData() {
    const ref = await getUserDocRef(); if(!ref) return;
    try { const docSnap = await getDoc(ref); if(docSnap.exists()) window.userSessionData={...window.userSessionData,...docSnap.data()}; }
    catch(e){ console.error("Error cargando datos:",e); }
}

async function saveUserSessionData() {
    const ref = await getUserDocRef(); if(!ref) return;
    try{ await setDoc(ref, window.userSessionData,{merge:true}); } catch(e){ console.error("Error guardando datos:",e);}
}

window.handleQuickSelect = category => { document.getElementById('emotion-input').value=`Quiero una sesión de ${category}`; handleInput(); };

window.handleInput = () => {
    const input = document.getElementById('emotion-input').value.toLowerCase();
    let key='Default';
    if(input.includes('miedo')||input.includes('asustado')||input.includes('ansiedad')) key='Miedo';
    else if(input.includes('dinero')||input.includes('éxito')||input.includes('ascender')||input.includes('ambición')) key='Dinero';
    else if(input.includes('pérdida')||input.includes('duelo')||input.includes('triste')||input.includes('solo')) key='Duelo';
    else if(input.includes('dormir')||input.includes('descanso')||input.includes('sueño')) key='Sueño';

    window.currentSessionName=key; window.currentSessionCategory=EMOTIONAL_MAP[key];
    window.sessionLength=window.currentSessionCategory.duration;
    const responseText=`${window.currentSessionCategory.voice}\nMúsica: ${window.currentSessionCategory.sound}\nVibración: ${window.currentSessionCategory.vibrationPattern.join(', ')} ms\nDuración: ${Math.floor(window.sessionLength/60)} min.`;
    document.getElementById('ai-response-text').textContent=responseText;
    document.getElementById('initial-view').classList.add('hidden');
    document.getElementById('response-view').classList.remove('hidden');
};

window.startSession = async type => {
    if(Tone.context.state!=='running') await Tone.start();
    if(type==='free'){ window.sessionLength=8; window.userSessionData.trialUsed=true; window.userSessionData.lastSessionDate=new Date().toISOString().split('T')[0]; await saveUserSessionData(); }
    else if(type==='paid'){ window.sessionLength=window.currentSessionCategory.duration; window.userSessionData.lastSessionDate=new Date().toISOString().split('T')[0]; window.userSessionData.isPaidForToday=true; await saveUserSessionData(); }

    document.getElementById('response-view').classList.add('hidden'); document.getElementById('session-view').classList.remove('hidden');
    document.getElementById('current-category').textContent=`Categoría: ${window.currentSessionName}`;
    document.getElementById('current-sound').textContent=`Sonido: ${window.currentSessionCategory.sound}`;
    document.getElementById('current-vibration').textContent=`Vibración: ${window.currentSessionCategory.vibrationPattern.join(', ')} ms`;
    document.getElementById('session-guide').textContent=`— ${window.currentSessionCategory.voice.split(':')[0]} —`;

    if(window.synth) window.synth.dispose();
    window.synth=new Tone.Synth({oscillator:{type:'sine'},envelope:{attack:0.5,decay:0.1,sustain:0.9,release:2}}).toDestination();
    window.synth.triggerAttack((window.currentSessionCategory.vibrationPattern[1]||100)*2, Tone.now());
    startVibration(window.currentSessionCategory.vibrationPattern);

    window.sessionStartTime=Date.now();
    window.sessionTimer=setInterval(updateTimer,1000);
    setTimeout(()=>stopSession('timeout'),window.sessionLength*1000);
};

window.updateTimer=()=>{
    const elapsed=Math.floor((Date.now()-window.sessionStartTime)/1000);
    const remaining=window.sessionLength-elapsed;
    if(remaining<=0){ document.getElementById('timer').textContent='00:00'; stopSession('timeout'); return; }
    const m=String(Math.floor(remaining/60)).padStart(2,'0'), s=String(remaining%60).padStart(2,'0');
    document.getElementById('timer').textContent=`${m}:${s}`;
};

window.stopSession=reason=>{
    clearInterval(window.sessionTimer);
    if(window.synth){ window.synth.triggerRelease(Tone.now()); window.synth=null; }
    navigator.vibrate(0);
    document.getElementById('session-view').classList.add('hidden');
    document.getElementById('initial-view').classList.remove('hidden');
    document.getElementById('emotion-input').value= reason==='timeout'?`✅ Sesión completada (${Math.floor(window.sessionLength/60)} min)`:"Sesión interrumpida";
    resetApp();
};

window.resetApp=()=>{ document.getElementById('session-view').classList.add('hidden'); document.getElementById('response-view').classList.add('hidden'); document.getElementById('initial-view').classList.remove('hidden'); document.getElementById('emotion-input').value=""; };

window.startVibration=pattern=>{ if('vibrate' in navigator){ clearInterval(window.vibeInterval); const total=pattern.reduce((a,b)=>a+b,0); navigator.vibrate(pattern); window.vibeInterval=setInterval(()=>navigator.vibrate(pattern),total); } };

window.showPaymentModal=()=>document.getElementById('payment-modal').classList.remove('hidden');
window.hidePaymentModal=()=>document.getElementById('payment-modal').classList.add('hidden');

window.onload=initializeFirebase;
