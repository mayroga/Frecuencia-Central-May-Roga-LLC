// server.js completo actualizado
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import Stripe from 'stripe';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { Configuration, OpenAIApi } from 'openai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, 'public');

// --- Asegura carpetas sin romper deploy ---
const audioDir = path.join(PUBLIC_DIR, 'audio');
const dataDir = path.join(PUBLIC_DIR, 'data');

if (!existsSync(audioDir)) mkdirSync(audioDir, { recursive: true });
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

// --- Middleware ---
app.use(bodyParser.json());
app.use(express.static(PUBLIC_DIR));

// --- Stripe ---
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Crear sesión de pago
app.post('/create-checkout-session', async (req, res) => {
    const { price, category } = req.body;

    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `Frecuencia Central - ${category}`,
                    },
                    unit_amount: price * 100, // USD cents
                },
                quantity: 1,
            }],
            success_url: `${req.headers.origin}/success.html`,
            cancel_url: `${req.headers.origin}/cancel.html`,
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error creando sesión' });
    }
});

// --- IA Musical/Vibracional (Gemini + OpenAI fallback) ---
const openai = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
}));

async function generarRespuestaEmocional(prompt) {
    // Intentar Gemini
    try {
        const geminiRes = await fetch('https://api.generative.google/v1beta1/text:synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });
        if (geminiRes.ok) {
            const data = await geminiRes.json();
            return data.output || "Respuesta Gemini procesada";
        }
        throw new Error('Gemini falló');
    } catch (err) {
        console.warn('Gemini fallo, usando OpenAI', err.message);
        // Fallback OpenAI
        const completion = await openai.createChatCompletion({
            model: 'gpt-4',
            messages: [{ role: 'user', content: prompt }],
        });
        return completion.data.choices[0].message.content;
    }
}

// --- Endpoint para sesión emocional ---
app.post('/session', async (req, res) => {
    const { userText, language, category } = req.body;

    try {
        // Generar respuesta empática
        const prompt = `Usuario: ${userText}\nCategoría: ${category}\nIdioma: ${language}\nRespuesta emocional, guía musical, vibracional y explicativa:`;
        const respuesta = await generarRespuestaEmocional(prompt);

        // Determinar música y vibración según categoría
        const patrones = {
            miedo: { sonido: 'mar suave + pad cálido', vibracion: [20,220,20] },
            dinero: { sonido: 'piano arpegios ascendentes + viento pinos', vibracion: [70,40,70,40,200] },
            tristeza: { sonido: 'lluvia tenue + cello', vibracion: [40,150,40] },
            energia: { sonido: 'aves matutinas + guitarra acústica', vibracion: [70,40,70,40,200] },
            amor: { sonido: 'lluvia fina + guitarra jazz + piano', vibracion: [120,60,120,120] },
            // Añadir más categorías según mapa
        };
        const config = patrones[category.toLowerCase()] || { sonido: 'pad neutro', vibracion: [20,20,20] };

        res.json({
            respuesta,
            sonido: config.sonido,
            vibracion: config.vibracion,
            duracion: 20 // minutos máximo
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error generando sesión' });
    }
});

// --- Pages ---
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/success', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'success.html')));
app.get('/cancel', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'cancel.html')));

// --- Start server ---
app.listen(PORT, () => {
    console.log(`Server corriendo en: http://localhost:${PORT}`);
    console.log(`Available at your primary URL ${process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`}`);
});
