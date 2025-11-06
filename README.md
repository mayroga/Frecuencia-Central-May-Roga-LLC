<!-- File: README.md -->
# Frecuencia Central - May Roga LLC

## Contenido
- server.js (Express backend)
- public/index.html (Frontend)
- public/app.js (Frontend logic)
- public/style.css (CSS)
- public/audio/ (generados TTS)
- public/data/sessions.json (DB simple)

## Variables de entorno a configurar en Render
- GEMINI_API_KEY = (clave para TTS/IA)
- STRIPE_SECRET_KEY = (clave secreta Stripe)
- STRIPE_WEBHOOK_SECRET = (secret para verificar webhooks)

## Instalación y ejecución (Render)
1. `npm install express stripe body-parser cors node-fetch fs-extra`
2. Subir proyecto a GitHub y conectar a Render.
3. Configurar variables de entorno en Render.
4. Deploy: Render ejecutará `node server.js` (o configura start script).

## Notas
- El endpoint `/ai-response` espera que la API de Gemini devuelva `audioContent` base64. Ajustar según la API real.
- Webhook de Stripe debe apuntar a `/webhook` (usar STRIPE_WEBHOOK_SECRET).
- Los archivos TTS se almacenan en `public/audio` y se exponen estáticamente.
