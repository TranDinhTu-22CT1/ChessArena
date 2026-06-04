import { initializeApp } from 'firebase/app';
import {
  browserSessionPersistence,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  GithubAuthProvider,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  getAuth,
  linkWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserSessionPersistence).catch(() => {});
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
githubProvider.addScope('user:email');

export {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  GithubAuthProvider,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  linkWithCredential,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
};
