/* Kamdaam storefront — shared logic (works from file://, no network needed) */
(function () {
  'use strict';
  var C = window.CATALOG;
  var store = {
    mem: {},
    get: function (k) {
      try { return localStorage.getItem(k); } catch (e) { return this.mem[k] || null; }
    },
    set: function (k, v) {
      try { localStorage.setItem(k, v); } catch (e) { this.mem[k] = v; }
    }
  };

  function money(n) { return '\u20B9' + Number(n).toLocaleString('en-IN'); }
  function imgFile(p) { return 'images/' + p.image.split('/').pop().replace(/\.png$/, '.jpg'); }
  function bannerFile(b) { return 'banners/' + b.split('/').pop().replace(/\.png$/, '.jpg'); }
  function waNum() { return (C.seller.whatsapp || '').replace(/\D/g, ''); }
  function brandName() { return C.brand.name; }

  function getCart() {
    try { return JSON.parse(store.get('kamdaam_cart') || '{}'); } catch (e) { return {}; }
  }
  function setCart(c) { store.set('kamdaam_cart', JSON.stringify(c)); updateBadge(); }
  function cartCount() {
    var c = getCart(), n = 0;
    Object.keys(c).forEach(function (k) { n += c[k]; });
    return n;
  }
  function updateBadge() {
    document.querySelectorAll('.cart-count').forEach(function (el) {
      var n = cartCount();
      el.textContent = n > 99 ? '99+' : n;
      el.style.display = n ? 'flex' : 'none';
    });
  }
  function prodById(id) {
    for (var i = 0; i < C.products.length; i++) if (C.products[i].id === id) return C.products[i];
    return null;
  }
  function catById(id) {
    for (var i = 0; i < C.categories.length; i++) if (C.categories[i].id === id) return C.categories[i];
    return null;
  }

  /* ---------- shared HTML builders ---------- */
  function ratingHTML(p) {
    return '<div class="rating"><span class="stars">\u2605</span>' +
      '<span class="num">' + p.rating.toFixed(1) + '</span>' +
      '<span class="cnt">(' + p.reviews_count.toLocaleString('en-IN') + ')</span></div>';
  }
  function priceHTML(p) {
    return '<div class="price-row"><span class="price">' + money(p.price) + '</span>' +
      '<span class="mrp">' + money(p.mrp) + '</span>' +
      '<span class="off">' + p.discount_pct + '% off</span></div>';
  }
  function badgesHTML(p) {
    if (p.badge === 'bestseller') return '<span class="badge best">BESTSELLER</span>';
    return '';
  }
  function ctaHTML(p) {
    var c = getCart(), q = c[p.id] || 0;
    if (!q) return '<button class="btn btn-add" data-add="' + p.id + '">ADD</button>';
    return stepperHTML(p.id, q);
  }
  function stepperHTML(id, q) {
    return '<div class="stepper" data-stepper="' + id + '">' +
      '<button data-dec="' + id + '" aria-label="Decrease quantity">\u2212</button>' +
      '<span class="qv">' + q + '</span>' +
      '<button data-inc="' + id + '" aria-label="Increase quantity">+</button></div>';
  }
  function cardHTML(p, i) {
    var pi = (typeof i === 'number') ? (i % 6) : 0;
    return '<div class="card pastel-' + pi + '" data-card="' + p.id + '">' +
      '<a class="card-img" href="product.html?id=' + p.id + '" aria-label="' + esc(p.name) + '">' +
      '<img src="' + imgFile(p) + '" alt="' + esc(p.name) + '" loading="lazy">' + badgesHTML(p) + '</a>' +
      '<div class="card-body"><div class="card-name">' + esc(p.name) + '</div>' +
      ratingHTML(p) + priceHTML(p) +
      '<div class="card-cta">' + ctaHTML(p) + '</div></div></div>';
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  /* ---------- cart mutations (event delegation) ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-add],[data-inc],[data-dec]');
    if (!t) return;
    var id = t.getAttribute('data-add') || t.getAttribute('data-inc') || t.getAttribute('data-dec');
    var c = getCart();
    if (t.hasAttribute('data-add')) c[id] = 1;
    else if (t.hasAttribute('data-inc')) c[id] = (c[id] || 0) + 1;
    else { c[id] = (c[id] || 1) - 1; if (c[id] <= 0) delete c[id]; }
    setCart(c);
    refreshSteppers(id);
    if (typeof window.onCartChange === 'function') window.onCartChange();
  });
  function refreshSteppers(id) {
    document.querySelectorAll('[data-card="' + id + '"] .card-cta').forEach(function (box) {
      var p = prodById(id); if (p) box.innerHTML = ctaHTML(p);
    });
    var ps = document.querySelector('[data-pdp-stepper]');
    if (ps) { var q = getCart()[id] || 1; ps.innerHTML = stepperHTML(id, q); }
  }

  /* ---------- WhatsApp order links ---------- */
  function waLink(text) { return 'https://wa.me/' + waNum() + '?text=' + encodeURIComponent(text); }
  function singleOrderText(p, qty) {
    var total = p.price * qty;
    return 'Hello! I want to order from ' + brandName() + ':\n\n' +
      '- ' + p.name + '\n' +
      'Quantity: ' + qty + '\n' +
      'Price: ' + money(p.price) + ' x ' + qty + ' = ' + money(total) + '\n\n' +
      'Total: ' + money(total) + ' (COD/UPI)\n\n' +
      buyerBlock();
  }
  function cartOrderText(items, totals, payLabel) {
    var lines = ['Hello! I want to order from ' + brandName() + ':\n'];
    items.forEach(function (it, i) {
      lines.push((i + 1) + '. ' + it.p.name + '\n   ' + money(it.p.price) + ' x ' + it.q + ' = ' + money(it.p.price * it.q));
    });
    lines.push('\nTotal: ' + money(totals.total) +
      ' (You save: ' + money(totals.savings) + ', ' + (payLabel || 'COD/UPI') + ')\n\n' + buyerBlock());
    return lines.join('\n');
  }

  /* ---------- sale countdown: ticks down to local midnight ---------- */
  function startCountdown() {
    var h = document.getElementById('cdH'),
        m = document.getElementById('cdM'),
        s = document.getElementById('cdS');
    if (!h || !m || !s) return;
    function pad(n) { return (n < 10 ? '0' : '') + n; }
    function tick() {
      var now = new Date();
      var end = new Date(now);
      end.setHours(24, 0, 0, 0); /* next local midnight */
      var d = Math.max(0, Math.floor((end - now) / 1000));
      h.textContent = pad(Math.floor(d / 3600));
      m.textContent = pad(Math.floor((d % 3600) / 60));
      s.textContent = pad(d % 60);
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- device-local account (no server, honest) ---------- */
  var USER_KEY = 'kamdaam_user_v1';
  function getUser() {
    try { return JSON.parse(store.get(USER_KEY) || 'null'); } catch (e) { return null; }
  }
  function setUser(u) { store.set(USER_KEY, JSON.stringify(u)); refreshLoginBtn(); }
  function clearUser() {
    try { localStorage.removeItem(USER_KEY); } catch (e) { delete store.mem[USER_KEY]; }
    refreshLoginBtn();
  }
  function firstName(u) { return String(u.name || '').trim().split(/\s+/)[0] || 'Friend'; }
  function buyerBlock() {
    var u = getUser();
    if (u) return 'My name: ' + u.name + '\nMy mobile: ' + u.mobile + '\nMy address:';
    return 'My name:\nMy address:';
  }

  /* ---------- login / account modal ---------- */
  function ensureModal() {
    if (document.getElementById('kd-login-modal')) return;
    var d = document.createElement('div');
    d.innerHTML = '<div class="kd-modal" id="kd-login-modal" hidden>' +
      '<div class="kd-backdrop" data-kd-close></div>' +
      '<div class="kd-box" role="dialog" aria-modal="true" aria-labelledby="kd-login-title">' +
      '<div class="kd-head"><span id="kd-login-title">Login / Sign Up</span>' +
      '<button class="kd-x" type="button" data-kd-close aria-label="Close">\u00D7</button></div>' +
      '<div class="kd-body" id="kd-body"></div></div></div>';
    document.body.appendChild(d.firstChild);
  }
  function loginFormHTML() {
    return '<div class="kd-field"><label for="kd-name">Full Name</label>' +
      '<input id="kd-name" type="text" placeholder="Enter your full name" autocomplete="name" maxlength="60"></div>' +
      '<div class="kd-field"><label for="kd-mobile">Mobile Number</label>' +
      '<input id="kd-mobile" type="tel" inputmode="numeric" placeholder="10-digit mobile number" autocomplete="tel" maxlength="10"></div>' +
      '<div class="kd-err" id="kd-err" role="alert"></div>' +
      '<button class="kd-continue" id="kd-continue" type="button">Continue</button>' +
      '<p class="kd-note">Your details stay on this device.</p>';
  }
  function accountHTML(u) {
    return '<div class="kd-account">' +
      '<div class="kd-avatar">' + esc(firstName(u).charAt(0).toUpperCase()) + '</div>' +
      '<div class="kd-aname">' + esc(u.name) + '</div>' +
      '<div class="kd-amobile">+91 ' + esc(u.mobile) + '</div></div>' +
      '<button class="kd-logout" id="kd-logout" type="button">Logout</button>';
  }
  function renderLoginBody() {
    var body = document.getElementById('kd-body');
    if (!body) return;
    var u = getUser();
    body.innerHTML = u ? accountHTML(u) : loginFormHTML();
    var cont = document.getElementById('kd-continue');
    if (cont) cont.addEventListener('click', doLogin);
    var out = document.getElementById('kd-logout');
    if (out) out.addEventListener('click', function () { clearUser(); closeLogin(); });
    if (!u) { var nm = document.getElementById('kd-name'); if (nm) nm.focus(); }
  }
  function openLogin() { ensureModal(); renderLoginBody(); document.getElementById('kd-login-modal').hidden = false; }
  function closeLogin() { var m = document.getElementById('kd-login-modal'); if (m) m.hidden = true; }
  function doLogin() {
    var nameEl = document.getElementById('kd-name');
    var mobEl = document.getElementById('kd-mobile');
    var err = document.getElementById('kd-err');
    if (!nameEl || !mobEl || !err) return;
    var name = nameEl.value.trim();
    var mobile = mobEl.value.replace(/\D/g, '');
    if (name.length < 2) { err.textContent = 'Please enter your full name.'; nameEl.focus(); return; }
    if (!/^[6-9]\d{9}$/.test(mobile)) { err.textContent = 'Please enter a valid 10-digit mobile number.'; mobEl.focus(); return; }
    err.textContent = '';
    setUser({ name: name, mobile: mobile });
    closeLogin();
  }
  function refreshLoginBtn() {
    var b = document.getElementById('login-btn');
    if (!b) return;
    var u = getUser();
    b.textContent = u ? 'Hi, ' + firstName(u) : 'Login';
  }

  /* ---------- header/footer shells ---------- */
  function headerHTML(active) {
    return '<header class="header"><div class="wrap header-inner">' +
      '<a class="logo-chip" href="index.html" aria-label="Kamdaam Home">' +
      '<img src="img/logo-d-chip.png" alt="Kamdaam"></a>' +
      '<div class="searchbar">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8A918A" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
      '<input id="search" type="search" placeholder="Search for Products, Brands and More" aria-label="Search products"></div>' +
      '<div class="header-actions">' +
      '<button class="login-btn" id="login-btn" type="button">Login</button>' +
      '<a class="cart-link" href="cart.html" aria-label="Cart">' +
      '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>' +
      '<span class="lbl">Cart</span>' +
      '<span class="cart-count" style="display:none">0</span></a></div></div></header>';
  }
  function footerHTML() {
    return '<footer class="footer"><div class="wrap">' +
      '<div class="brand">Kamdaam</div>' +
      '<p>Low Prices. Every Day. — Quality products at the right price. Orders are confirmed on WhatsApp.</p>' +
      '<div class="pay"><span>COD Available</span><span>UPI Available</span></div>' +
      '<p>Contact: support@example.com</p>' + /* PLACEHOLDER — replace with real support email */
      '</div></footer>';
  }

  window.KD = {
    C: C, money: money, imgFile: imgFile, bannerFile: bannerFile,
    getCart: getCart, setCart: setCart, cartCount: cartCount, updateBadge: updateBadge,
    prodById: prodById, catById: catById, cardHTML: cardHTML, priceHTML: priceHTML,
    ratingHTML: ratingHTML, stepperHTML: stepperHTML, badgesHTML: badgesHTML,
    waLink: waLink, singleOrderText: singleOrderText, cartOrderText: cartOrderText,
    headerHTML: headerHTML, footerHTML: footerHTML, esc: esc, startCountdown: startCountdown
  };
  document.addEventListener('DOMContentLoaded', function () {
    updateBadge();
    ensureModal();
    refreshLoginBtn();
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('#login-btn')) { openLogin(); return; }
    if (e.target.closest('[data-kd-close]')) { closeLogin(); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLogin();
  });
})();
