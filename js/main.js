/* ============================================================
   GRETNA FIRE & RESCUE — main.js
   Shared across all pages
   ============================================================ */

(function () {

  const PORTAL_URL = 'https://dev.gretnafirerescue.com';

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

  /* ── ANNOUNCEMENT BANNER ── */
  async function loadAnnouncements() {
    const container = document.getElementById('announcement-banner');
    if (!container) return;

    try {
      const res  = await fetch(PORTAL_URL + '/api/announcements.php', { cache: 'no-cache' });
      const data = await res.json();

      if (!data.success || !data.has_alerts || !data.announcements.length) {
        container.style.display = 'none';
        return;
      }

      // Build banner items — show top 3 max
      const items = data.announcements.slice(0, 3);
      const colors = { danger: '#BF1B23', warning: '#d97706', info: '#2563eb' };
      const icons  = { danger: '🚨', warning: '⚠️', info: 'ℹ️' };

      container.innerHTML = items.map((item, i) => `
        <div class="ann-item ann-${item.type}" style="background:${colors[item.type] || colors.info};">
          <div class="ann-inner">
            <span class="ann-icon">${icons[item.type] || icons.info}</span>
            <span class="ann-message">${escapeHtml(item.message)}</span>
            ${item.source === 'nws' ? '<span class="ann-source">NWS Alert</span>' : ''}
          </div>
          ${i === 0 ? `<button class="ann-close" onclick="dismissBanner()" aria-label="Dismiss">✕</button>` : ''}
        </div>
      `).join('');

      container.style.display = 'block';

    } catch (e) {
      // API unavailable — hide banner silently
      container.style.display = 'none';
    }
  }

  window.dismissBanner = function() {
    const b = document.getElementById('announcement-banner');
    if (b) b.style.display = 'none';
  };

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  loadAnnouncements();

})();
