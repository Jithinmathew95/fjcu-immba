(function () {
  if (!document.querySelector("[data-admin-news]")) return;

  const form = document.querySelector("[data-news-form]");
  const list = document.querySelector("[data-admin-list]");
  const status = document.querySelector("[data-admin-status]");
  const submitBtn = document.querySelector("[data-form-submit]");
  const cancelBtn = document.querySelector("[data-form-cancel]");
  const formTitle = document.querySelector("[data-form-title]");
  const dirtyNote = document.querySelector("[data-dirty]");
  const preview = document.querySelector("[data-photo-preview]");
  const removePhotoBtn = document.querySelector("[data-photo-remove]");
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
    try {
      window.IMMBANews.setDraft(items);
    } catch (err) {
      setStatus("Could not save. The photo may be too large for this browser. Use a photo URL instead.", "error");
      throw err;
    }
    renderList();
    updateDirty();
  }

  async function publishToSite() {
    persist();
    const publish = window.IMMBANews.publishRemote;
    if (typeof publish !== "function") {
      throw new Error("Supabase is not ready. Refresh the page and sign in again.");
    }
    items = await publish(items);
    persist();
    window.IMMBANews.syncToFrontend();
    updateDirty();
  }

  function showPreview(src) {
    if (!preview) return;
    const hasPhoto = Boolean(src);
    preview.hidden = !hasPhoto;
    preview.src = src || "";
    removePhotoBtn?.classList.toggle("hidden", !hasPhoto);
  }

  function compressPhoto(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("Please choose an image file."));
        return;
      }
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        const max = 1200;
        let width = image.width;
        let height = image.height;
        if (width > max) {
          height = Math.round((height * max) / width);
          width = max;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(image, 0, 0, width, height);
        URL.revokeObjectURL(objectUrl);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not read that image."));
      };
      image.src = objectUrl;
    });
  }

  function updateDirty() {
    const dirty = window.IMMBANews.isDirty();
    if (dirtyNote) dirtyNote.classList.toggle("hidden", !dirty);
  }

  function nextOrder() {
    return 1;
  }

  function resetForm() {
    editingId = "";
    form.reset();
    form.elements.id.value = "";
    form.elements.status.value = "published";
    form.elements.order.value = String(nextOrder());
    form.elements.photo.value = "";
    form.elements.photoUrl.value = "";
    if (form.elements.photoFile) form.elements.photoFile.value = "";
    showPreview("");
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
    const photo = item.photo || "";
    form.elements.photo.value = photo.startsWith("data:") ? photo : "";
    form.elements.photoUrl.value = photo.startsWith("data:") ? "" : photo;
    if (form.elements.photoFile) form.elements.photoFile.value = "";
    showPreview(photo);
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
      bodyZh: form.elements.bodyZh.value.trim(),
      photo: form.elements.photoUrl.value.trim() || form.elements.photo.value.trim()
    }])[0];
  }

  function renderList() {
    const sorted = [...items].sort((a, b) => {
      const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : 99;
      const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : 99;
      if (orderA !== orderB) return orderA - orderB;
      return b.date.localeCompare(a.date);
    });
    list.innerHTML = sorted.map((n) => `
      <tr>
        <td>${n.photo ? `<img class="admin-thumb" src="${esc(n.photo)}" alt="">` : "—"}</td>
        <td>${esc(n.order)}</td>
        <td>${esc(n.date)}</td>
        <td><strong>${esc(n.titleEn)}</strong></td>
        <td>${esc(n.titleZh)}</td>
        <td><span class="pill">${esc(n.status)}</span></td>
        <td class="admin-actions">
          <button type="button" class="btn btn-line" data-edit="${esc(n.id)}">Edit</button>
          <button type="button" class="btn btn-danger" data-delete="${esc(n.id)}">Delete</button>
        </td>
      </tr>`).join("") || `<tr><td colspan="7">No announcements yet. Use the form to add one.</td></tr>`;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const next = fromForm();
    if (!next.date || !next.titleEn || !next.titleZh || !next.bodyEn || !next.bodyZh) {
      setStatus("Date plus Chinese and English titles and content are required in the same record.", "error");
      return;
    }
    const previous = items;
    if (editingId) {
      items = items.map((item) => item.id === editingId ? { ...item, ...next, id: editingId } : item);
    } else {
      if (items.some((item) => item.id === next.id)) next.id = window.IMMBANews.slugify(next.titleEn);
      next.order = Number(next.order) || 1;
      items = items.map((item) => ({
        ...item,
        order: (Number.isFinite(Number(item.order)) ? Number(item.order) : 1) + (next.order <= (Number(item.order) || 1) ? 1 : 0)
      }));
      items = [next, ...items];
    }
    try {
      persist();
      setStatus("Saving for the public News page…");
      publishToSite()
        .then(() => {
          setStatus("Announcement saved. It is now on the public News page.", "ok");
          resetForm();
        })
        .catch((err) => {
          items = previous;
          persist();
          setStatus(err.message || "Saved on this computer only. Sign in again and click Synchronize to publish.", "error");
        });
    } catch {
      items = previous;
    }
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
      const previous = items;
      items = items.filter((n) => n.id !== deleteId);
      persist();
      if (editingId === deleteId) resetForm();
      setStatus("Removing from the public News page…");
      publishToSite()
        .then(() => setStatus("Announcement removed from the public News page.", "ok"))
        .catch((err) => {
          items = previous;
          persist();
          setStatus(err.message || "Could not remove it for the public site. Sign in and try again.", "error");
        });
    }
  });

  document.querySelector("[data-restore]")?.addEventListener("click", () => {
    if (!confirm("Restore the default announcement list? This replaces the admin list and the public News page.")) return;
    items = window.IMMBANews.restoreDefaults();
    resetForm();
    persist();
    setStatus("Restoring the default list for everyone…");
    publishToSite()
      .then(() => setStatus("Default announcement list restored on the public News page.", "ok"))
      .catch((err) => setStatus(err.message || "Restored here only. Click Synchronize after signing in.", "error"));
  });

  form.elements.photoFile?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressPhoto(file);
      form.elements.photo.value = dataUrl;
      form.elements.photoUrl.value = "";
      showPreview(dataUrl);
      setStatus("Photo added. Save the announcement, then synchronize to show it on the public News page.", "ok");
    } catch (err) {
      setStatus(err.message || "Could not add that photo.", "error");
    }
  });

  form.elements.photoUrl?.addEventListener("input", () => {
    const url = form.elements.photoUrl.value.trim();
    if (url) {
      form.elements.photo.value = "";
      showPreview(url);
    } else if (!form.elements.photo.value) {
      showPreview("");
    }
  });

  removePhotoBtn?.addEventListener("click", () => {
    form.elements.photo.value = "";
    form.elements.photoUrl.value = "";
    if (form.elements.photoFile) form.elements.photoFile.value = "";
    showPreview("");
  });

  document.querySelector("[data-sync]")?.addEventListener("click", () => {
    setStatus("Publishing to the public News page…");
    publishToSite()
      .then(() => setStatus("Public News page updated. Open News to see the published list.", "ok"))
      .catch((err) => setStatus(err.message || "Could not publish. Sign in and try Synchronize again.", "error"));
  });

  window.IMMBANewsAdmin = {
    reload(list) {
      items = window.IMMBANews.normalizeList(list || window.IMMBANews.getDraft());
      renderList();
      updateDirty();
      resetForm();
    }
  };

  renderList();
  updateDirty();
  resetForm();
})();
