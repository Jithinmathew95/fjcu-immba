import { supabase, supabaseConfigError } from "./supabaseClient.js";

export { supabase, supabaseConfigError };

const SITE_URL = window.location.origin;

export function authRedirectTo(path) {
  return new URL(path, SITE_URL).toString();
}

export async function getSessionUser() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user || null;
}

export async function getProfile() {
  if (!supabase) throw new Error(supabaseConfigError);
  const user = await getSessionUser();
  if (!user) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw error;
  return data ? { ...data, user } : { id: user.id, email: user.email, role: "pending", user };
}

export function isStaffRole(role) {
  return role === "admin" || role === "super_admin";
}

export async function requireStaff({ pendingHref = "admin.html" } = {}) {
  if (!supabase) {
    window.location.replace("admin-login.html");
    return null;
  }
  const profile = await getProfile();
  if (!profile?.user) {
    window.location.replace("admin-login.html");
    return null;
  }
  if (!isStaffRole(profile.role)) {
    window.location.replace(pendingHref);
    return null;
  }
  return profile;
}

export async function requireSuperAdmin() {
  const profile = await requireStaff();
  if (!profile) return null;
  if (profile.role !== "super_admin") {
    window.location.replace("admin.html");
    return null;
  }
  return profile;
}

export async function signIn(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password) {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: authRedirectTo("admin-login.html") },
  });
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authRedirectTo("admin-login.html"),
  });
  if (error) throw error;
}

export async function updatePassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function listProfiles() {
  const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function setProfileRole(id, role) {
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) throw error;
}
