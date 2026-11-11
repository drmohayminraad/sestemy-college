import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// إعدادات مشروع Firebase الخاص بـ Sestemy College
const firebaseConfig = {
  apiKey: 'AIzaSyBjji-fkyf2_LzljSXVuz-xjkkgRmP3Kog',
  authDomain: 'sestemy-college.firebaseapp.com',
  projectId: 'sestemy-college',
  storageBucket: 'sestemy-college.firebasestorage.app',
  messagingSenderId: '984301462987',
  appId: '1:984301462987:web:3b987c1bdaca984bd9824e',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
