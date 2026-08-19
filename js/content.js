/* ============================================================
   GRETNA FIRE & RESCUE — content.js
   Renders events, news, and announcements published through the
   /admin CMS (markdown files in _events/, _news/, _announcements/)
   directly onto the public pages. No build step — fetched live
   from GitHub at page load. Safely no-ops on pages that don't
   have the matching sections.
   ============================================================ */

(function () {

  const REPO = 'Gretna-Fire-Rescue-Inc/gretnafirerescue.com';
  const BRANCH = 'main';

  const MONTHS = ['January','February','March','April','May','June','July',
                  'August','September','October','November','December'];

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }

  function parseFrontmatter(raw) {
    const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { data: {}, body: raw.trim() };
    const data = {};
    m[1].split('\n').forEach(line => {
      const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
      if (!kv) return;
      let val = kv[2].trim();
      if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
      if (val === 'true') val = true;
      else if (val === 'false') val = false;
      data[kv[1]] = val;
    });
    return { data, body: m[2].trim() };
  }

  function toDate(str) {
    if (!str) return null;
    const d = new Date(String(str).trim().replace(' ', 'T'));
    return isNaN(d) ? null : d;
  }

  function formatTime(d) {
    let h = d.getHours(), min = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${String(min).padStart(2, '0')} ${ampm}`;
  }

  async function fetchCollection(folder) {
    const listRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${folder}?ref=${BRANCH}`);
    if (!listRes.ok) throw new Error('list failed: ' + folder);
    const files = (await listRes.json()).filter(f => f.name && f.name.endsWith('.md'));
    return Promise.all(files.map(async f => {
      const res = await fetch(f.download_url);
      const raw = await res.text();
      return parseFrontmatter(raw);
    }));
  }

  /* ── EVENTS ── */

  const EVENT_CAT_CLASS = {
    fundraiser: 'cat-fundraiser',
    training: 'cat-training',
    community: 'cat-community',
    meeting: 'cat-community',
    openhouse: 'cat-community',
    other: 'cat-community'
  };

  const EVENT_CAT_LABEL = {
    fundraiser: 'Fundraiser',
    training: 'Training',
    community: 'Community',
    meeting: 'Meeting',
    openhouse: 'Open House',
    other: 'Event'
  };

  function eventCard(e) {
    const d = toDate(e.data.date);
    const title = escapeHtml(e.data.title || 'Untitled Event');
    const catKey = String(e.data.category || 'other').toLowerCase();
    const catClass = EVENT_CAT_CLASS[catKey] || 'cat-community';
    const catLabel = EVENT_CAT_LABEL[catKey] || 'Event';
    const desc = escapeHtml((e.body || '').split('\n\n')[0]);
    const loc = e.data.location
      ? `<div class="event-meta-row"><span>📍</span> ${escapeHtml(e.data.location)}</div>`
      : '';
    return `
      <div class="event-card">
        <div class="event-date-block">
          <div class="event-date-num">${String(d.getDate()).padStart(2, '0')}</div>
          <div class="event-date-meta">
            <span class="event-date-month">${MONTHS[d.getMonth()]}</span>
            <span class="event-date-year">${d.getFullYear()}</span>
          </div>
        </div>
        <div class="event-body">
          <span class="event-category ${catClass}">${catLabel}</span>
          <h3>${title}</h3>
          <p>${desc}</p>
          <div class="event-meta">
            <div class="event-meta-row"><span>🕐</span> ${formatTime(d)}</div>
            ${loc}
          </div>
        </div>
      </div>`;
  }

  function pastItem(e) {
    const d = toDate(e.data.date);
    const title = escapeHtml(e.data.title || 'Untitled Event');
    const sub = e.data.location
      ? escapeHtml(e.data.location)
      : (EVENT_CAT_LABEL[String(e.data.category || '').toLowerCase()] || '');
    return `
      <div class="past-item">
        <div class="past-date-badge">
          <span class="past-date-badge-month">${MONTHS[d.getMonth()].slice(0, 3)}</span>
          <span class="past-date-badge-day">${String(d.getDate()).padStart(2, '0')}</span>
          <span class="past-date-badge-year">${d.getFullYear()}</span>
        </div>
        <div class="past-info">
          <h4>${title}</h4>
          <p>${sub}</p>
        </div>
      </div>`;
  }

  const EMPTY_NOTE = 'padding:2.5rem 0; color:var(--muted); font-size:0.9rem;';

  async function renderEvents() {
    const upcomingGrid = document.querySelector('.events-grid');
    const pastGrid = document.querySelector('.past-grid');
    if (!upcomingGrid && !pastGrid) return;

    try {
      const events = (await fetchCollection('_events'))
        .filter(e => e.data.published !== false && toDate(e.data.date));

      const now = new Date();
      const upcoming = events
        .filter(e => toDate(e.data.date) >= now)
        .sort((a, b) => toDate(a.data.date) - toDate(b.data.date));
      const past = events
        .filter(e => toDate(e.data.date) < now)
        .sort((a, b) => toDate(b.data.date) - toDate(a.data.date));

      if (upcomingGrid) {
        upcomingGrid.innerHTML = upcoming.length
          ? upcoming.map(eventCard).join('')
          : `<p style="${EMPTY_NOTE}">No upcoming events scheduled right now — check back soon.</p>`;
      }
      if (pastGrid) {
        pastGrid.innerHTML = past.length
          ? past.slice(0, 6).map(pastItem).join('')
          : `<p style="${EMPTY_NOTE}">No past events yet.</p>`;
      }
    } catch (e) {
      /* leave section as-is on failure */
    }
  }

  /* ── NEWS ── */

  const NEWS_TAG_LABEL = {
    news: 'News', fire: 'Fire', ems: 'EMS',
    community: 'Community', training: 'Training', safety: 'Safety'
  };

  function newsItem(n) {
    const d = toDate(n.data.date);
    const title = escapeHtml(n.data.title || 'Untitled');
    const summary = escapeHtml(n.data.summary || (n.body || '').split('\n\n')[0]);
    const label = NEWS_TAG_LABEL[String(n.data.category || 'news').toLowerCase()] || 'News';
    const dateLabel = d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
    return `
      <div class="news-item">
        <span class="news-date">${dateLabel}</span>
        <div class="news-body">
          <h3>${title}</h3>
          <p>${summary}</p>
        </div>
        <span class="news-tag tag-news">${label}</span>
      </div>`;
  }

  async function renderNews() {
    const newsList = document.querySelector('.news-list');
    if (!newsList) return;

    try {
      const news = (await fetchCollection('_news'))
        .filter(n => n.data.published !== false && toDate(n.data.date))
        .sort((a, b) => toDate(b.data.date) - toDate(a.data.date));

      newsList.innerHTML = news.length
        ? news.map(newsItem).join('')
        : `<p style="${EMPTY_NOTE}">No news posted yet.</p>`;
    } catch (e) {
      /* leave section as-is on failure */
    }
  }

  /* ── ANNOUNCEMENT BANNER ── */

  async function renderAnnouncements() {
    const container = document.getElementById('announcement-banner');
    if (!container) return;

    try {
      const now = new Date();
      const anns = (await fetchCollection('_announcements'))
        .filter(a => {
          if (a.data.active !== true) return false;
          const exp = toDate(a.data.expires);
          return !(exp && exp < now);
        })
        .sort((a, b) => toDate(b.data.date) - toDate(a.data.date))
        .slice(0, 3);

      if (!anns.length) {
        container.style.display = 'none';
        return;
      }

      const colors = { danger: '#BF1B23', warning: '#d97706', info: '#2563eb' };
      const icons  = { danger: '🚨', warning: '⚠️', info: 'ℹ️' };

      container.innerHTML = anns.map((a, i) => {
        const type = a.data.type || 'info';
        return `
        <div class="ann-item ann-${type}" style="background:${colors[type] || colors.info};">
          <div class="ann-inner">
            <span class="ann-icon">${icons[type] || icons.info}</span>
            <span class="ann-message">${escapeHtml(a.data.title)}</span>
          </div>
          ${i === 0 ? `<button class="ann-close" onclick="dismissBanner()" aria-label="Dismiss">✕</button>` : ''}
        </div>`;
      }).join('');

      container.style.display = 'block';
    } catch (e) {
      container.style.display = 'none';
    }
  }

  window.dismissBanner = function () {
    const b = document.getElementById('announcement-banner');
    if (b) b.style.display = 'none';
  };

  renderEvents();
  renderNews();
  renderAnnouncements();

})();
