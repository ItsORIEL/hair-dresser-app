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
      setAuthError(error.message || 'Failed to sign in with Google. Please try again.');
      setLoadingApp(false); // Ensure loading stops on error
    }
  };

  return (
    <div className="login-container">
      <div className="bg-circle1"></div>
      <div className="bg-circle2"></div>
      <div className="login-card">
        <h2 className="title">Sign In / Sign Up</h2>
        <p style={{ marginBottom: '30px', fontSize: '0.9em', color: '#555' }}>
          Continue with Google to book your appointment.
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
          Sign in with Google
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