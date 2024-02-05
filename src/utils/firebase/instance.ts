// Import the functions you need from the SDKs you need
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase
const app: App = initializeApp({
  credential: cert('algo-to-the-future-key.json')
});
// Initialize database & auth
const auth = getAuth(app);
const db = getFirestore(app);
const Firebase = { db, auth };

export default Firebase;
