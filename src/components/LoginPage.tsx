// src/components/LoginPage.tsx
import React, { useState } from 'react';
import './LoginPage.css';

interface LoginPageProps {
  name: string;
  phone: string;
  setName: (name: string) => void;
  setPhone: (phone: string) => void;
  handleLogin: () => void;
  startPhoneVerification: (phoneNumber: string) => Promise<boolean>;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  name,
  phone,
  setName,
  setPhone,
  handleLogin,
  startPhoneVerification
}) => {
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Function to format and validate Israeli phone number
  const formatIsraeliPhone = (input: string): string => {
    // Remove all non-digit characters
    let cleaned = input.replace(/\D/g, '');
    
    // Check if it starts with "0" (Israeli prefix) and convert to international format
    if (cleaned.startsWith('0')) {
      cleaned = '972' + cleaned.substring(1);
    }
    
    // If doesn't have country code, add Israeli code
    if (!cleaned.startsWith('972') && cleaned.length > 0) {
      cleaned = '972' + cleaned;
    }
    
    // Format with "+" prefix
    return cleaned ? '+' + cleaned : '';
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Always store the formatted version
    const formattedPhone = formatIsraeliPhone(value);
    setPhone(formattedPhone);
    setPhoneError(null);
  };

  const handleSubmit = async () => {
    // Reset errors
    setPhoneError(null);
    
    // Validate Israeli phone number (basic validation)
    // Israeli mobile numbers: +972-5X-XXX-XXXX (where X is a digit)
    const phoneRegex = /^\+972(5\d{8})$/;
    
    if (!phoneRegex.test(phone)) {
      setPhoneError("Please enter a valid Israeli mobile number (+972-5X-XXX-XXXX)");
      return;
    }
    
    if (!name.trim()) {
      return; // Name validation can be handled elsewhere
    }

    setLoading(true);
    try {
      // Start phone verification
      const verificationStarted = await startPhoneVerification(phone);
      
      if (!verificationStarted) {
        setPhoneError("Couldn't send verification code. Please try again.");
      }
      // Don't proceed to handleLogin here - that will happen after verification
    } catch (error) {
      console.error("Phone verification error:", error);
      setPhoneError("Failed to start verification. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Optional decorative background circles */}
      <div className="bg-circle1"></div>
      <div className="bg-circle2"></div>
      
      <div className="login-card">
        <h2 className="title">Sign In</h2>
        
        <div className="input-wrapper">
          <input
            type="text"
            placeholder="Enter Username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <div className="input-wrapper">
          <input
            type="tel"
            placeholder="Enter Phone Number (05X-XXX-XXXX)"
            value={phone.replace(/^\+972/, '0')} // Display in local format for user
            onChange={handlePhoneChange}
            className={phoneError ? 'error-input' : ''}
            disabled={loading}
          />
          {phoneError && <p className="error-message">{phoneError}</p>}
          <p className="helper-text">Enter Israeli mobile number (e.g., 050-123-4567)</p>
        </div>
        
        <button 
          className="login-button" 
          onClick={handleSubmit}
          disabled={loading || !name.trim() || phone.length < 10}
        >
          {loading ? 'Processing...' : 'Continue'}
        </button>
      </div>
    </div>
  );
};