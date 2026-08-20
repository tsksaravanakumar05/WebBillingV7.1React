export function isPageExitPrompt(payload) {
  const message = typeof payload === "string" ? payload : payload?.message;
  return /\bquit\b|\b(?:close|exit)\b.*\bpage\b/i.test(String(message || ""));
}

export function navigateToDashboard() {
  if (window.location.hash.toLowerCase() !== "#/dashboard") {
    window.location.assign("/#/dashboard");
  }
}
