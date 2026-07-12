/**
 * PG Education - Firebase Configuration
 * Initializes Firebase App, Authentication, Firestore Database, and Cloud Storage.
 * 
 * IMPORTANT: Replace the firebaseConfig object values with your actual Firebase Project credentials
 * from the Firebase Console (Project Settings > General > Your apps > Web app).
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",                           // Replace with your API Key
    authDomain: "pg-education-erp.firebaseapp.com",   // Replace with your Auth Domain
    projectId: "pg-education-erp",                    // Replace with your Project ID
    storageBucket: "pg-education-erp.appspot.com",    // Replace with your Storage Bucket
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",    // Replace with your Sender ID
    appId: "YOUR_APP_ID"                              // Replace with your App ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Configure Auth Language to use Device Default (Optional but good practice)
auth.useDeviceLanguage();

// Export services for use in other modules
export { app, auth, db, storage };