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
  return data
    ? { ...data, user }
    : { id: user.id, email: user.email, role: "pending", is_buyer: true, is_seller: false, is_platform_admin: false, user };
}

export function isStaffRole(role) {
  return role === "admin" || role === "super_admin";
}

export function isBuyer(profile) {
  return Boolean(profile?.user) && profile?.is_buyer !== false;
}

export function isSeller(profile) {
  return Boolean(profile?.is_seller);
}

export function isPlatformAdmin(profile) {
  return Boolean(profile?.is_platform_admin) || profile?.role === "super_admin";
}

export function safeNextPath(value, fallback = "admin.html") {
  if (!value || typeof value !== "string") return fallback;
  if (value.includes("://") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (value.startsWith("/") || value.startsWith(".")) return fallback;
  const [path, query] = value.split("?");
  if (!path.endsWith(".html")) return fallback;
  if (!query) return path;
  if (path === "marketplace.html" && /^id=[0-9a-f-]{36}$/i.test(query)) return `${path}?${query}`;
  if (path === "marketplace-checkout.html" && /^order=[0-9a-f-]{36}$/i.test(query)) return `${path}?${query}`;
  if (path === "marketplace-orders.html" && /^id=[0-9a-f-]{36}$/i.test(query)) return `${path}?${query}`;
  if (path === "marketplace-sales.html" && /^id=[0-9a-f-]{36}$/i.test(query)) return `${path}?${query}`;
  return fallback;
}

export function loginHref(nextPath) {
  const next = safeNextPath(nextPath, "marketplace-account.html");
  return `admin-login.html?next=${encodeURIComponent(next)}`;
}

async function requireSignedIn(nextPath) {
  if (!supabase) {
    window.location.replace(loginHref(nextPath));
    return null;
  }
  const profile = await getProfile();
  if (!profile?.user) {
    window.location.replace(loginHref(nextPath));
    return null;
  }
  return profile;
}

export async function requireBuyer(nextPath = "marketplace-cart.html") {
  const profile = await requireSignedIn(nextPath);
  if (!profile) return null;
  if (!isBuyer(profile)) {
    window.location.replace("marketplace-account.html");
    return null;
  }
  return profile;
}

export async function requireSeller(nextPath = "marketplace-seller.html") {
  const profile = await requireSignedIn(nextPath);
  if (!profile) return null;
  if (!isSeller(profile) && !isPlatformAdmin(profile)) {
    window.location.replace("marketplace-account.html");
    return null;
  }
  return profile;
}

export async function requirePlatformAdmin(nextPath = "marketplace-admin.html") {
  const profile = await requireSignedIn(nextPath);
  if (!profile) return null;
  if (!isPlatformAdmin(profile)) {
    window.location.replace("marketplace-account.html");
    return null;
  }
  return profile;
}

export async function becomeMarketplaceSeller() {
  const { error } = await supabase.rpc("become_marketplace_seller");
  if (error) throw error;
}

export async function setMarketplaceFlags(id, flags) {
  const { error } = await supabase.rpc("set_marketplace_flags", {
    p_user_id: id,
    p_is_buyer: flags.isBuyer,
    p_is_seller: flags.isSeller,
    p_is_platform_admin: flags.isPlatformAdmin,
  });
  if (error) throw error;
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
