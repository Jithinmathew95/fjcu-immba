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
    return (list || []).map((item, index) => normalizeItem(item, index)).filter((item) => item.id);
  }

  function mergeItem(prev, next) {
    if (!prev) return next;
    return {
      ...prev,
      ...next,
      photo: next.photo || prev.photo,
      link: next.link || prev.link,
      titleEn: next.titleEn || prev.titleEn,
      titleZh: next.titleZh || prev.titleZh,
      bodyEn: next.bodyEn || prev.bodyEn,
      bodyZh: next.bodyZh || prev.bodyZh
    };
  }

  function mergeLists(...lists) {
    const map = new Map();
    lists.forEach((list) => {
      normalizeList(list).forEach((item) => {
        map.set(item.id, mergeItem(map.get(item.id), item));
      });
    });
    return [...map.values()];
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

  let remotePublished = null;
  let remoteDraft = null;

  function getDraft() {
    return mergeLists(defaults(), load(PUBLISHED_KEY), load(DRAFT_KEY), remotePublished, remoteDraft);
  }

  function setDraft(list) {
    remoteDraft = normalizeList(list);
    save(DRAFT_KEY, remoteDraft);
  }

  function getPublished() {
    return mergeLists(defaults(), load(PUBLISHED_KEY), remotePublished)
      .filter((item) => (item.status || "published") === "published");
  }

  function hydratePublished(list) {
    remotePublished = normalizeList(list);
  }

  function hydrateDraft(list) {
    remoteDraft = normalizeList(list);
    save(DRAFT_KEY, remoteDraft);
  }

  function isDirty() {
    return JSON.stringify(getDraft()) !== JSON.stringify(getPublished());
  }

  function syncToFrontend() {
    const draft = getDraft();
    remotePublished = clone(draft);
    remoteDraft = clone(draft);
    save(DRAFT_KEY, draft);
    save(PUBLISHED_KEY, draft);
    return clone(draft);
  }

  function restoreDefaults() {
    const list = defaults();
    remoteDraft = clone(list);
    remotePublished = clone(list);
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

  return {
    getDraft,
    setDraft,
    getPublished,
    hydratePublished,
    hydrateDraft,
    isDirty,
    syncToFrontend,
    restoreDefaults,
    slugify,
    defaults,
    normalizeList,
    mergeLists
  };
})();
