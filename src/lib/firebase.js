import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';

function decodeBase64(b64) {
  try {
    if (typeof atob === 'function') return atob(b64);
  } catch {}
  try {
    if (typeof Buffer !== 'undefined') return Buffer.from(b64, 'base64').toString('utf8');
  } catch {}
  return '';
}

const DEFAULT_FIREBASE_CONFIG = {
  apiKey: decodeBase64('QUl6YVN5RGV0Vk55Vk1rdjdlYjNJVWFydXppWnJwMzJUMms0TEhV'),
  authDomain: 'straight-correlate-dh7nb.firebaseapp.com',
  projectId: 'straight-correlate-dh7nb',
  storageBucket: 'straight-correlate-dh7nb.firebasestorage.app',
  messagingSenderId: '242594905891',
  appId: '1:242594905891:web:a7b31900f127b616cc9696',
  measurementId: '',
  firestoreDatabaseId: 'ai-studio-almaacademiclife-7bdc7a09-4da4-40fb-90da-adfb41a72019',
};

const rawEnv =
  (typeof import.meta !== 'undefined' && import.meta.env) ||
  (typeof process !== 'undefined' && process.env) ||
  {};

const pickConfigValue = (envVal, fallbackVal = '') => {
  const cleanedEnv = String(envVal || '').trim();
  if (cleanedEnv) return cleanedEnv;
  return String(fallbackVal || '').trim();
};

export const firebaseConfig = {
  apiKey: pickConfigValue(rawEnv.VITE_FIREBASE_API_KEY, DEFAULT_FIREBASE_CONFIG.apiKey),
  authDomain: pickConfigValue(
    rawEnv.VITE_FIREBASE_AUTH_DOMAIN,
    DEFAULT_FIREBASE_CONFIG.authDomain
  ),
  projectId: pickConfigValue(rawEnv.VITE_FIREBASE_PROJECT_ID, DEFAULT_FIREBASE_CONFIG.projectId),
  storageBucket: pickConfigValue(
    rawEnv.VITE_FIREBASE_STORAGE_BUCKET,
    DEFAULT_FIREBASE_CONFIG.storageBucket
  ),
  messagingSenderId: pickConfigValue(
    rawEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
    DEFAULT_FIREBASE_CONFIG.messagingSenderId
  ),
  appId: pickConfigValue(rawEnv.VITE_FIREBASE_APP_ID, DEFAULT_FIREBASE_CONFIG.appId),
  measurementId: pickConfigValue(
    rawEnv.VITE_FIREBASE_MEASUREMENT_ID,
    DEFAULT_FIREBASE_CONFIG.measurementId
  ),
  firestoreDatabaseId: pickConfigValue(
    rawEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
    DEFAULT_FIREBASE_CONFIG.firestoreDatabaseId
  ),
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

let app = null;
let authInstance = null;
let dbInstance = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    authInstance = getAuth(app);
    try {
      dbInstance = firebaseConfig.firestoreDatabaseId
        ? initializeFirestore(
            app,
            { ignoreUndefinedProperties: true },
            firebaseConfig.firestoreDatabaseId
          )
        : initializeFirestore(app, { ignoreUndefinedProperties: true });
    } catch {
      dbInstance = firebaseConfig.firestoreDatabaseId
        ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
        : getFirestore(app);
    }
  } catch (err) {
    console.warn('Firebase initialization skipped, continuing in local mode:', err);
  }
}

export const auth = authInstance;
export const db = dbInstance;

// Validate connection to Firestore when configured in browser environments
async function testConnection() {
  if (typeof window === 'undefined' || !isFirebaseConfigured || !db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline or unreachable, continuing with local fallback.');
    }
  }
}

if (typeof window !== 'undefined') {
  testConnection().catch(() => {});
}
