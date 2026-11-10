const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { execSync } = require('child_process');

const app = express();
const PORT = 3001;
const WEBHOOK_SECRET = 'ILoUhdj2l-GLsiuObekCWkFhzkGUhUQyciBD9t-OTao';
const HERMES_URL = 'http://localhost:8644/webhooks/alexa-ma-class';
const DB_PATH = '/Users/macbookair/.hermes/state.db';

app.use(cors());
app.use(express.json());

// Envoyer au webhook Hermes
async function sendToHermes(query) {
  const payload = JSON.stringify({ payload: { query } });
  const signature = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  const response = await fetch(HERMES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature-256': signature,
    },
    body: payload,
  });

  const data = await response.json();
  return data.delivery_id;
}

// Récupérer la dernière réponse assistant après un timestamp
function getLatestResponse(afterTimestamp) {
  try {
    const result = execSync(
      `sqlite3 "${DB_PATH}" "SELECT content FROM messages WHERE role='assistant' AND timestamp > ${afterTimestamp} AND content NOT LIKE '%{payload.query}%' ORDER BY timestamp DESC LIMIT 1;"`,
      { timeout: 5000 }
    ).toString().trim();
    return result || null;
  } catch (_) {
    return null;
  }
}

// Route principale pour Alexa
app.post('/webhooks/alexa-ma-class', async (req, res) => {
  console.log('📥 Requête Alexa reçue');

  try {
    const intentName = req.body.request?.intent?.name || '';
    const slots = req.body.request?.intent?.slots || {};
    const query = slots.Message?.value || slots.Query?.value || intentName || 'test';

    console.log('🤔 Question:', query);

    // Mode test: réponse simulée (le modèle est rate-limité)
    const simulatedReply = `Bonjour ! Je suis EUNICE, ton assistant vocal. Tu as demandé : "${query}". Le flux fonctionne correctement.`;

    console.log('💬 Réponse (simulée):', simulatedReply.substring(0, 100));

    res.json({
      version: '1.0',
      response: {
        outputSpeech: {
          type: 'PlainText',
          text: simulatedReply,
        },
        shouldEndSession: false,
      },
    });
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    res.json({
      version: '1.0',
      response: {
        outputSpeech: {
          type: 'PlainText',
          text: 'Désolé, une erreur est survenue.',
        },
        shouldEndSession: true,
      },
    });
  }
});

// Route de test
app.get('/', (req, res) => {
  res.json({ status: 'Alexa Proxy OK', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Proxy Alexa démarré sur http://localhost:${PORT}`);
  console.log(`📡 Endpoint: http://localhost:${PORT}/webhooks/alexa-ma-class`);
});
