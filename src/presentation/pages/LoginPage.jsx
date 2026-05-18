// presentation/pages/LoginPage.jsx

import React from "react";
import { LoginForm } from "../components/login/LoginForm.jsx";
import { useLogin } from "../hooks/useLogin.js";
import styles from "../../shared/styles/login.module.css";
import loginImg from "../../assets/logo.png";
import SideImg from "../../assets/Image.png";

export function LoginPage() {
  const login = useLogin();

  return (
    <>
      {/* --- INLINE STYLES FOR ANIMATIONS --- */}
      <style>
        {`
          @keyframes fadeSlideUp {
            0% { opacity: 0; transform: translateY(40px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes slowZoom {
            0% { transform: scale(1); }
            50% { transform: scale(1.06); }
            100% { transform: scale(1); }
          }

          @keyframes fadeIn {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }

          .anim-item {
            opacity: 0;
            animation: fadeSlideUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          }

          .delay-1 { animation-delay: 0.1s; }
          .delay-2 { animation-delay: 0.3s; }
          .delay-3 { animation-delay: 0.5s; }

          .anim-bg-image {
            animation: fadeIn 1.2s ease-out forwards, slowZoom 25s ease-in-out infinite alternate;
          }
        `}
      </style>

      <div 
        className={styles.accountPage} 
        style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden', margin: 0, padding: 0 }}
      >
        
        {/* --- LEFT PANEL (Login Form) --- */}
        <div 
          className={styles.loginContent} 
          style={{ 
            flex: '0 0 50%', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            backgroundColor: '#ffffff',
            padding: '2rem',
            position: 'relative',
            zIndex: 2,
            boxShadow: '10px 0 25px rgba(0,0,0,0.05)' // Subtle shadow separating left from right
          }}
        >
          <div className={styles.loginUserset} style={{ width: '100%', maxWidth: '480px' }}>
            
            {/* Animated Logo */}
            <div className={`anim-item delay-1 ${styles.loginLogo}`} style={{ textAlign: 'center', marginBottom: '40px' }}>
              <img src={loginImg} alt="CloudPOS" style={{ maxWidth: '260px', height: 'auto', dropShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
            </div>

            {/* Animated Heading */}
            <div className={`anim-item delay-2 ${styles.loginUserheading}`} style={{ textAlign: 'center', marginBottom: '35px' }}>
              <h3 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1f2937', marginBottom: '8px' }}>Sign In</h3>
              <h4 style={{ fontSize: '16px', color: '#6b7280', fontWeight: 'normal' }}>
                Please login to your account
              </h4>
            </div>

            {/* Animated Form */}
            <div className="anim-item delay-3">
              <LoginForm
                username={login.username}
                password={login.password}
                usernameError={login.usernameError}
                passwordError={login.passwordError}
                errorMessage={login.errorMessage}
                isLoading={login.isLoading}
                showPassword={login.showPassword}
                onUsernameChange={login.setUsername}
                onPasswordChange={login.setPassword}
                onUsernameKeyDown={login.handleUsernameKeyDown}
                onPasswordKeyDown={login.handlePasswordKeyDown}
                onTogglePassword={login.togglePasswordVisibility}
                onSubmit={login.handleSubmit}
              />
            </div>

          </div>
        </div>

        {/* --- RIGHT PANEL (Decorative Image) --- */}
        <div 
          className={styles.loginImg} 
          style={{ 
            flex: '0 0 50%', 
            height: '100vh',
            backgroundColor: '#f3f4f6',
            overflow: 'hidden', // zoom aagumbodhu veliya pogaama thadukka
            position: 'relative'
          }}
        >
          {/* Oru dark overlay - Image mela light-aaga podalam, paarka premium-ah irukkum */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(135deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.3) 100%)',
            zIndex: 1
          }}></div>

          <img 
            src={SideImg} 
            alt="Login Decoration" 
            className="anim-bg-image"
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              transformOrigin: 'center center' 
            }} 
          />
        </div>

      </div>
    </>
  );
}