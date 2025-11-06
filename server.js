// Detectar idioma usando OpenAI (solo texto)
import express from 'express';
import bodyParser from 'body-parser';
import OpenAI from 'openai';
const app = express();
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/detect-language', async (req,res)=>{
    try {
        const { text } = req.body;
        if(!text) return res.json({ language: 'es' });

        const resp = await openai.chat.completions.create({
            model:'gpt-3.5-turbo',
            messages:[{ role:'system', content:'Detecta el idioma del texto y responde solo con el código ISO 639-1 (ej: "es", "en").' },
                      { role:'user', content: text }]
        });
        const lang = resp.choices[0].message.content.trim();
        res.json({ language: lang });
    } catch(err){
        console.error(err);
        res.json({ language: 'es' });
    }
});

app.listen(5000, ()=>console.log('Server running on port 5000'));
