import express from 'express';
import bodyParser from 'body-parser';
import admin from 'firebase-admin';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(bodyParser.json());

// Initialize Firebase Admin
// Prefer using env var FIREBASE_SERVICE_ACCOUNT_JSON (set to full JSON string)
// Fallback: local file serviceAccountKey.json if present (for local dev only)
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // DO NOT commit serviceAccountKey.json to git. This is only for local dev.
    admin.initializeApp({ credential: admin.credential.cert(require('./serviceAccountKey.json')) });
  }
} catch (e) {
  console.error('Firebase admin initialization error:', e.message);
}

const db = admin.firestore();

// Twilio client (optional — only if env vars set)
const TW_SID = process.env.TW_SID;
const TW_TOKEN = process.env.TW_TOKEN;
const TW_FROM = process.env.TW_FROM;
const twClient = TW_SID && TW_TOKEN ? twilio(TW_SID, TW_TOKEN) : null;

// Health check
app.get('/health', (req, res) => res.json({ ok: true, time: Date.now() }));

// Create an SOS incident and notify contacts
app.post('/api/sos', async (req, res) => {
  try {
    const { userId, lat, lon, accuracy, extra } = req.body;
    if (!userId || !lat || !lon) return res.status(400).json({ ok: false, error: 'Missing required fields' });

    // Fetch user & contacts
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.exists ? userDoc.data() : { name: 'Unknown', emergencyContacts: [] };
    const contacts = user.emergencyContacts || [];

    // Create incident
    const incidentRef = await db.collection('incidents').add({
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active',
      location: { lat, lon, accuracy: accuracy || null },
      liveLocations: [],
      escalation: [],
      extra: extra || {}
    });
    const incidentId = incidentRef.id;

    // Notify contacts: try FCM (if token exists) otherwise SMS via Twilio
    for (const c of contacts) {
      try {
        if (c.fcmToken) {
          await admin.messaging().send({
            token: c.fcmToken,
            notification: { title: 'SOS Alert', body: `${user.name || 'Someone'} triggered an SOS.` },
            data: { incidentId, lat: String(lat), lon: String(lon) }
          });
        } else if (twClient && c.phone) {
          await twClient.messages.create({
            from: TW_FROM,
            to: c.phone,
            body: `SOS Alert: ${user.name || 'User'} needs help. Location: https://maps.google.com/?q=${lat},${lon}`
          });
        } else {
          console.log('No contact channel for', c);
        }
      } catch (notifyErr) {
        console.error('Notify error for contact', c, notifyErr?.message || notifyErr);
      }
    }

    return res.json({ ok: true, incidentId });
  } catch (err) {
    console.error('API /api/sos error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Append live location to an active incident
app.post('/api/sos/live', async (req, res) => {
  try {
    const { incidentId, lat, lon, ts } = req.body;
    if (!incidentId || !lat || !lon) return res.status(400).json({ ok: false, error: 'Missing fields' });

    await db.collection('incidents').doc(incidentId).update({
      liveLocations: admin.firestore.FieldValue.arrayUnion({ lat, lon, ts: ts || Date.now() })
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error('API /api/sos/live error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`SOS backend running on port ${PORT}`));
