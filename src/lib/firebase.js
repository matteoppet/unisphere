import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Default public Firebase Web SDK configuration (overridable via VITE_FIREBASE_* env vars)
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyDetVNyVMkv7eb3IUaRuziZrp32T2k4LHU',
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

const pickConfigValue = (envVal, fallbackVal) => {
  const cleanedEnv = String(envVal || '').trim();
  if (cleanedEnv) return cleanedEnv;
  return String(fallbackVal || '').trim();
};

export const firebaseConfig = {
  apiKey: pickConfigValue(rawEnv.VITE_FIREBASE_API_KEY, DEFAULT_FIREBASE_CONFIG.apiKey),
  authDomain: pickConfigValue(rawEnv.VITE_FIREBASE_AUTH_DOMAIN, DEFAULT_FIREBASE_CONFIG.authDomain),
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

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Validate connection to Firestore
async function testConnection() {
  if (!isFirebaseConfigured) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline or unreachable, continuing with local fallback.');
    }
  }
}

testConnection().catch(() => {});
