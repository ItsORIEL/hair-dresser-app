import React from 'react';
import './LoginPage.css';

interface LoginPageProps {
  name: string;
  phone: string;
  setName: (name: string) => void;
  setPhone: (phone: string) => void;
  handleLogin: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  name,
  phone,
  setName,
  setPhone,
  handleLogin,
}) => {
  // Function to format the phone number input
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove any non-digit characters and ensure it doesn't have the prefix already
    let value = e.target.value.replace(/\D/g, '');
    
    // Remove leading 0 if present (Israeli numbers typically start with 0)
    if (value.startsWith('0')) {
      value = value.substring(1);
    }
    
    // Set the phone number without the prefix in the state
    // The actual value with prefix will be constructed when needed
    setPhone(value);
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
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
            onKeyPress={handleKeyPress}
          />
        </div>
        
        <div className="input-wrapper phone-input-wrapper">
          <div className="phone-prefix">+972</div>
          <input
            type="tel"
            className="phone-input"
            placeholder="5XXXXXXXX"
            value={phone}
            onChange={handlePhoneChange}
            onKeyPress={handleKeyPress}
          />
        </div>
        
        <button className="login-button" onClick={handleLogin}>
          Login
        </button>
      </div>
    </div>
  );
};