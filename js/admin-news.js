(function () {
  if (!document.querySelector("[data-admin-news]")) return;

  const form = document.querySelector("[data-news-form]");
  const list = document.querySelector("[data-admin-list]");
  const status = document.querySelector("[data-admin-status]");
  const submitBtn = document.querySelector("[data-form-submit]");
  const cancelBtn = document.querySelector("[data-form-cancel]");
  const formTitle = document.querySelector("[data-form-title]");
  const dirtyNote = document.querySelector("[data-dirty]");
  let items = window.IMMBANews.getDraft();
  let editingId = "";

  function esc(value) {
    return String(value || "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function setStatus(message, kind) {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("hidden", !message);
    status.dataset.kind = kind || "info";
  }

  function persist() {
    window.IMMBANews.setDraft(items);
    renderList();
    updateDirty();
  }

  function updateDirty() {
    const dirty = window.IMMBANews.isDirty();
    if (dirtyNote) dirtyNote.classList.toggle("hidden", !dirty);
  }

  function nextOrder() {
    return items.reduce((max, item) => Math.max(max, Number(item.order) || 0), 0) + 1;
  }

  function resetForm() {
    editingId = "";
    form.reset();
    form.elements.id.value = "";
    form.elements.status.value = "published";
    form.elements.order.value = String(nextOrder());
    formTitle.textContent = "Add a new announcement";
    submitBtn.textContent = "Add announcement";
    cancelBtn.classList.add("hidden");
  }

  function fillForm(item) {
    form.elements.id.value = item.id;
    form.elements.date.value = item.date;
    form.elements.link.value = item.link || "";
    form.elements.order.value = item.order || 1;
    form.elements.status.value = item.status || "published";
    form.elements.titleEn.value = item.titleEn || "";
    form.elements.titleZh.value = item.titleZh || "";
    form.elements.tagEn.value = item.tagEn || "";
    form.elements.tagZh.value = item.tagZh || "";
    form.elements.bodyEn.value = item.bodyEn || "";
    form.elements.bodyZh.value = item.bodyZh || "";
  }

  function fromForm() {
    const titleEn = form.elements.titleEn.value.trim();
    const titleZh = form.elements.titleZh.value.trim();
    const id = form.elements.id.value.trim() || window.IMMBANews.slugify(titleEn || titleZh);
    return window.IMMBANews.normalizeList([{
      id,
      date: form.elements.date.value,
      link: form.elements.link.value.trim(),
      order: Number(form.elements.order.value) || nextOrder(),
      status: form.elements.status.value,
      tagEn: form.elements.tagEn.value.trim() || "News",
      tagZh: form.elements.tagZh.value.trim() || "消息",
      titleEn,
      titleZh,
      bodyEn: form.elements.bodyEn.value.trim(),
      bodyZh: form.elements.bodyZh.value.trim()
    }])[0];
  }

  function renderList() {
    const sorted = [...items].sort((a, b) => {
      const orderA = Number(a.order) || 99;
      const orderB = Number(b.order) || 99;
      if (orderA !== orderB) return orderA - orderB;
      return b.date.localeCompare(a.date);
    });
    list.innerHTML = sorted.map((n) => `
      <tr>
        <td>${esc(n.order)}</td>
        <td>${esc(n.date)}</td>
        <td><strong>${esc(n.titleEn)}</strong></td>
        <td>${esc(n.titleZh)}</td>
        <td><span class="pill">${esc(n.status)}</span></td>
        <td class="admin-actions">
          <button type="button" class="btn btn-line" data-edit="${esc(n.id)}">Edit</button>
          <button type="button" class="btn btn-danger" data-delete="${esc(n.id)}">Delete</button>
        </td>
      </tr>`).join("") || `<tr><td colspan="6">No announcements yet. Use the form to add one.</td></tr>`;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const next = fromForm();
    if (!next.date || !next.titleEn || !next.titleZh || !next.bodyEn || !next.bodyZh) {
      setStatus("Date plus Chinese and English titles and content are required in the same record.", "error");
      return;
    }
    if (editingId) {
      items = items.map((item) => item.id === editingId ? { ...item, ...next, id: editingId } : item);
      persist();
      setStatus("Announcement updated. Synchronize to show it on the public News page.", "ok");
    } else {
      if (items.some((item) => item.id === next.id)) next.id = window.IMMBANews.slugify(next.titleEn);
      items = [next, ...items];
      persist();
      setStatus("Announcement added. Synchronize to show it on the public News page.", "ok");
    }
    resetForm();
  });

  cancelBtn.addEventListener("click", () => {
    resetForm();
    setStatus("");
  });

  list.addEventListener("click", (e) => {
    const editId = e.target.closest("[data-edit]")?.getAttribute("data-edit");
    const deleteId = e.target.closest("[data-delete]")?.getAttribute("data-delete");
    if (editId) {
      const item = items.find((n) => n.id === editId);
      if (!item) return;
      editingId = item.id;
      fillForm(item);
      formTitle.textContent = "Edit an existing announcement";
      submitBtn.textContent = "Save changes";
      cancelBtn.classList.remove("hidden");
      form.scrollIntoView({ behavior: "smooth", block: "start" });
      setStatus("Editing this announcement. Save changes, then synchronize if you want the public site updated.");
    }
    if (deleteId) {
      const item = items.find((n) => n.id === deleteId);
      if (!item) return;
      if (!confirm(`Delete “${item.titleEn}”?`)) return;
      items = items.filter((n) => n.id !== deleteId);
      persist();
      if (editingId === deleteId) resetForm();
      setStatus("Announcement removed from the admin list. Synchronize to remove it from the public News page.", "ok");
    }
  });

  document.querySelector("[data-restore]")?.addEventListener("click", () => {
    if (!confirm("Restore the default announcement list? This replaces the admin list and the public News page.")) return;
    items = window.IMMBANews.restoreDefaults();
    resetForm();
    persist();
    setStatus("Default announcement list restored and synchronized with the front-end website.", "ok");
    updateDirty();
  });

  document.querySelector("[data-sync]")?.addEventListener("click", () => {
    window.IMMBANews.setDraft(items);
    window.IMMBANews.syncToFrontend();
    updateDirty();
    setStatus("Front-end website updated. Open News to see the published list.", "ok");
  });

  renderList();
  updateDirty();
  resetForm();
})();
