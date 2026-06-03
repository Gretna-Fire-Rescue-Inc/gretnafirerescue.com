/* ============================================================
   GRETNA FIRE & RESCUE — main.js
   Shared across all pages
   ============================================================ */

(function () {

  /* ── NAV SCROLL STATE ── */
  const nav = document.querySelector('.nav');
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ── MOBILE MENU ── */
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      const open = mobileNav.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', open);
    });

    mobileNav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        hamburger.setAttribute('aria-expanded', false);
      });
    });
  }

  /* ── ACTIVE NAV LINK ── */
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .mobile-nav a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  /* ── SCROLL REVEAL ── */
  const revealEls = document.querySelectorAll('[data-reveal]');
  if (revealEls.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });

    revealEls.forEach(el => observer.observe(el));
  }

  /* ── ALERT BANNER ── */
  // Pittsylvania County, VA — NWS county zone VAC143
  const NWS_ZONE    = 'VAC143';
  const NWS_API     = 'https://api.weather.gov/alerts/active?zone=' + NWS_ZONE;
  const ALERTS_JSON = 'data/alerts.json';

  async function initAlerts() {
    const alerts = [];

    // 1. Manual alerts from data/alerts.json (burn ban, custom notices)
    try {
      const res = await fetch(ALERTS_JSON);
      if (res.ok) {
        const data = await res.json();

        if (data.burn_ban && data.burn_ban.active) {
          alerts.push({
            type:    'warning',
            cssType: 'burn',
            title:   'Burn Ban In Effect',
            message: data.burn_ban.message || 'A burn ban is currently in effect for Pittsylvania County.',
            key:     'burn-ban'
          });
        }

        if (data.custom && data.custom.active && data.custom.title) {
          alerts.push({
            type:    data.custom.type || 'warning',
            cssType: data.custom.type || 'warning',
            title:   data.custom.title,
            message: data.custom.message || '',
            key:     'custom-' + data.custom.title
          });
        }

        // Sync the events page burn ban block if it exists
        syncBurnBanBlock(data.burn_ban);
      }
    } catch (e) { /* JSON fetch failed — skip manual alerts */ }

    // 2. NWS weather alerts — Watches and Warnings only, no advisories
    try {
      const res = await fetch(NWS_API);
      if (res.ok) {
        const data = await res.json();
        const features = Array.isArray(data.features) ? data.features : [];

        const weatherAlerts = features.filter(f => {
          const event = (f.properties && f.properties.event) || '';
          return event.endsWith('Warning') || event.endsWith('Watch');
        });

        // Warnings first, then Watches
        weatherAlerts.sort((a, b) => {
          const aScore = a.properties.event.endsWith('Warning') ? 0 : 1;
          const bScore = b.properties.event.endsWith('Warning') ? 0 : 1;
          return aScore - bScore;
        });

        weatherAlerts.forEach(f => {
          const event   = f.properties.event || '';
          const isWarn  = event.endsWith('Warning');
          alerts.push({
            type:    isWarn ? 'warning' : 'watch',
            cssType: isWarn ? 'warning' : 'watch',
            title:   event,
            message: f.properties.headline || '',
            key:     'nws-' + (f.properties.id || event)
          });
        });
      }
    } catch (e) { /* NWS fetch failed — weather alerts unavailable */ }

    if (!alerts.length) return;

    // Filter out individually dismissed alerts (session-scoped)
    const active = alerts.filter(a => !sessionStorage.getItem('gfr-alert-dismissed-' + a.key));
    if (!active.length) return;

    renderBanner(active);
  }

  function renderBanner(alerts) {
    const main  = alerts[0];
    const extra = alerts.length - 1;
    const icon  = main.type === 'warning' ? '⚠' : '⚡';

    const banner = document.createElement('div');
    banner.id        = 'gfr-alert-banner';
    banner.className = 'alert-banner alert-banner--' + main.cssType;
    banner.setAttribute('role', 'alert');
    banner.setAttribute('aria-live', 'assertive');

    banner.innerHTML =
      '<div class="alert-banner-inner">' +
        '<span class="alert-banner-icon">' + icon + '</span>' +
        '<div class="alert-banner-content">' +
          '<strong class="alert-banner-title">' + escHtml(main.title) + '</strong>' +
          '<span class="alert-banner-msg">' + escHtml(main.message) + '</span>' +
        '</div>' +
        (extra > 0 ? '<span class="alert-banner-more">+' + extra + ' more</span>' : '') +
        '<button class="alert-banner-close" aria-label="Dismiss alert">&#x2715;</button>' +
      '</div>';

    // Insert at top of body
    document.body.insertBefore(banner, document.body.firstChild);

    // Inject a style rule to shift first-content elements down by banner height
    const h = banner.offsetHeight;
    const styleEl = document.createElement('style');
    styleEl.id = 'gfr-alert-style';
    styleEl.textContent =
      '.page-hero { padding-top: calc(var(--nav-h) + ' + h + 'px) !important; }' +
      '.hero { margin-top: calc((var(--nav-h) + ' + h + 'px) * -1) !important; }' +
      '.hero-inner { padding-top: calc(var(--nav-h) + ' + h + 'px + 4rem) !important; }';
    document.head.appendChild(styleEl);

    // Dismiss handler — marks all currently shown alerts as dismissed for this session
    banner.querySelector('.alert-banner-close').addEventListener('click', () => {
      alerts.forEach(a => sessionStorage.setItem('gfr-alert-dismissed-' + a.key, '1'));
      banner.remove();
      const s = document.getElementById('gfr-alert-style');
      if (s) s.remove();
    });
  }

  // Update the burn ban status block on events.html if present
  function syncBurnBanBlock(burnBan) {
    const block = document.getElementById('burn-ban-block');
    if (!block) return;
    if (burnBan && burnBan.active) {
      block.classList.add('burn-ban--active');
      const msgEl = block.querySelector('.burn-ban-text p');
      if (msgEl) msgEl.textContent = burnBan.message || 'A burn ban is currently in effect for Pittsylvania County. All open burning is prohibited until further notice.';
      const pill = block.querySelector('.burn-ban-pill');
      if (pill) pill.textContent = 'Ban Active';
    }
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  initAlerts();

})();
