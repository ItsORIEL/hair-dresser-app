// src/components/LoginPage.tsx
import React, { useState } from 'react';
import './LoginPage.css';
import { signInWithGoogle } from '../services/firebase-service';

// Import the SVG path
import googleLogoUrl from '../assets/google-logo.svg';

interface LoginPageProps {
  setLoadingApp: (loading: boolean) => void;
  onAuthErrorSuggestExternalBrowser: () => void; // MODIFIED: New prop
}

export const LoginPage: React.FC<LoginPageProps> = ({
  setLoadingApp,
  onAuthErrorSuggestExternalBrowser, // MODIFIED: Destructure new prop
}) => {
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoadingApp(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
      // Listener in App.tsx handles success and navigation
      // setLoadingApp(false) will be handled by App.tsx's auth listener
    } catch (error: any) {
      console.error("Google login failed:", error);
      const errorMessage = error.message || 'ההתחברות עם גוגל נכשלה. אנא נסה שנית.';
      setAuthError(errorMessage);
      setLoadingApp(false); // Ensure loading stops on error

      // MODIFIED: Check for specific error codes or messages
      // Firebase error codes: 'auth/missing-initial-state', 'auth/storage-unsupported'
      // The message check is a fallback but less robust.
      if (
        error.code === 'auth/missing-initial-state' ||
        error.code === 'auth/storage-unsupported' ||
        (typeof errorMessage === 'string' &&
         (errorMessage.toLowerCase().includes('missing initial state') ||
          errorMessage.toLowerCase().includes('storage is inaccessible') ||
          errorMessage.toLowerCase().includes('storage-partitioned browser environment')))
      ) {
        onAuthErrorSuggestExternalBrowser(); // Trigger the guidance page via App.tsx
      }
    }
  };

  return (
    <div className="login-container">
      <div className="bg-circle1"></div>
      <div className="bg-circle2"></div>
      <div className="login-card">
        <h2 className="title">כניסה / הרשמה</h2>
        <p style={{ marginBottom: '30px', fontSize: '0.9em', color: '#555' }}>
          המשך עם גוגל כדי לקבוע את התור שלך.
        </p>
        <button
          className="login-button google-button"
          onClick={handleGoogleLogin}
        >
          <img
            src={googleLogoUrl}
            alt="Google G Logo"
            style={{ width: '18px', height: '18px', marginRight: '10px', verticalAlign: 'middle' }}
          />
          התחבר עם גוגל
        </button>
        {authError && (
          <p style={{ color: 'red', fontSize: '0.8rem', marginTop: '20px' }} role="alert">
            {authError}
          </p>
        )}
      </div>
    </div>
  );
};