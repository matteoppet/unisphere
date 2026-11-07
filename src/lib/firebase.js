import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

const rawEnv =
  (typeof import.meta !== 'undefined' && import.meta.env) ||
  (typeof process !== 'undefined' && process.env) ||
  {};

const pickConfigValue = (envVal) => String(envVal || '').trim();

export const firebaseConfig = {
  apiKey: pickConfigValue(rawEnv.VITE_FIREBASE_API_KEY),
  authDomain: pickConfigValue(rawEnv.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: pickConfigValue(rawEnv.VITE_FIREBASE_PROJECT_ID),
  storageBucket: pickConfigValue(rawEnv.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: pickConfigValue(rawEnv.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: pickConfigValue(rawEnv.VITE_FIREBASE_APP_ID),
  measurementId: pickConfigValue(rawEnv.VITE_FIREBASE_MEASUREMENT_ID),
  firestoreDatabaseId: pickConfigValue(rawEnv.VITE_FIREBASE_FIRESTORE_DATABASE_ID),
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
    dbInstance = firebaseConfig.firestoreDatabaseId
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
  } catch (err) {
    console.warn('Firebase initialization skipped, continuing in local mode:', err);
  }
}

export const auth = authInstance;
export const db = dbInstance;

// Validate connection to Firestore when configured
async function testConnection() {
  if (!isFirebaseConfigured || !db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline or unreachable, continuing with local fallback.');
    }
  }
}

testConnection().catch(() => {});
