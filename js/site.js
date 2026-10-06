(function () {
  const STORAGE = "immba-lang";
  const page = document.body.dataset.page || "home";

  function lang() {
    return document.documentElement.lang === "zh" ? "zh" : "en";
  }

  function setLang(next) {
    const value = next === "zh" ? "zh" : "en";
    document.documentElement.lang = value;
    localStorage.setItem(STORAGE, value);
    document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.langBtn === next));
    });
    renderDynamic();
  }

  function header() {
    return `
      <a class="skip" href="#main">Skip to content</a>
      <div class="notice-bar" role="note">
        <div class="notice-bar-inner">
          <p class="notice-bar-text">
            <span data-en>This is a teaching demonstration site by Jithin Mathew</span>
            <span data-zh>本網站為 Jithin Mathew 的教學示範網站</span>
            <span class="notice-bar-sep" aria-hidden="true">/</span>
            <a href="https://www.management.fju.edu.tw/esubweb/immbaengindex/" target="_blank" rel="noreferrer" data-en>Official website</a>
            <a href="https://www.management.fju.edu.tw/subweb/immba/" target="_blank" rel="noreferrer" data-zh>官方網站</a>
          </p>
          <button type="button" class="notice-collapse" data-collapse-nav>
            <span data-en data-collapse-label>Collapse main menu</span>
            <span data-zh data-collapse-label>收合主選單</span>
          </button>
        </div>
      </div>
      <header class="site-header">
        <div class="brand-bar">
          <a class="brand" href="index.html">
            <img class="logo" src="assets/fjcu-logo.svg?v=3" width="64" height="64" alt="">
            <span class="brand-text">
              <span class="brand-university" data-en>Fu Jen Catholic University</span>
              <span class="brand-university" data-zh>輔仁大學</span>
              <strong class="brand-program" data-en>International MBA (imMBA)</strong>
              <strong class="brand-program" data-zh>國際經營管理碩士班（imMBA）</strong>
            </span>
          </a>
        </div>
        <div class="nav-bar" data-nav>
          <div class="nav-bar-inner">
            <button class="menu-btn" type="button" data-menu>Menu</button>
            <nav>
              <ul>
                <li><a data-nav-link="home" href="index.html"><span data-en>Home</span><span data-zh>首頁</span></a></li>
                <li><a data-nav-link="admissions" href="admissions.html"><span data-en>Admissions</span><span data-zh>招生資訊</span></a></li>
                <li><a data-nav-link="curriculum" href="curriculum.html"><span data-en>Curriculum</span><span data-zh>課程資訊</span></a></li>
                <li><a data-nav-link="faculty" href="faculty.html"><span data-en>Faculty</span><span data-zh>師資介紹</span></a></li>
                <li><a data-nav-link="guide" href="guide.html"><span data-en>imMBA Guide</span><span data-zh>就學指引</span></a></li>
                <li><a data-nav-link="graduation" href="graduation.html"><span data-en>Graduation</span><span data-zh>畢業規定</span></a></li>
                <li><a data-nav-link="dual" href="dual-degree.html"><span data-en>Dual Degree</span><span data-zh>雙聯學位</span></a></li>
                <li><a data-nav-link="exchange" href="exchange.html"><span data-en>Overseas Exchange</span><span data-zh>海外交換</span></a></li>
                <li><a data-nav-link="marketplace" href="marketplace.html"><span data-en>Marketplace</span><span data-zh>教材市集</span></a></li>
                <li><a data-nav-link="events" href="events.html"><span data-en>Events</span><span data-zh>活動</span></a></li>
                <li><a data-nav-link="news" href="news.html"><span data-en>Announcements</span><span data-zh>最新公告</span></a></li>
                <li><a data-nav-link="downloads" href="downloads.html"><span data-en>Downloads</span><span data-zh>檔案下載</span></a></li>
              </ul>
            </nav>
            <div class="nav-actions">
              <div class="lang" role="group" aria-label="Language">
                <button type="button" data-lang-btn="en" aria-pressed="true">English</button>
                <button type="button" data-lang-btn="zh">中文</button>
              </div>
              <a class="nav-cta" href="admissions.html"><span data-en>Apply Now</span><span data-zh>立即申請</span></a>
            </div>
          </div>
        </div>
      </header>`;
  }

  function footer() {
    return `
      <footer class="site-footer">
        <div class="wrap footer-grid">
          <div>
            <strong data-en>MBA Program in International Management</strong>
            <strong data-zh>國際經營管理碩士學位學程（imMBA）</strong>
            <p data-en>College of Management, Fu Jen Catholic University<br>Office LM208-1, No. 510 Zhongzheng Rd., Xinzhuang, New Taipei City 242062, Taiwan</p>
            <p data-zh>輔仁大學管理學院<br>242062 新北市新莊區中正路510號 LM208-1</p>
          </div>
          <div>
            <p>T +886-2-2905-2750<br>E <a href="mailto:imMBA@mail.fju.edu.tw">imMBA@mail.fju.edu.tw</a></p>
            <p data-en>Ms. Chang, Programme Office</p>
            <p data-zh>張秘書／學程辦公室</p>
          </div>
          <div>
            <p><a href="contact.html"><span data-en>Contact</span><span data-zh>聯絡我們</span></a></p>
            <p><a href="gallery.html"><span data-en>Photo gallery</span><span data-zh>相片集錦</span></a></p>
            <p><a href="about.html"><span data-en>Overview and ranking</span><span data-zh>特色與排名</span></a></p>
            <p><a href="https://www.management.fju.edu.tw/esubweb/immbaengindex/" target="_blank" rel="noreferrer"><span data-en>Current official site</span><span data-zh>現行官方網站</span></a></p>
          </div>
        </div>
        <div class="wrap legal">
          <span data-en>A redesigned public site for FJCU imMBA. Programme facts follow the official College of Management pages. Always confirm dates and fees with the office before applying.</span>
          <span data-zh>本站為輔大 imMBA 重新設計的公開網站，內容對應管理學院官方學程資訊。申請前請以辦公室最新公告為準。</span>
        </div>
      </footer>`;
  }

  function formatDate(iso) {
    const [y, m, d] = iso.split("-");
    return lang() === "zh" ? `${y}/${m}/${d}` : `${d} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][+m - 1]} ${y}`;
  }

  function newsSorted() {
    return [...window.IMMBA.news].sort((a, b) => {
      if (a.pin !== b.pin) return a.pin ? -1 : 1;
      return b.date.localeCompare(a.date);
    });
  }

  function renderNewsList(target, limit) {
    if (!target) return;
    const q = (document.querySelector("[data-news-search]")?.value || "").trim().toLowerCase();
    const items = newsSorted().filter((n) => {
      if (!q) return true;
      return `${n.titleEn} ${n.titleZh} ${n.tagEn} ${n.tagZh} ${n.bodyEn}`.toLowerCase().includes(q);
    }).slice(0, limit || 99);

    target.innerHTML = items.map((n) => `
      <a class="news-item" href="news.html?id=${n.id}">
        <time>${formatDate(n.date)}</time>
        <div>
          ${n.pin ? `<span class="pill">TOP</span>` : ""}
          <h3>${lang() === "zh" ? n.titleZh : n.titleEn}</h3>
        </div>
        <span>${lang() === "zh" ? n.tagZh : n.tagEn}</span>
      </a>`).join("") || `<p>${lang() === "zh" ? "沒有符合的公告。" : "No matching announcements."}</p>`;
  }

  function renderNewsDetail() {
    const host = document.querySelector("[data-news-detail]");
    if (!host) return;
    const id = new URLSearchParams(location.search).get("id");
    if (!id) {
      document.querySelector("[data-news-index]")?.classList.remove("hidden");
      host.classList.add("hidden");
      return;
    }
    const n = window.IMMBA.news.find((x) => x.id === id);
    document.querySelector("[data-news-index]")?.classList.add("hidden");
    host.classList.remove("hidden");
    if (!n) {
      host.innerHTML = `<p>${lang() === "zh" ? "找不到這則公告。" : "Announcement not found."}</p>`;
      return;
    }
    host.innerHTML = `
      <p class="meta">${formatDate(n.date)} · ${lang() === "zh" ? n.tagZh : n.tagEn}</p>
      <h1>${lang() === "zh" ? n.titleZh : n.titleEn}</h1>
      <div class="prose"><p>${lang() === "zh" ? n.bodyZh : n.bodyEn}</p>
      <p><a class="btn btn-line" href="news.html">${lang() === "zh" ? "返回公告列表" : "Back to news"}</a></p></div>`;
  }

  function renderFaculty() {
    const host = document.querySelector("[data-faculty]");
    if (!host) return;
    const q = (document.querySelector("[data-faculty-search]")?.value || "").trim().toLowerCase();
    const zh = lang() === "zh";
    const items = window.IMMBA.faculty.filter((f) => {
      if (!q) return true;
      return `${f.name} ${f.nameZh} ${f.specEn} ${f.specZh} ${f.roleEn}`.toLowerCase().includes(q);
    });
    host.innerHTML = items.map((f) => `
      <article class="faculty-card">
        <h3>${zh ? f.nameZh : f.name}</h3>
        <p>${zh ? f.roleZh : f.roleEn}</p>
        <p>${zh ? f.eduZh : f.eduEn}</p>
        <p>${zh ? f.specZh : f.specEn}</p>
        ${f.tel ? `<p>${f.tel}</p>` : ""}
        <p><a href="mailto:${f.email}">${f.email}</a>${f.web ? ` · <a href="${f.web}" target="_blank" rel="noreferrer">Website</a>` : ""}</p>
      </article>`).join("");
  }

  function renderHomeNews() {
    renderNewsList(document.querySelector("[data-home-news]"), 6);
  }

  function renderDynamic() {
    renderHomeNews();
    renderNewsList(document.querySelector("[data-news-list]"));
    renderNewsDetail();
    renderFaculty();
  }

  function bindContact() {
    const form = document.querySelector("[data-contact-form]");
    if (!form) return;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const subject = encodeURIComponent(`[imMBA] ${data.topic} — ${data.name}`);
      const body = encodeURIComponent(`${data.message}\n\n${data.name}\n${data.email}\n${data.phone || ""}`);
      window.location.href = `mailto:imMBA@mail.fju.edu.tw?subject=${subject}&body=${body}`;
      const status = document.querySelector("[data-form-status]");
      if (status) {
        status.classList.remove("hidden");
        status.textContent = lang() === "zh"
          ? "已開啟您的電子郵件程式。若未開啟，請直接來信 imMBA@mail.fju.edu.tw。"
          : "Your email app should open. If it does not, write to imMBA@mail.fju.edu.tw.";
      }
    });
  }

  document.body.insertAdjacentHTML("afterbegin", header());
  document.body.insertAdjacentHTML("beforeend", footer());
  document.querySelector(`[data-nav-link="${page}"]`)?.classList.add("active");

  setLang(localStorage.getItem(STORAGE) || "en");

  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.addEventListener("click", () => setLang(btn.dataset.langBtn));
  });
  document.querySelector("[data-menu]")?.addEventListener("click", () => {
    document.querySelector("[data-nav]")?.classList.toggle("open");
  });

  const NAV_COLLAPSE = "immba-nav-collapsed";
  function applyNavCollapse(collapsed) {
    document.body.classList.toggle("nav-collapsed", collapsed);
    const btn = document.querySelector("[data-collapse-nav]");
    if (!btn) return;
    btn.setAttribute("aria-expanded", String(!collapsed));
    btn.querySelectorAll("[data-collapse-label]").forEach((el) => {
      const isZh = el.hasAttribute("data-zh");
      el.textContent = collapsed
        ? (isZh ? "展開主選單" : "Expand main menu")
        : (isZh ? "收合主選單" : "Collapse main menu");
    });
  }
  applyNavCollapse(sessionStorage.getItem(NAV_COLLAPSE) === "1");
  document.querySelector("[data-collapse-nav]")?.addEventListener("click", () => {
    const next = !document.body.classList.contains("nav-collapsed");
    sessionStorage.setItem(NAV_COLLAPSE, next ? "1" : "0");
    applyNavCollapse(next);
  });

  document.querySelector("[data-news-search]")?.addEventListener("input", () => renderNewsList(document.querySelector("[data-news-list]")));
  document.querySelector("[data-faculty-search]")?.addEventListener("input", renderFaculty);
  bindContact();
})();
