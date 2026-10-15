window.IMMBANews = (function () {
  const DRAFT_KEY = "immba-news-draft";
  const PUBLISHED_KEY = "immba-news-published";

  function fallbackFor(id) {
    return (window.IMMBA.news || []).find((item) => item.id === id) || {};
  }

  function normalizeItem(item, index) {
    const fallback = fallbackFor(item.id);
    const order = Number(item.order);
    const fallbackOrder = Number(fallback.order);
    return {
      id: item.id,
      date: item.date || fallback.date,
      link: item.link || fallback.link || "",
      photo: item.photo || fallback.photo || "",
      order: Number.isFinite(order) ? order : (Number.isFinite(fallbackOrder) ? fallbackOrder : index + 1),
      status: item.status === "draft" || item.status === "hidden" ? item.status : (fallback.status || "published"),
      tagEn: item.tagEn || fallback.tagEn || "News",
      tagZh: item.tagZh || fallback.tagZh || "消息",
      titleEn: item.titleEn || fallback.titleEn || "",
      titleZh: item.titleZh || fallback.titleZh || "",
      bodyEn: item.bodyEn || fallback.bodyEn || "",
      bodyZh: item.bodyZh || fallback.bodyZh || ""
    };
  }

  function normalizeList(list) {
    return (list || []).map((item, index) => normalizeItem(item, index));
  }

  function defaults() {
    return normalizeList(JSON.parse(JSON.stringify(window.IMMBA.news)));
  }

  function load(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : null;
    } catch {
      return null;
    }
  }

  function save(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
  }

  function clone(list) {
    return JSON.parse(JSON.stringify(list));
  }

  function getDraft() {
    return normalizeList(load(DRAFT_KEY) || load(PUBLISHED_KEY) || defaults());
  }

  function setDraft(list) {
    save(DRAFT_KEY, list);
  }

  function getPublished() {
    return normalizeList(load(PUBLISHED_KEY) || defaults());
  }

  function isDirty() {
    return JSON.stringify(getDraft()) !== JSON.stringify(getPublished());
  }

  function syncToFrontend() {
    const draft = getDraft();
    save(PUBLISHED_KEY, draft);
    save(DRAFT_KEY, draft);
    return clone(draft);
  }

  function restoreDefaults() {
    const list = defaults();
    save(DRAFT_KEY, list);
    save(PUBLISHED_KEY, list);
    return clone(list);
  }

  function slugify(title) {
    const base = String(title || "announcement")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "announcement";
    return `${base}-${Date.now().toString(36)}`;
  }

  return { getDraft, setDraft, getPublished, isDirty, syncToFrontend, restoreDefaults, slugify, defaults, normalizeList };
})();
