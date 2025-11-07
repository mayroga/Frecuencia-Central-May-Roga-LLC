# Frecuencia Central - May Roga LLC

**Plataforma de terapia vibracional, música y bienestar natural con IA y Stripe**

---

## Descripción

Frecuencia Central permite a los usuarios experimentar sesiones de bienestar personalizadas combinando:

- Música y frecuencias vibracionales ajustables.
- Estados de ánimo para guiar la sesión.
- Chat IA activo desde el inicio para consultas personalizadas.
- Sesiones gratuitas de prueba.
- Acceso a micro-sesiones, sesiones completas y VIP.

El sistema permite reproducir pistas pregrabadas o generadas por IA según el estado de ánimo del usuario. Todo se integra con pagos seguros mediante Stripe.

---

## Funcionalidades principales

- Guía inicial del usuario con selección de estado de ánimo.
- Sesión gratuita de 8 segundos con temporizador y aviso al finalizar.
- Ajuste de volumen/intensidad (slider) para frecuencia + música.
- Chat IA activo desde el inicio y disponible para consultas personalizadas.
- Reproducción de audio según el estado de ánimo usando pistas mp3 pregrabadas.
- Micro-sesiones y sesiones VIP, con pagos a través de Stripe.
- Registro de sesiones en JSON para historial.
- Acceso especial de prueba de 5 minutos a todos los servicios (para administrador o pruebas internas).

---

## Instalación

1. Clonar el repositorio:

```bash
git clone https://github.com/tuusuario/frecuencia-central.git
cd frecuencia-central
npm install
/public
    /audio       <-- pistas mp3
    /data        <-- sesiones y DB en JSON
    index.html
    app.js
    style.css
server.js
package.json
README.md
Notas

Las pistas de audio deben colocarse en /public/audio con nombres predefinidos según estado de ánimo.

No se requieren cambios adicionales para Stripe o Gemini, el backend ya maneja pagos y generación de audio TTS.

Esta versión está lista para producción en Render o cualquier servidor compatible con Node.js 18+.

Sesión de prueba interna: puedes probar todos los servicios 5 minutos usando la cuenta de prueba sin revelar a los usuarios.

Autor

Maykel Rodriguez Garcia
May Roga LLC - Terapia de bienestar y risoterapia en línea
