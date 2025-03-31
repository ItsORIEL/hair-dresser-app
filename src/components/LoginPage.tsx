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
          />
        </div>
        
        <div className="input-wrapper">
          <input
            type="text"
            placeholder="Enter Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        
        <button className="login-button" onClick={handleLogin}>
          Login
        </button>
      </div>
    </div>
  );
};
