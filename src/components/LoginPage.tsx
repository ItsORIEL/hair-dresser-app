// src/components/LoginPage.tsx
import React, { useState } from 'react';
import './LoginPage.css';
import { signInWithGoogle } from '../services/firebase-service';

// Import the SVG path
import googleLogoUrl from '../assets/google-logo.svg';

interface LoginPageProps {
  setLoadingApp: (loading: boolean) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  setLoadingApp,
}) => {
  const [authError, setAuthError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoadingApp(true);
    setAuthError(null);
    try {
      await signInWithGoogle();
      // Listener in App.tsx handles success
    } catch (error: any) {
      console.error("Google login failed:", error);
      // The error message from Firebase might be in English or already localized by Firebase.
      // If you want to display a generic Hebrew error:
      // setAuthError('ההתחברות עם גוגל נכשלה. אנא נסה שנית.'); 
      // Or display the error message from Firebase (which might not be in Hebrew):
      setAuthError(error.message || 'ההתחברות עם גוגל נכשלה. אנא נסה שנית.');
      setLoadingApp(false); // Ensure loading stops on error
    }
  };

  return (
    <div className="login-container">
      <div className="bg-circle1"></div>
      <div className="bg-circle2"></div>
      <div className="login-card">
        {/* Translated Title */}
        <h2 className="title">כניסה / הרשמה</h2>
        {/* Translated Subtitle */}
        <p style={{ marginBottom: '30px', fontSize: '0.9em', color: '#555' }}>
          המשך עם גוגל כדי לקבוע את התור שלך.
        </p>
        <button
          className="login-button google-button"
          onClick={handleGoogleLogin}
        >
          <img
            src={googleLogoUrl}
            alt="Google G Logo" // Alt text can remain in English or be translated
            style={{ width: '18px', height: '18px', marginRight: '10px', verticalAlign: 'middle' }}
          />
          {/* Translated Button Text */}
          התחבר עם גוגל
        </button>
        {authError && (
          <p style={{ color: 'red', fontSize: '0.8rem', marginTop: '20px' }} role="alert">
            {authError} {/* This will display the error message, potentially in English from Firebase */}
          </p>
        )}
      </div>
    </div>
  );
};