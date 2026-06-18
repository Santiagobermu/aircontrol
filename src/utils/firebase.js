import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDYg4_HddIkdsBuMk8td_2A-sOYS8tb8O8",
  authDomain: "aircontrol-skbo-sbg.firebaseapp.com",
  projectId: "aircontrol-skbo-sbg",
  storageBucket: "aircontrol-skbo-sbg.firebasestorage.app",
  messagingSenderId: "588241571134",
  appId: "1:588241571134:web:c830794477a968392a306f",
  measurementId: "G-XXZ19PF4WH"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
