import { initializeApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(firebaseConfig.projectId && firebaseConfig.apiKey);

export const usingEmulator = import.meta.env.VITE_USE_FIRESTORE_EMULATOR === 'true';

if (!firebaseConfigured && !usingEmulator) {
  console.warn(
    '[Camp Points] Firebase is not configured — the VITE_FIREBASE_* environment ' +
      'variables are missing, so the app is running against a throwaway demo ' +
      'project and nothing will be saved. Set your Firebase keys and rebuild.',
  );
}

const app = initializeApp(
  firebaseConfigured ? firebaseConfig : { projectId: 'demo-camp-points', apiKey: 'demo' },
);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (usingEmulator) {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}
