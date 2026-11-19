import {
  supabase,
  supabaseConfigError,
  getSessionUser,
  loginFailureMessage,
  safeNextPath,
  signIn,
  signOut,
  signUp,
  requestPasswordReset,
  updatePassword,
} from "./lib/auth.js";

function afterSignInPath() {
  return safeNextPath(new URLSearchParams(window.location.search).get("next"), "admin.html");
}

const status = document.querySelector("[data-login-status]");
const loginForm = document.querySelector("[data-login-form]");
const registerForm = document.querySelector("[data-register-form]");
const forgotForm = document.querySelector("[data-forgot-form]");
const resetForm = document.querySelector("[data-reset-form]");
const panels = document.querySelectorAll("[data-auth-panel]");

function setStatus(en, zh = en, kind = "info") {
  if (!status) return;
  status.innerHTML = `<span data-en>${en}</span><span data-zh>${zh}</span>`;
  status.classList.toggle("hidden", !en);
  status.hidden = !en;
  status.dataset.kind = kind;
}

function showPanel(name) {
  panels.forEach((panel) => {
    const on = panel.dataset.authPanel === name;
    panel.classList.toggle("hidden", !on);
    panel.hidden = !on;
  });
}

function langIsZh() {
  return document.documentElement.lang === "zh";
}

function bindPasswordToggles() {
  document.querySelectorAll("[data-password-toggle]").forEach((button) => {
    const field = button.closest(".password-field");
    const input = field?.querySelector("input");
    if (!input) return;
    let timer = 0;
    const setHidden = () => {
      input.type = "password";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", langIsZh() ? "顯示密碼" : "Show password");
      window.clearTimeout(timer);
    };
    const setVisible = () => {
      input.type = "text";
      button.setAttribute("aria-pressed", "true");
      button.setAttribute("aria-label", langIsZh() ? "隱藏密碼" : "Hide password");
      window.clearTimeout(timer);
      timer = window.setTimeout(setHidden, 3000);
    };
    setHidden();
    button.addEventListener("click", () => {
      if (input.type === "password") setVisible();
      else setHidden();
    });
  });
}

document.querySelectorAll("[data-auth-show]").forEach((button) => {
  button.addEventListener("click", () => showPanel(button.dataset.authShow));
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return setStatus(supabaseConfigError, supabaseConfigError, "error");
  const email = loginForm.elements.email.value.trim();
  const password = loginForm.elements.password.value;
  try {
    setStatus("Signing in…", "登入中…");
    await signIn(email, password);
    window.location.replace(afterSignInPath());
  } catch (err) {
    const copy = loginFailureMessage(err);
    setStatus(copy.en, copy.zh, "error");
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return setStatus(supabaseConfigError, supabaseConfigError, "error");
  const email = registerForm.elements.email.value.trim();
  const password = registerForm.elements.password.value;
  const confirm = registerForm.elements.confirm.value;
  if (password !== confirm) {
    return setStatus("Passwords do not match.", "兩次輸入的密碼不一致。", "error");
  }
  if (password.length < 8) {
    return setStatus("Use at least 8 characters.", "請使用至少 8 個字元。", "error");
  }
  try {
    setStatus("Creating account…", "建立帳號中…");
    const data = await signUp(email, password);
    if (data?.session) {
      await signOut();
      setStatus(
        "Your account was created and is waiting for approval.",
        "您的帳號已建立，正在等待核准。"
      );
    } else {
      setStatus("Check your email to confirm your account.", "請至電子郵件確認帳號。");
    }
    registerForm.reset();
    showPanel("login");
  } catch (err) {
    setStatus(err.message || "Could not register.", err.message || "無法註冊。", "error");
  }
});

forgotForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return setStatus(supabaseConfigError, supabaseConfigError, "error");
  const email = forgotForm.elements.email.value.trim();
  try {
    setStatus("Sending reset email…", "寄送重設信件中…");
    await requestPasswordReset(email);
    setStatus("If that email is registered, a reset link is on its way.", "若此信箱已註冊，重設連結即將寄達。");
  } catch (err) {
    setStatus(err.message || "Could not send the reset email.", err.message || "無法寄送重設信件。", "error");
  }
});

resetForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) return setStatus(supabaseConfigError, supabaseConfigError, "error");
  const password = resetForm.elements.password.value;
  const confirm = resetForm.elements.confirm.value;
  if (password !== confirm) {
    return setStatus("Passwords do not match.", "兩次輸入的密碼不一致。", "error");
  }
  try {
    setStatus("Saving new password…", "儲存新密碼中…");
    await updatePassword(password);
    setStatus("Password updated. You can sign in now.", "密碼已更新，請重新登入。");
    showPanel("login");
  } catch (err) {
    setStatus(err.message || "Could not update the password.", err.message || "無法更新密碼。", "error");
  }
});

bindPasswordToggles();

function showLoginReady() {
  const checking = document.querySelector("[data-login-checking]");
  const ready = document.querySelector("[data-login-ready]");
  if (checking) {
    checking.hidden = true;
    checking.classList.add("hidden");
  }
  if (ready) {
    ready.hidden = false;
    ready.classList.remove("hidden");
  }
}

if (!supabase) {
  showLoginReady();
  setStatus(supabaseConfigError, supabaseConfigError, "error");
} else {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  if (hash.get("type") === "recovery" || query.get("type") === "recovery") {
    showLoginReady();
    showPanel("reset");
    setStatus("Choose a new password.", "請設定新密碼。");
  } else {
    const user = await getSessionUser();
    if (user) {
      window.location.replace(afterSignInPath());
    } else {
      showLoginReady();
    }
  }
}
