// public/app.js
import { soundMap } from './soundMap.js';

// Detectar idioma automáticamente
function detectLanguage(text) {
    const langRegex = /^[\u0000-\u007F]*$/; // ASCII básico = inglés
    if (/^[\p{L}\s]+$/u.test(text)) return 'es'; // simplificación: todo no ASCII = español
    return 'en';
}

// Mostrar mensaje IA en la UI
function showMessage(message) {
    const chatBox = document.getElementById('chatBox');
    const p = document.createElement('p');
    p.textContent = message;
    chatBox.appendChild(p);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Reproducir sonido y vibración según categoría
function playSound(category) {
    const config = soundMap[category];
    if (!config) return;

    // Reproducir audio
    config.audio.forEach(src => {
        const audio = new Audio(src);
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Audio error:', e));
    });

    // Vibración si está disponible
    if (navigator.vibrate && config.vibration) {
        navigator.vibrate(config.vibration);
    }

    // Mensaje de guía
    showMessage(config.message);
}

// Manejar prompt de usuario
async function handlePrompt() {
    const input = document.getElementById('userInput');
    const prompt = input.value.trim();
    if (!prompt) return;

    input.value = '';
    const lang = detectLanguage(prompt);
    showMessage(lang === 'es' ? `Tú: ${prompt}` : `You: ${prompt}`);

    // Buscar categoría más cercana (simplificación: palabras clave)
    let category = 'calma'; // default
    const lower = prompt.toLowerCase();
    if (lower.includes('asustado') || lower.includes('miedo')) category = 'miedo';
    else if (lower.includes('dinero') || lower.includes('pobre')) category = 'abundancia';
    else if (lower.includes('cansado') || lower.includes('aburrido')) category = 'energia';
    else if (lower.includes('amor') || lower.includes('pareja')) category = 'amor';
    else if (lower.includes('duelo') || lower.includes('triste')) category = 'duelo';
    else if (lower.includes('seguridad') || lower.includes('confianza')) category = 'seguridad';
    else if (lower.includes('dormir') || lower.includes('sueño')) category = 'sueño';
    
    // Reproducir la sesión musical + vibración + mensaje
    playSound(category);
}

// Botón de inicio
document.getElementById('startBtn').addEventListener('click', () => {
    handlePrompt();
});

// Opcional: escuchar Enter en el input
document.getElementById('userInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handlePrompt();
});

// Modo gratuito de 8 segundos (solo una vez)
let freeUsed = false;
document.getElementById('freeBtn')?.addEventListener('click', () => {
    if (freeUsed) {
        alert('Ya usaste tu acceso gratuito de 8 segundos.');
        return;
    }
    freeUsed = true;
    showMessage('Iniciando sesión gratuita de 8 segundos...');
    // Selección automática de música/sonido más genérico
    playSound('calma');
    setTimeout(() => {
        showMessage('Fin de la sesión gratuita.');
    }, 8000);
});
