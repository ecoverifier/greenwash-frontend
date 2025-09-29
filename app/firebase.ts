// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAkcGLWZBtKtuWVzxY0aKk2Hm8224VZ6ao",
  authDomain: "greenwash-5365b.firebaseapp.com",
  projectId: "greenwash-5365b",
  storageBucket: "greenwash-5365b.firebasestorage.app",
  messagingSenderId: "294149249754",
  appId: "1:294149249754:web:013329686e7194499c23e3",
  measurementId: "G-N3EK9EY9N0"
};

const app = initializeApp(firebaseConfig);

// ✅ EXPORTS
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const db = getFirestore(app);

export { auth, provider, db, signInWithPopup, signOut };