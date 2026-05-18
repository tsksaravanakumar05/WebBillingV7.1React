// presentation/hooks/useLogin.js
// Replaces the Login() function + keydown bindings from Login.js
// All state: form values, errors, loading, password visibility

import { useState, useCallback } from "react";
import { LoginUseCase } from "../../application/usecases/LoginUseCase.js";
import { AuthRepository } from "../../infrastructure/repositories/AuthRepository.js";
import { validateLoginFields } from "../../shared/helpers/validation.js";

// Wire dependency once — swap AuthRepository with a mock for testing
const loginUseCase = new LoginUseCase(new AuthRepository());

export function useLogin() {
  const [username, setUsernameValue] = useState("");
  const [password, setPasswordValue] = useState("");
  const [usernameError, setUsernameError] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const setUsername = useCallback((v) => {
    setUsernameValue(v);
    setUsernameError(false);
  }, []);

  const setPassword = useCallback((v) => {
    setPasswordValue(v);
    setPasswordError(false);
  }, []);

  const togglePasswordVisibility = useCallback(() => {
    setShowPassword((prev) => !prev);
  }, []);

  const handleSubmit = useCallback(async () => {
    // Client-side validation (mirrors original border-red logic)
    const validation = validateLoginFields(username, password);
    if (!validation.isValid) {
      setErrorMessage(validation.message);
      setUsernameError(validation.errorField === "username");
      setPasswordError(validation.errorField === "password");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    const result = await loginUseCase.execute({ username, password });

    setIsLoading(false);

    if (result.success && result.redirectTo) {
      // Same as original: window.location.href = "/Home/Index"
      window.location.href = result.redirectTo;
    } else {
      setErrorMessage(result.errorMessage ?? "Login failed");
    }
  }, [username, password]);

  // Mirrors: $('#txtUsername').bind('keydown') — Enter moves focus to password field
  const handleUsernameKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      document.getElementById("password-input")?.focus();
    }
  }, []);

  // Mirrors: $('#Password').bind('keydown') — Enter triggers login
  const handlePasswordKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      handleSubmit();
    }
  }, [handleSubmit]);

  return {
    username,
    password,
    usernameError,
    passwordError,
    errorMessage,
    isLoading,
    showPassword,
    setUsername,
    setPassword,
    togglePasswordVisibility,
    handleSubmit,
    handleUsernameKeyDown,
    handlePasswordKeyDown,
  };
}