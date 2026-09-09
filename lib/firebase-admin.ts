import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

if (!getApps().length) {
  try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      try {
        const serviceAccount = require('@/serviceAccountKey.json');
        initializeApp({
          credential: cert(serviceAccount),
        });
      } catch {
        // serviceAccountKey.json not present in dev
      }
    }
  } catch (error) {
    console.error('Firebase Admin initialization notice:', error);
  }
}

export const getFirebaseAuth = () => {
  if (getApps().length > 0) {
    return getAuth();
  }
  return null;
};
