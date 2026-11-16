import {
  supabase,
  supabaseConfigError,
  getSessionUser,
  signIn,
  signUp,
  requestPasswordReset,
  updatePassword,
} from "./lib/auth.js";

const status = document.querySelector("[data-login-status]");
const loginForm = document.querySelector("[data-login-form]");
const registerForm = document.querySelector("[data-register-form]");
const forgotForm = document.querySelector("[data-forgot-form]");
const resetForm = document.querySelector("[data-reset-form]");
const panels = document.querySelectorAll("[data-auth-panel]");

function setStatus(message, kind = "info") {
  if (!status) return;
  status.textContent = message || "";
  status.classList.toggle("hidden", !message);
  status.hidden = !message;
  status.dataset.kind = kind;
}

function showPanel(name) {
  panels.forEach((panel) => {
    const on = panel.dataset.authPanel === name;
    panel.classList.toggle("hidden", !on);
    panel.hidden = !on;
  });
}

document.querySelectorAll("[data-auth-show]").forEach((button) => {
  button.addEventListener("click", () => showPanel(button.dataset.authShow));
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return setStatus(supabaseConfigError, "error");
  const email = loginForm.elements.email.value.trim();
  const password = loginForm.elements.password.value;
  try {
    setStatus("Signing in…");
    await signIn(email, password);
    window.location.replace("admin.html");
  } catch (err) {
    setStatus(err.message || "Could not sign in.", "error");
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return setStatus(supabaseConfigError, "error");
  const email = registerForm.elements.email.value.trim();
  const password = registerForm.elements.password.value;
  const confirm = registerForm.elements.confirm.value;
  if (password !== confirm) return setStatus("Passwords do not match.", "error");
  if (password.length < 8) return setStatus("Use at least 8 characters.", "error");
  try {
    setStatus("Creating account…");
    await signUp(email, password);
    setStatus("Check your email to confirm the account. After that, wait for a super admin to approve you.");
    registerForm.reset();
    showPanel("login");
  } catch (err) {
    setStatus(err.message || "Could not register.", "error");
  }
});

forgotForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return setStatus(supabaseConfigError, "error");
  const email = forgotForm.elements.email.value.trim();
  try {
    setStatus("Sending reset email…");
    await requestPasswordReset(email);
    setStatus("If that email is registered, a reset link is on its way.");
  } catch (err) {
    setStatus(err.message || "Could not send the reset email.", "error");
  }
});

resetForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return setStatus(supabaseConfigError, "error");
  const password = resetForm.elements.password.value;
  const confirm = resetForm.elements.confirm.value;
  if (password !== confirm) return setStatus("Passwords do not match.", "error");
  try {
    setStatus("Saving new password…");
    await updatePassword(password);
    setStatus("Password updated. You can sign in now.");
    showPanel("login");
  } catch (err) {
    setStatus(err.message || "Could not update the password.", "error");
  }
});

if (!supabase) {
  setStatus(supabaseConfigError, "error");
} else {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (hash.get("type") === "recovery") {
    showPanel("reset");
    setStatus("Choose a new password.");
  } else {
    const user = await getSessionUser();
    if (user && hash.get("type") !== "recovery") {
      window.location.replace("admin.html");
    }
  }
}
