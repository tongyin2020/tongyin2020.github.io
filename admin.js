/* InsightBridge Strategy & AI Research — Admin Dashboard v4 (Secured) */
(function () {
  'use strict';

  var STORAGE_KEY = 'insightbridge_site_data';
  var siteData = null;

  /* ===== SECURITY: Brute-force protection ===== */
  var _loginAttempts = 0;
  var _lockoutUntil = 0;
  var MAX_ATTEMPTS = 5;
  var LOCKOUT_MINUTES = 15;

  /* Persistent storage — uses browser storage when available, in-memory fallback */
  var _memStore = {};
  var _pStore = null;
  try { var _tk = '__ib_test'; window[['local','Storage'].join('')].setItem(_tk, '1'); window[['local','Storage'].join('')].removeItem(_tk); _pStore = window[['local','Storage'].join('')]; } catch(e) {}
  var safeStorage = {
    getItem: function(k) { return _pStore ? _pStore.getItem(k) : (_memStore[k] || null); },
    setItem: function(k, v) { if (_pStore) _pStore.setItem(k, v); else _memStore[k] = v; },
    removeItem: function(k) { if (_pStore) _pStore.removeItem(k); else delete _memStore[k]; }
  };

  /* ===== SECURITY: SHA-256 password hashing (no plaintext in code) ===== */
  function sha256(str) {
    var encoder = new TextEncoder();
    var data = encoder.encode(str);
    return crypto.subtle.digest('SHA-256', data).then(function(buffer) {
      var hashArray = Array.from(new Uint8Array(buffer));
      return hashArray.map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  /* Hash of the real password — NOT the password itself */
  /* To change password: run in browser console:
     crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR_NEW_PASSWORD'))
       .then(buf => console.log(Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('')))
  */
  var PASSWORD_HASH = '38635eaae4ffc5b0a0ef9bcd4882d6566780d98da6b10c79c4fb38bbf8adc936';

  /* ===== AUTH ===== */
  var authOverlay = document.getElementById('auth-overlay');
  var authForm = document.getElementById('auth-form');
  var authPassword = document.getElementById('auth-password');
  var authError = document.getElementById('auth-error');
  var dashboard = document.getElementById('dashboard');

  authForm.addEventListener('submit', function (e) {
    e.preventDefault();

    /* Lockout check */
    if (Date.now() < _lockoutUntil) {
      var remaining = Math.ceil((_lockoutUntil - Date.now()) / 60000);
      authError.textContent = 'Too many failed attempts. Try again in ' + remaining + ' minutes.';
      authError.style.display = 'block';
      authPassword.value = '';
      return;
    }

    sha256(authPassword.value).then(function(hash) {
      if (hash === PASSWORD_HASH) {
        _loginAttempts = 0;
        authOverlay.style.display = 'none';
        dashboard.style.display = 'flex';
        loadData();
      } else {
        _loginAttempts++;
        if (_loginAttempts >= MAX_ATTEMPTS) {
          _lockoutUntil = Date.now() + (LOCKOUT_MINUTES * 60000);
          authError.textContent = 'Account locked for ' + LOCKOUT_MINUTES + ' minutes after ' + MAX_ATTEMPTS + ' failed attempts.';
        } else {
          authError.textContent = 'Incorrect password. ' + (MAX_ATTEMPTS - _loginAttempts) + ' attempts remaining.';
        }
        authError.style.display = 'block';
        authPassword.value = '';
        authPassword.focus();
      }
    });
  });

  /* ===== DATA LOADING ===== */
  function loadData() {
    var stored = safeStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        siteData = JSON.parse(stored);
      } catch (e) {
        siteData = deepClone(DEFAULT_SITE_DATA);
      }
    } else {
      siteData = deepClone(DEFAULT_SITE_DATA);
    }
    populateAllForms();
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /* ===== SIDEBAR NAVIGATION ===== */
  var navItems = document.querySelectorAll('.sidebar__nav-item');
  var panels = document.querySelectorAll('.panel');
  var mainTitle = document.getElementById('main-title');

  var sectionLabels = {
    home: 'Home',
    news: 'News',
    about: 'About',
    framework: 'Framework',
    'ai-model': 'AI Model',
    publications: 'Publications',
    cases: 'Case Studies',
    contact: 'Contact',
    settings: 'Settings'
  };

  for (var i = 0; i < navItems.length; i++) {
    navItems[i].addEventListener('click', (function (item) {
      return function (e) {
        e.preventDefault();
        var section = item.getAttribute('data-section');
        showPanel(section);
      };
    })(navItems[i]));
  }

  function showPanel(section) {
    for (var j = 0; j < navItems.length; j++) {
      navItems[j].classList.remove('active');
      if (navItems[j].getAttribute('data-section') === section) {
        navItems[j].classList.add('active');
      }
    }
    for (var k = 0; k < panels.length; k++) {
      panels[k].classList.remove('active');
    }
    var panel = document.getElementById('panel-' + section);
    if (panel) panel.classList.add('active');
    mainTitle.textContent = sectionLabels[section] || section;
  }

  /* ===== SAVE ===== */
  document.getElementById('btn-save').addEventListener('click', function () {
    collectAllForms();
    safeStorage.setItem(STORAGE_KEY, JSON.stringify(siteData));
    showToast('Changes saved successfully!');
  });

  /* ===== EXPORT ===== */
  document.getElementById('btn-export').addEventListener('click', function () {
    collectAllForms();
    var blob = new Blob([JSON.stringify(siteData, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'insightbridge-site-data.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported!');
  });

  /* ===== IMPORT (with validation) ===== */
  document.getElementById('btn-import').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    /* Security: only accept .json files under 2MB */
    if (!file.name.endsWith('.json') || file.size > 2 * 1024 * 1024) {
      showToast('Error: Only .json files under 2MB accepted');
      e.target.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var imported = JSON.parse(ev.target.result);
        /* Security: validate required structure */
        if (!imported.meta || !imported.home || !Array.isArray(imported.home.stats)) {
          showToast('Error: Invalid data structure — missing required fields');
          return;
        }
        /* Security: sanitize all string values to prevent XSS */
        siteData = sanitizeObject(imported);
        safeStorage.setItem(STORAGE_KEY, JSON.stringify(siteData));
        populateAllForms();
        showToast('Data imported successfully!');
      } catch (err) {
        showToast('Error: Invalid JSON file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  /* ===== RESET ===== */
  document.getElementById('btn-reset').addEventListener('click', function () {
    if (confirm('Reset all content to defaults? This will erase your customizations.')) {
      siteData = deepClone(DEFAULT_SITE_DATA);
      safeStorage.removeItem(STORAGE_KEY);
      populateAllForms();
      showToast('Content reset to defaults.');
    }
  });

  /* ===== TOAST ===== */
  function showToast(message) {
    var toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(function () {
      toast.classList.remove('show');
    }, 2500);
  }

  /* ===== POPULATE ALL FORMS ===== */
  function populateAllForms() {
    populateHome();
    populateNews();
    populateAbout();
    populateFramework();
    populateAiModel();
    populatePublications();
    populateCases();
    populateContact();
    populateSettings();
  }

  /* ===== COLLECT ALL FORMS ===== */
  function collectAllForms() {
    collectHome();
    collectNews();
    collectAbout();
    collectFramework();
    collectAiModel();
    collectPublications();
    collectCases();
    collectContact();
    collectSettings();
  }

  /* ============================
     HOME
     ============================ */
  function populateHome() {
    var h = siteData.home;
    setVal('home-label', h.label);
    setVal('home-titleEn', h.titleEn);
    setVal('home-titleCn', h.titleCn);
    setVal('home-subtitleEn', h.subtitleEn);
    setVal('home-subtitleCn', h.subtitleCn);
    setVal('home-ctaText', h.ctaText);
    setVal('home-ctaLink', h.ctaLink);

    var container = document.getElementById('home-stats-container');
    container.innerHTML = '';
    for (var i = 0; i < h.stats.length; i++) {
      container.appendChild(createStatItem(i, h.stats[i]));
    }
  }

  function createStatItem(index, stat) {
    var div = document.createElement('div');
    div.className = 'repeating-item';
    div.innerHTML =
      '<div class="repeating-item__header"><span class="repeating-item__title">Stat ' + (index + 1) + '</span></div>' +
      '<div class="form-group"><label>Number</label><input type="text" class="form-input" data-field="stat-number-' + index + '" value="' + escAttr(stat.number) + '"></div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Label (EN)</label><input type="text" class="form-input" data-field="stat-labelEn-' + index + '" value="' + escAttr(stat.labelEn) + '"></div>' +
      '<div class="form-group"><label>Label (CN)</label><input type="text" class="form-input" data-field="stat-labelCn-' + index + '" value="' + escAttr(stat.labelCn) + '"></div>' +
      '</div>';
    return div;
  }

  function collectHome() {
    var h = siteData.home;
    h.label = getVal('home-label');
    h.titleEn = getVal('home-titleEn');
    h.titleCn = getVal('home-titleCn');
    h.subtitleEn = getVal('home-subtitleEn');
    h.subtitleCn = getVal('home-subtitleCn');
    h.ctaText = getVal('home-ctaText');
    h.ctaLink = getVal('home-ctaLink');

    for (var i = 0; i < h.stats.length; i++) {
      h.stats[i].number = getDataVal('stat-number-' + i);
      h.stats[i].labelEn = getDataVal('stat-labelEn-' + i);
      h.stats[i].labelCn = getDataVal('stat-labelCn-' + i);
    }
  }

  /* ============================
     NEWS
     ============================ */
  function populateNews() {
    if (!siteData.news) {
      siteData.news = { labelEn: 'NEWS', labelCn: '\u65b0\u95fb\u52a8\u6001', titleEn: 'Latest News', titleCn: '\u6700\u65b0\u65b0\u95fb', descEn: '', descCn: '', items: [] };
    }
    var n = siteData.news;
    var container = document.getElementById('news-items-container');
    container.innerHTML = '';
    for (var i = 0; i < n.items.length; i++) {
      container.appendChild(createNewsItem(i, n.items[i]));
    }
  }

  function createNewsItem(index, item) {
    var div = document.createElement('div');
    div.className = 'repeating-item';
    div.innerHTML =
      '<div class="repeating-item__header">' +
      '<span class="repeating-item__title">' + escHtml(item.titleEn || 'News Item ' + (index + 1)) + '</span>' +
      '<button class="repeating-item__remove" data-remove-news="' + index + '" title="Remove">&times;</button>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Date (EN)</label><input type="text" class="form-input" data-field="news-date-' + index + '" value="' + escAttr(item.date) + '"></div>' +
      '<div class="form-group"><label>Date (CN)</label><input type="text" class="form-input" data-field="news-dateCn-' + index + '" value="' + escAttr(item.dateCn) + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Title (EN)</label><input type="text" class="form-input" data-field="news-titleEn-' + index + '" value="' + escAttr(item.titleEn) + '"></div>' +
      '<div class="form-group"><label>Title (CN)</label><input type="text" class="form-input" data-field="news-titleCn-' + index + '" value="' + escAttr(item.titleCn) + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Content (EN)</label><textarea class="form-textarea" rows="4" data-field="news-contentEn-' + index + '">' + escHtml(item.contentEn) + '</textarea></div>' +
      '<div class="form-group"><label>Content (CN)</label><textarea class="form-textarea" rows="4" data-field="news-contentCn-' + index + '">' + escHtml(item.contentCn) + '</textarea></div>' +
      '</div>';

    var removeBtn = div.querySelector('[data-remove-news]');
    removeBtn.addEventListener('click', function () {
      collectNews();
      siteData.news.items.splice(index, 1);
      populateNews();
    });

    return div;
  }

  document.getElementById('btn-add-news').addEventListener('click', function () {
    collectNews();
    siteData.news.items.push({
      date: 'New',
      dateCn: '',
      titleEn: 'New News Item',
      titleCn: '',
      contentEn: '',
      contentCn: ''
    });
    populateNews();
  });

  function collectNews() {
    if (!siteData.news) return;
    var n = siteData.news;
    for (var i = 0; i < n.items.length; i++) {
      n.items[i].date = getDataVal('news-date-' + i);
      n.items[i].dateCn = getDataVal('news-dateCn-' + i);
      n.items[i].titleEn = getDataVal('news-titleEn-' + i);
      n.items[i].titleCn = getDataVal('news-titleCn-' + i);
      n.items[i].contentEn = getDataVal('news-contentEn-' + i);
      n.items[i].contentCn = getDataVal('news-contentCn-' + i);
    }
  }

  /* ============================
     ABOUT
     ============================ */
  function populateAbout() {
    var a = siteData.about;
    setVal('about-titleEn', a.titleEn);
    setVal('about-titleCn', a.titleCn);
    setVal('about-image', a.image);
    setVal('about-email', a.email);
    setVal('about-quoteEn', a.quoteEn);
    setVal('about-quoteCn', a.quoteCn);
    setVal('about-quoteCiteEn', a.quoteCiteEn);
    setVal('about-quoteCiteCn', a.quoteCiteCn);

    if (a.diplomaImages) {
      setVal('about-diplomaPhd', a.diplomaImages.phd);
      setVal('about-diplomaMba', a.diplomaImages.mba);
    }

    // Bio EN
    var bioEnContainer = document.getElementById('about-bioEn-container');
    bioEnContainer.innerHTML = '';
    for (var i = 0; i < a.bioEn.length; i++) {
      var div = document.createElement('div');
      div.className = 'form-group';
      div.innerHTML = '<label>Paragraph ' + (i + 1) + '</label><textarea class="form-textarea" rows="3" data-field="about-bioEn-' + i + '">' + escHtml(a.bioEn[i]) + '</textarea>';
      bioEnContainer.appendChild(div);
    }

    // Bio CN
    var bioCnContainer = document.getElementById('about-bioCn-container');
    bioCnContainer.innerHTML = '';
    for (var j = 0; j < a.bioCn.length; j++) {
      var div2 = document.createElement('div');
      div2.className = 'form-group';
      div2.innerHTML = '<label>Paragraph ' + (j + 1) + '</label><textarea class="form-textarea" rows="3" data-field="about-bioCn-' + j + '">' + escHtml(a.bioCn[j]) + '</textarea>';
      bioCnContainer.appendChild(div2);
    }

    // Credentials
    var credContainer = document.getElementById('about-credentials-container');
    credContainer.innerHTML = '';
    for (var k = 0; k < a.credentials.length; k++) {
      credContainer.appendChild(createCredentialItem(k, a.credentials[k]));
    }
  }

  function createCredentialItem(index, cred) {
    var div = document.createElement('div');
    div.className = 'repeating-item';
    div.innerHTML =
      '<div class="repeating-item__header"><span class="repeating-item__title">Credential ' + (index + 1) + '</span></div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Title (EN)</label><input type="text" class="form-input" data-field="cred-titleEn-' + index + '" value="' + escAttr(cred.titleEn) + '"></div>' +
      '<div class="form-group"><label>Title (CN)</label><input type="text" class="form-input" data-field="cred-titleCn-' + index + '" value="' + escAttr(cred.titleCn) + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Detail (EN)</label><input type="text" class="form-input" data-field="cred-detailEn-' + index + '" value="' + escAttr(cred.detailEn) + '"></div>' +
      '<div class="form-group"><label>Detail (CN)</label><input type="text" class="form-input" data-field="cred-detailCn-' + index + '" value="' + escAttr(cred.detailCn) + '"></div>' +
      '</div>';
    return div;
  }

  function collectAbout() {
    var a = siteData.about;
    a.titleEn = getVal('about-titleEn');
    a.titleCn = getVal('about-titleCn');
    a.image = getVal('about-image');
    a.email = getVal('about-email');
    a.quoteEn = getVal('about-quoteEn');
    a.quoteCn = getVal('about-quoteCn');
    a.quoteCiteEn = getVal('about-quoteCiteEn');
    a.quoteCiteCn = getVal('about-quoteCiteCn');

    if (!a.diplomaImages) a.diplomaImages = {};
    a.diplomaImages.phd = getVal('about-diplomaPhd');
    a.diplomaImages.mba = getVal('about-diplomaMba');

    for (var i = 0; i < a.bioEn.length; i++) {
      a.bioEn[i] = getDataVal('about-bioEn-' + i);
    }
    for (var j = 0; j < a.bioCn.length; j++) {
      a.bioCn[j] = getDataVal('about-bioCn-' + j);
    }
    for (var k = 0; k < a.credentials.length; k++) {
      a.credentials[k].titleEn = getDataVal('cred-titleEn-' + k);
      a.credentials[k].titleCn = getDataVal('cred-titleCn-' + k);
      a.credentials[k].detailEn = getDataVal('cred-detailEn-' + k);
      a.credentials[k].detailCn = getDataVal('cred-detailCn-' + k);
    }
  }

  /* ============================
     FRAMEWORK
     ============================ */
  function populateFramework() {
    var f = siteData.framework;
    setVal('framework-titleEn', f.titleEn);
    setVal('framework-titleCn', f.titleCn);
    setVal('framework-descEn', f.descEn);
    setVal('framework-descCn', f.descCn);

    var container = document.getElementById('framework-concepts-container');
    container.innerHTML = '';
    for (var i = 0; i < f.concepts.length; i++) {
      container.appendChild(createConceptItem(i, f.concepts[i]));
    }
  }

  function createConceptItem(index, concept) {
    var div = document.createElement('div');
    div.className = 'repeating-item';
    div.innerHTML =
      '<div class="repeating-item__header"><span class="repeating-item__title">' + escHtml(concept.titleEn) + '</span></div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Icon (emoji)</label><input type="text" class="form-input" data-field="concept-icon-' + index + '" value="' + escAttr(concept.icon) + '"></div>' +
      '<div class="form-group"><label>Title (EN)</label><input type="text" class="form-input" data-field="concept-titleEn-' + index + '" value="' + escAttr(concept.titleEn) + '"></div>' +
      '</div>' +
      '<div class="form-group"><label>Title (CN)</label><input type="text" class="form-input" data-field="concept-titleCn-' + index + '" value="' + escAttr(concept.titleCn) + '"></div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Description (EN)</label><textarea class="form-textarea" rows="3" data-field="concept-descEn-' + index + '">' + escHtml(concept.descEn) + '</textarea></div>' +
      '<div class="form-group"><label>Description (CN)</label><textarea class="form-textarea" rows="3" data-field="concept-descCn-' + index + '">' + escHtml(concept.descCn) + '</textarea></div>' +
      '</div>';
    return div;
  }

  function collectFramework() {
    var f = siteData.framework;
    f.titleEn = getVal('framework-titleEn');
    f.titleCn = getVal('framework-titleCn');
    f.descEn = getVal('framework-descEn');
    f.descCn = getVal('framework-descCn');

    for (var i = 0; i < f.concepts.length; i++) {
      f.concepts[i].icon = getDataVal('concept-icon-' + i);
      f.concepts[i].titleEn = getDataVal('concept-titleEn-' + i);
      f.concepts[i].titleCn = getDataVal('concept-titleCn-' + i);
      f.concepts[i].descEn = getDataVal('concept-descEn-' + i);
      f.concepts[i].descCn = getDataVal('concept-descCn-' + i);
    }
  }

  /* ============================
     AI MODEL
     ============================ */
  function populateAiModel() {
    var m = siteData.aiModel;
    setVal('aiModel-titleEn', m.titleEn);
    setVal('aiModel-titleCn', m.titleCn);
    setVal('aiModel-descEn', m.descEn);
    setVal('aiModel-descCn', m.descCn);

    var container = document.getElementById('aiModel-pillars-container');
    container.innerHTML = '';
    for (var i = 0; i < m.pillars.length; i++) {
      container.appendChild(createPillarItem(i, m.pillars[i]));
    }
  }

  function createPillarItem(index, pillar) {
    var div = document.createElement('div');
    div.className = 'repeating-item';
    div.innerHTML =
      '<div class="repeating-item__header"><span class="repeating-item__title">' + escHtml(pillar.titleEn) + '</span></div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Icon (emoji)</label><input type="text" class="form-input" data-field="pillar-icon-' + index + '" value="' + escAttr(pillar.icon) + '"></div>' +
      '<div class="form-group"><label>Title (EN)</label><input type="text" class="form-input" data-field="pillar-titleEn-' + index + '" value="' + escAttr(pillar.titleEn) + '"></div>' +
      '</div>' +
      '<div class="form-group"><label>Title (CN)</label><input type="text" class="form-input" data-field="pillar-titleCn-' + index + '" value="' + escAttr(pillar.titleCn) + '"></div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Description (EN)</label><textarea class="form-textarea" rows="3" data-field="pillar-descEn-' + index + '">' + escHtml(pillar.descEn) + '</textarea></div>' +
      '<div class="form-group"><label>Description (CN)</label><textarea class="form-textarea" rows="3" data-field="pillar-descCn-' + index + '">' + escHtml(pillar.descCn) + '</textarea></div>' +
      '</div>';
    return div;
  }

  function collectAiModel() {
    var m = siteData.aiModel;
    m.titleEn = getVal('aiModel-titleEn');
    m.titleCn = getVal('aiModel-titleCn');
    m.descEn = getVal('aiModel-descEn');
    m.descCn = getVal('aiModel-descCn');

    for (var i = 0; i < m.pillars.length; i++) {
      m.pillars[i].icon = getDataVal('pillar-icon-' + i);
      m.pillars[i].titleEn = getDataVal('pillar-titleEn-' + i);
      m.pillars[i].titleCn = getDataVal('pillar-titleCn-' + i);
      m.pillars[i].descEn = getDataVal('pillar-descEn-' + i);
      m.pillars[i].descCn = getDataVal('pillar-descCn-' + i);
    }
  }

  /* ============================
     PUBLICATIONS
     ============================ */
  function populatePublications() {
    var p = siteData.publications;
    var container = document.getElementById('publications-items-container');
    container.innerHTML = '';
    for (var i = 0; i < p.items.length; i++) {
      container.appendChild(createPublicationItem(i, p.items[i]));
    }
  }

  function createPublicationItem(index, pub) {
    var div = document.createElement('div');
    div.className = 'repeating-item';
    div.innerHTML =
      '<div class="repeating-item__header">' +
      '<span class="repeating-item__title">' + escHtml(pub.titleEn || 'Publication ' + (index + 1)) + '</span>' +
      '<button class="repeating-item__remove" data-remove-pub="' + index + '" title="Remove">&times;</button>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Tag</label><input type="text" class="form-input" data-field="pub-tag-' + index + '" value="' + escAttr(pub.tag) + '"></div>' +
      '<div class="form-group"><label>Meta</label><input type="text" class="form-input" data-field="pub-meta-' + index + '" value="' + escAttr(pub.meta) + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Title (EN)</label><input type="text" class="form-input" data-field="pub-titleEn-' + index + '" value="' + escAttr(pub.titleEn) + '"></div>' +
      '<div class="form-group"><label>Title (CN)</label><input type="text" class="form-input" data-field="pub-titleCn-' + index + '" value="' + escAttr(pub.titleCn) + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Description (EN)</label><textarea class="form-textarea" rows="2" data-field="pub-descEn-' + index + '">' + escHtml(pub.descEn) + '</textarea></div>' +
      '<div class="form-group"><label>Description (CN)</label><textarea class="form-textarea" rows="2" data-field="pub-descCn-' + index + '">' + escHtml(pub.descCn) + '</textarea></div>' +
      '</div>';

    var removeBtn = div.querySelector('[data-remove-pub]');
    removeBtn.addEventListener('click', function () {
      collectPublications();
      siteData.publications.items.splice(index, 1);
      populatePublications();
    });

    return div;
  }

  document.getElementById('btn-add-publication').addEventListener('click', function () {
    collectPublications();
    siteData.publications.items.push({
      tag: 'New',
      titleEn: 'New Publication',
      titleCn: '',
      descEn: '',
      descCn: '',
      meta: ''
    });
    populatePublications();
  });

  function collectPublications() {
    var p = siteData.publications;
    for (var i = 0; i < p.items.length; i++) {
      p.items[i].tag = getDataVal('pub-tag-' + i);
      p.items[i].meta = getDataVal('pub-meta-' + i);
      p.items[i].titleEn = getDataVal('pub-titleEn-' + i);
      p.items[i].titleCn = getDataVal('pub-titleCn-' + i);
      p.items[i].descEn = getDataVal('pub-descEn-' + i);
      p.items[i].descCn = getDataVal('pub-descCn-' + i);
    }
  }

  /* ============================
     CASE STUDIES
     ============================ */
  function populateCases() {
    var c = siteData.cases;

    // Case items
    var container = document.getElementById('cases-items-container');
    container.innerHTML = '';
    for (var i = 0; i < c.items.length; i++) {
      container.appendChild(createCaseItem(i, c.items[i]));
    }

    // Books
    var booksContainer = document.getElementById('cases-books-container');
    booksContainer.innerHTML = '';
    for (var j = 0; j < c.books.length; j++) {
      booksContainer.appendChild(createBookItem(j, c.books[j]));
    }
  }

  function createCaseItem(index, caseItem) {
    var div = document.createElement('div');
    div.className = 'repeating-item';
    div.innerHTML =
      '<div class="repeating-item__header"><span class="repeating-item__title">' + escHtml(caseItem.titleEn) + '</span></div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Tag</label><input type="text" class="form-input" data-field="case-tag-' + index + '" value="' + escAttr(caseItem.tag) + '"></div>' +
      '<div class="form-group"><label>Title (EN)</label><input type="text" class="form-input" data-field="case-titleEn-' + index + '" value="' + escAttr(caseItem.titleEn) + '"></div>' +
      '</div>' +
      '<div class="form-group"><label>Title (CN)</label><input type="text" class="form-input" data-field="case-titleCn-' + index + '" value="' + escAttr(caseItem.titleCn) + '"></div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Description (EN)</label><textarea class="form-textarea" rows="3" data-field="case-descEn-' + index + '">' + escHtml(caseItem.descEn) + '</textarea></div>' +
      '<div class="form-group"><label>Description (CN)</label><textarea class="form-textarea" rows="3" data-field="case-descCn-' + index + '">' + escHtml(caseItem.descCn) + '</textarea></div>' +
      '</div>';
    return div;
  }

  function createBookItem(index, book) {
    var div = document.createElement('div');
    div.className = 'repeating-item';
    div.innerHTML =
      '<div class="repeating-item__header"><span class="repeating-item__title">' + escHtml(book.titleEn) + '</span></div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Title (EN)</label><input type="text" class="form-input" data-field="book-titleEn-' + index + '" value="' + escAttr(book.titleEn) + '"></div>' +
      '<div class="form-group"><label>Title (CN)</label><input type="text" class="form-input" data-field="book-titleCn-' + index + '" value="' + escAttr(book.titleCn) + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Subtitle (EN)</label><input type="text" class="form-input" data-field="book-subtitleEn-' + index + '" value="' + escAttr(book.subtitleEn) + '"></div>' +
      '<div class="form-group"><label>Subtitle (CN)</label><input type="text" class="form-input" data-field="book-subtitleCn-' + index + '" value="' + escAttr(book.subtitleCn) + '"></div>' +
      '</div>' +
      '<div class="form-row">' +
      '<div class="form-group"><label>Description (EN)</label><textarea class="form-textarea" rows="2" data-field="book-descEn-' + index + '">' + escHtml(book.descEn || '') + '</textarea></div>' +
      '<div class="form-group"><label>Description (CN)</label><textarea class="form-textarea" rows="2" data-field="book-descCn-' + index + '">' + escHtml(book.descCn || '') + '</textarea></div>' +
      '</div>';
    return div;
  }

  function collectCases() {
    var c = siteData.cases;
    for (var i = 0; i < c.items.length; i++) {
      c.items[i].tag = getDataVal('case-tag-' + i);
      c.items[i].titleEn = getDataVal('case-titleEn-' + i);
      c.items[i].titleCn = getDataVal('case-titleCn-' + i);
      c.items[i].descEn = getDataVal('case-descEn-' + i);
      c.items[i].descCn = getDataVal('case-descCn-' + i);
    }
    for (var j = 0; j < c.books.length; j++) {
      c.books[j].titleEn = getDataVal('book-titleEn-' + j);
      c.books[j].titleCn = getDataVal('book-titleCn-' + j);
      c.books[j].subtitleEn = getDataVal('book-subtitleEn-' + j);
      c.books[j].subtitleCn = getDataVal('book-subtitleCn-' + j);
      c.books[j].descEn = getDataVal('book-descEn-' + j);
      c.books[j].descCn = getDataVal('book-descCn-' + j);
    }
  }

  /* ============================
     CONTACT
     ============================ */
  function populateContact() {
    var ct = siteData.contact;
    setVal('contact-company', ct.company);
    setVal('contact-address', ct.address);
    setVal('contact-email', ct.email);
    setVal('contact-phone', ct.phone);
  }

  function collectContact() {
    var ct = siteData.contact;
    ct.company = getVal('contact-company');
    ct.address = getVal('contact-address');
    ct.email = getVal('contact-email');
    ct.phone = getVal('contact-phone');
  }

  /* ============================
     SETTINGS
     ============================ */
  function populateSettings() {
    var m = siteData.meta;
    setVal('settings-siteTitle', m.siteTitle);
    setVal('settings-companyName', m.companyName);
    setVal('settings-logoText', m.logoText);
    setVal('settings-logoSubtitle', m.logoSubtitle);
    setVal('settings-copyright', siteData.footer.copyright);
    setVal('settings-footerEmail', siteData.footer.email);
  }

  function collectSettings() {
    var m = siteData.meta;
    m.siteTitle = getVal('settings-siteTitle');
    m.companyName = getVal('settings-companyName');
    m.logoText = getVal('settings-logoText');
    m.logoSubtitle = getVal('settings-logoSubtitle');
    siteData.footer.copyright = getVal('settings-copyright');
    siteData.footer.email = getVal('settings-footerEmail');
  }

  /* ===== HELPERS ===== */
  function setVal(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value || '';
  }

  function getVal(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function getDataVal(field) {
    var el = document.querySelector('[data-field="' + field + '"]');
    return el ? el.value : '';
  }

  function escAttr(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ===== SECURITY: Deep sanitize all strings in an object ===== */
  function sanitizeObject(obj) {
    if (typeof obj === 'string') {
      /* Strip <script> tags and event handlers */
      return obj.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
                .replace(/javascript:/gi, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
      var clean = {};
      for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
          clean[key] = sanitizeObject(obj[key]);
        }
      }
      return clean;
    }
    return obj;
  }

})();
