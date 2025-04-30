// src/components/PinVerificationPage.tsx
import React, { useState, useEffect } from 'react';
import './PinVerificationPage.css';

interface PinVerificationPageProps {
  phoneNumber: string;
  onVerificationComplete: () => void;
  onCancel: () => void;
  onResendCode: () => void;
  verifyCode: (code: string) => Promise<boolean>;
}

export const PinVerificationPage: React.FC<PinVerificationPageProps> = ({
  phoneNumber,
  onVerificationComplete,
  onCancel,
  onResendCode,
  verifyCode
}) => {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(60);
  const [canResend, setCanResend] = useState<boolean>(false);

  // Countdown timer for resending code
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers and limit to 6 digits
    if (/^\d*$/.test(value) && value.length <= 6) {
      setPin(value);
      setError(null);
    }
  };

  const handleVerify = async () => {
    if (pin.length !== 6) {
      setError('Please enter a 6-digit verification code');
      return;
    }

    setLoading(true);
    try {
      const isVerified = await verifyCode(pin);
      if (isVerified) {
        onVerificationComplete();
      } else {
        setError('Invalid verification code. Please try again.');
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
      console.error('Verification error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = () => {
    if (canResend) {
      onResendCode();
      setCountdown(60);
      setCanResend(false);
    }
  };

  return (
    <div className="pin-verification-container">
      <div className="pin-verification-card">
        <h2 className="title">Verify Phone Number</h2>
        
        <p className="verification-info">
          We've sent a verification code to <strong>{phoneNumber}</strong>
        </p>
        
        <div className="input-wrapper">
          <input
            type="text"
            placeholder="Enter 6-digit code"
            value={pin}
            onChange={handleInputChange}
            className={error ? 'error' : ''}
            disabled={loading}
          />
          {error && <p className="error-message">{error}</p>}
        </div>
        
        <button 
          className="verify-button" 
          onClick={handleVerify}
          disabled={loading || pin.length !== 6}
        >
          {loading ? 'Verifying...' : 'Verify Code'}
        </button>
        
        <div className="resend-section">
          {canResend ? (
            <button 
              className="resend-button" 
              onClick={handleResendCode}
            >
              Resend Code
            </button>
          ) : (
            <p className="countdown">
              Resend code in {countdown} seconds
            </p>
          )}
        </div>
        
        <button className="cancel-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};