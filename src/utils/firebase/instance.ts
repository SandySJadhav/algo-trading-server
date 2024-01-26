// Import the functions you need from the SDKs you need
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase
const firebaseApp = initializeApp({
  credential: cert('algo-to-the-future-key.json')
});
// Initialize auth & provider

const db = getFirestore(firebaseApp);

const Firebase = { db };

export default Firebase;
