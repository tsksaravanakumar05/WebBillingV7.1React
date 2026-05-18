// shared/helpers/validation.js

/**
 * Validates login form fields.
 * Mirrors the if/else checks from original Login() function.
 * @param {string} username
 * @param {string} password
 * @returns {{ isValid: boolean, errorField: 'username'|'password'|'none', message: string }}
 */
export function validateLoginFields(username, password) {
  if (!username.trim()) {
    return { isValid: false, errorField: "username", message: "Please Enter the Username !!!." };
  }
  if (!password.trim()) {
    return { isValid: false, errorField: "password", message: "Please Enter the Password !!!." };
  }
  return { isValid: true, errorField: "none", message: "" };
}