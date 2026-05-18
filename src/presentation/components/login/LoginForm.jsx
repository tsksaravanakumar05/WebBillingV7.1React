// presentation/components/LoginForm.jsx
// Dumb component — only renders, all logic lives in useLogin hook

import React from "react";
import styles from "../../../shared/styles/login.module.css";

export function LoginForm({
  username,
  password,
  usernameError,
  passwordError,
  errorMessage,
  isLoading,
  showPassword,
  onUsernameChange,
  onPasswordChange,
  onUsernameKeyDown,
  onPasswordKeyDown,
  onTogglePassword,
  onSubmit,
}) {
  return (
    <>
      {/* Email field */}
      <div className={styles.formLogin}>
        <label htmlFor="username-input">Email Id</label>
        <div className={styles.formAddons}>
          <input
            id="username-input"
            type="text"
            autoFocus
            placeholder="Enter your email address"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            onKeyDown={onUsernameKeyDown}
            className={usernameError ? styles.inputError : ""}
          />
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      {/* Password field */}
      <div className={styles.formLogin}>
        <label htmlFor="password-input">Password</label>
        <div className={styles.passGroup}>
          <input
            id="password-input"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            onKeyDown={onPasswordKeyDown}
            className={passwordError ? styles.inputError : ""}
          />
          {/* Toggle visibility — mirrors original .toggle-password span */}
          <span
            className={styles.togglePassword}
            onClick={onTogglePassword}
            role="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </span>
        </div>
      </div>

      {/* Error message — replaces original #msg paragraph */}
      <div className={styles.errorMsg} role="alert" aria-live="polite">
        {errorMessage}
      </div>

      {/* Submit — replaces #login-submit anchor tag */}
      <div className={styles.formLogin}>
        <button
          className={styles.btnLogin}
          onClick={onSubmit}
          disabled={isLoading}
          type="button"
        >
          {isLoading ? "Signing in…" : "Sign In"}
        </button>
      </div>

      <div className={styles.formLogin}>
        <div className={styles.poweredBy}>
          Powered By Kassapos Software Solutions
        </div>
      </div>
    </>
  );
}