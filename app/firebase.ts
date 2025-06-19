import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAkcGLWZBtKtuWVzxY0aKk2Hm8224VZ6ao",
  authDomain: "greenwash-5365b.firebaseapp.com",
  projectId: "greenwash-5365b",
  storageBucket: "greenwash-5365b.firebasestorage.app",
  messagingSenderId: "294149249754",
  appId: "1:294149249754:web:013329686e7194499c23e3",
  measurementId: "G-N3EK9EY9N0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
export { signInWithPopup, signOut };