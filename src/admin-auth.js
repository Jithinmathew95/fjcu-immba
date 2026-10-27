import { supabase, supabaseConfigError } from "./lib/supabaseClient.js";

const loginSection = document.querySelector("[data-admin-login]");
const office = document.querySelector("[data-admin-office]");
const form = document.querySelector("[data-login-form]");
const status = document.querySelector("[data-login-status]");
const sessionBar = document.querySelector("[data-admin-session]");
const emailLabel = document.querySelector("[data-admin-email]");
const submitBtn = document.querySelector("[data-login-submit]");

function setVisible(el, visible) {
  if (!el) return;
  el.classList.toggle("hidden", !visible);
  el.hidden = !visible;
}

function setLoginStatus(message, kind) {
  if (!status) return;
  status.textContent = message || "";
  status.classList.toggle("hidden", !message);
  status.hidden = !message;
  status.dataset.kind = kind || "info";
}

function showOffice(user) {
  setVisible(loginSection, false);
  setVisible(office, true);
  setVisible(sessionBar, true);
  if (emailLabel) emailLabel.textContent = user.email || "Signed in";
}

function showLogin() {
  setVisible(loginSection, true);
  setVisible(office, false);
  setVisible(sessionBar, false);
  if (emailLabel) emailLabel.textContent = "";
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) {
    setLoginStatus(supabaseConfigError, "error");
    return;
  }
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  if (!email || !password) {
    setLoginStatus("Enter your email and password.", "error");
    return;
  }
  if (submitBtn) submitBtn.disabled = true;
  setLoginStatus("Signing in…");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (submitBtn) submitBtn.disabled = false;
  if (error) {
    setLoginStatus(error.message || "Could not sign in.", "error");
    return;
  }
  form.reset();
  setLoginStatus("");
});

document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    setLoginStatus(error.message || "Could not sign out.", "error");
    return;
  }
  showLogin();
  setLoginStatus("Signed out.");
});

if (!supabase) {
  showLogin();
  setLoginStatus(supabaseConfigError, "error");
} else {
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      showOffice(session.user);
      setLoginStatus("");
    } else {
      showLogin();
    }
  });

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    showLogin();
    setLoginStatus(error.message || "Could not check the current session.", "error");
  } else if (data.session?.user) {
    showOffice(data.session.user);
  } else {
    showLogin();
  }
}
