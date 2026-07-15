const defaultSponsors = [];
const legacySponsorImages = new Set([
  'sponsor-logo-bianco.png',
  'sponsor-skyrea.png',
  'sponsor-bloodbrothers.png',
  'sponsor-bakuten-box.png',
  'sponsor-res.png'
]);

const defaults = {
  teams: [],
  tournaments: [],
  rules: '',
  sponsors: defaultSponsors
};

let data = JSON.parse(JSON.stringify(defaults));
let admin = false;
let edit = {};
let sponsorEdit = null;
const $ = (selector) => document.querySelector(selector);

function esc(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2500);
}

function tournamentTimestamp({ date, time = '00:00' }) {
  const timeValue = /^\d{2}:\d{2}$/.test(time) ? time : '00:00';
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Date(`${date}T${timeValue}`).getTime();

  const months = { gennaio: 0, febbraio: 1, marzo: 2, aprile: 3, maggio: 4, giugno: 5, luglio: 6, agosto: 7, settembre: 8, ottobre: 9, novembre: 10, dicembre: 11 };
  const match = String(date).trim().toLowerCase().match(/^(\d{1,2})\s+([a-zà]+)\s+(\d{4})$/i);
  if (match && months[match[2]] !== undefined) {
    const [, day, month, year] = match;
    return new Date(Number(year), months[month], Number(day), ...timeValue.split(':').map(Number)).getTime();
  }

  const timestamp = new Date(date).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function formatTournamentDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}

function isPastTournament({ date }) {
  const tournamentDay = tournamentTimestamp({ date, time: '00:00' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Number.isFinite(tournamentDay) && tournamentDay < today.getTime();
}

function removeDemoContent(saved) {
  const demoTeamNames = ['Black Wolves', 'Phoenix Bladers', 'Nova Strike', 'Iron Ronin'];
  const demoTournamentTitles = ['AWS Night Clash', 'Purple Storm Cup', 'Rising Stars'];
  return {
    teams: (Array.isArray(saved?.teams) ? saved.teams : []).filter((team) => !demoTeamNames.includes(team.name)),
    tournaments: (Array.isArray(saved?.tournaments) ? saved.tournaments : []).filter((tournament) => !demoTournamentTitles.includes(tournament.title)),
    rules: typeof saved?.rules === 'string' ? saved.rules : '',
    sponsors: Array.isArray(saved?.sponsors) ? saved.sponsors.filter((sponsor) => !legacySponsorImages.has(sponsor.image)) : defaultSponsors
  };
}

async function persist() {
  try {
    if (!window.awsStore) throw new Error('storage-not-ready');
    await window.awsStore.save(data);
  } catch {
    toast('Impossibile salvare le modifiche.');
  }
}

function render() {
  const currentUser = window.awsAuth?.currentUser;
  const isAdmin = currentUser && currentUser.badges.includes('admin');
  const isClubLeader = currentUser && currentUser.badges.includes('club_leader');

  // Toggle admin class on body for CSS styling visibility
  document.body.classList.toggle('admin', isAdmin);

  // Visibilità pulsanti creazione
  const newTourneyBtn = $('[data-modal="tournament"]');
  if (newTourneyBtn) {
    newTourneyBtn.style.display = (isAdmin || isClubLeader) ? 'inline-flex' : 'none';
  }
  const newTeamBtn = $('[data-modal="team"]');
  if (newTeamBtn) {
    newTeamBtn.style.display = isAdmin ? 'inline-flex' : 'none';
  }

  data.teams.sort((a, b) => b.stars - a.stars);
  $('#rankingBody').innerHTML = data.teams.length ? data.teams.map((team, index) => `
    <tr>
      <td class="rank">${index + 1}</td>
      <td>
        <div class="team-cell">
          <img class="team-logo" src="${esc(team.logo)}" alt="Logo ${esc(team.name)}" onerror="this.src='https://placehold.co/90x90/41156d/fff?text=★'">
          <div>
            <span style="font-weight: 700; font-size: 16px;">${esc(team.name)}</span>
            <div class="team-members-row">
              ${(team.members || []).map(uid => {
                const member = (team.membersDetails || []).find(m => m.uid === uid) || { nickname: 'Blader in attesa', photoURL: '' };
                const avatar = member.photoURL || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + uid;
                return `
                  <span class="team-member-badge" title="${esc(member.nickname)}">
                    <img src="${esc(avatar)}" alt="">
                    <span>${esc(member.nickname)}</span>
                  </span>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      </td>
      <td class="stars">${team.stars}</td>
      <td class="admin-only"><div class="table-actions"><button class="action" onclick="openEdit('team',${team.id})">Modifica</button><button class="action delete" onclick="removeItem('team',${team.id})">Elimina</button></div></td>
    </tr>`).join('') : '';

  const tournaments = [...data.tournaments].sort((first, second) => tournamentTimestamp(first) - tournamentTimestamp(second));
  $('#tournamentGrid').innerHTML = tournaments.length ? tournaments.map((tournament) => {
    const past = isPastTournament(tournament);
    const canManageTournament = isAdmin || (isClubLeader && String(tournament.creatorId) === String(currentUser?.uid));
    
    return `
    <article class="tournament-card${past ? ' is-past' : ''}" role="link" tabindex="0" onclick='openTournament(${JSON.stringify(tournament.id)})' onkeydown='if(event.key === "Enter" || event.key === " "){event.preventDefault();openTournament(${JSON.stringify(tournament.id)})}'>
      ${canManageTournament ? `
      <div class="card-actions" style="display: flex;" onclick="event.stopPropagation()" onkeydown="event.stopPropagation()">
        <button class="action" onclick="openEdit('tournament',${tournament.id})">Modifica</button>
        <button class="action delete" onclick="removeItem('tournament',${tournament.id})">Elimina</button>
      </div>
      ` : ''}
      ${tournament.image ? `<div class="tournament-image"><img src="${esc(tournament.image)}" alt="Immagine del torneo ${esc(tournament.title)}" loading="lazy" onerror="this.parentElement.remove()"></div>` : ''}
      <p class="eyebrow">TORNEO APRILIA WESTSIDE</p><h3>${esc(tournament.title)}</h3>
      <div class="meta">
        <div><small>DATA · ORA</small><span>${esc(formatTournamentDate(tournament.date))} · ${esc(tournament.time)}</span></div>
        <div><small>LUOGO</small><span>${esc(tournament.place)}</span></div>
        <div><small>PARTECIPANTI</small><span>${esc(tournament.max)}</span></div>
        <div><small>COSTO</small><span>${esc(tournament.cost)}</span></div>
        <div><small>FORMATO</small><span>${esc(tournament.format)}</span></div>
      </div>
      ${past ? '<span class="past-label">Passato</span>' : ''}
    </article>`;
  }).join('') : '';
  renderSponsors();
}

function sponsorLink(link) {
  try {
    const url = new URL(link);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function renderSponsors() {
  const sponsors = Array.isArray(data.sponsors) ? data.sponsors : [];
  $('#footerSponsorItems').innerHTML = sponsors.map((sponsor, index) => {
    const image = `<img class="sponsor-image sponsor-index-${index + 1}${index === 3 ? ' sponsor-bakuten' : ''}" src="${esc(sponsor.image)}" alt="${esc(sponsor.name || 'Logo sponsor')}" onerror="this.style.display='none'">`;
    const link = sponsorLink(sponsor.link);
    return link ? `<a href="${esc(link)}" aria-label="Visita ${esc(sponsor.name || 'sponsor')}">${image}</a>` : image;
  }).join('');
}

function renderSponsorManager() {
  const sponsors = Array.isArray(data.sponsors) ? data.sponsors : [];
  $('#sponsorManager').innerHTML = sponsors.length ? sponsors.map((sponsor) => `<div class="sponsor-manager-row"><img src="${esc(sponsor.image)}" alt=""><span>${esc(sponsor.name || 'Sponsor senza nome')}</span><button class="action" type="button" onclick="openSponsorEdit('${esc(sponsor.id)}')">Modifica</button><button class="action delete" type="button" onclick="removeSponsor('${esc(sponsor.id)}')">Elimina</button></div>`).join('') : '<p class="empty-message">Nessuno sponsor inserito.</p>';
}

function openSponsorEditor(sponsor) {
  sponsorEdit = sponsor || null;
  $('#sponsorEditorTitle').textContent = sponsor ? 'Modifica sponsor' : 'Aggiungi sponsor';
  const form = $('#sponsorForm');
  form.elements.name.value = sponsor?.name || '';
  form.elements.image.value = sponsor?.image || '';
  form.elements.link.value = sponsor?.link || '';
  $('#sponsorEditorBackdrop').classList.add('open');
}

window.openSponsorEdit = (id) => openSponsorEditor(data.sponsors.find((sponsor) => String(sponsor.id) === String(id)));
window.removeSponsor = (id) => {
  if (!confirm('Vuoi eliminare questo sponsor?')) return;
  data.sponsors = data.sponsors.filter((sponsor) => String(sponsor.id) !== String(id));
  persist(); render(); renderSponsorManager(); toast('Sponsor eliminato.');
};

const fields = {
  team: [['name', 'Nome squadra', 'text'], ['logo', 'URL logo squadra', 'url'], ['stars', 'Numero stelle', 'number']],
  tournament: [['title', 'Nome torneo', 'text'], ['date', 'Data', 'date'], ['time', 'Ora', 'time'], ['place', 'Luogo', 'text'], ['max', 'Numero massimo partecipanti', 'text'], ['cost', 'Costo', 'text'], ['format', 'Formato', 'text'], ['image', 'URL immagine torneo (facoltativo)', 'url', false]]
};

function openModal(type, item) {
  edit = { type, item };
  $('#modalTitle').textContent = item ? `Modifica ${type === 'team' ? 'squadra' : 'torneo'}` : `Crea ${type === 'team' ? 'una squadra' : 'un torneo'}`;
  $('#editorForm').innerHTML = `<div class="${type === 'tournament' ? 'form-grid' : ''}">${fields[type].map(([key, label, inputType, required = true]) => `<label>${label}<input ${required ? 'required' : ''} name="${key}" type="${inputType}" value="${esc(item?.[key] ?? (key === 'logo' ? 'https://placehold.co/90x90/41156d/fff?text=★' : ''))}"></label>`).join('')}</div><button class="form-save">${item ? 'Salva modifiche' : 'Aggiungi'}</button>`;
  $('#modalBackdrop').classList.add('open');
}

window.openEdit = (type, id) => openModal(type, (type === 'team' ? data.teams : data.tournaments).find((item) => item.id === id));
window.openTournament = (id) => { window.location.href = `torneo.html?id=${encodeURIComponent(id)}`; };
window.removeItem = (type, id) => {
  if (!confirm('Vuoi eliminare questo elemento?')) return;
  const key = type === 'team' ? 'teams' : 'tournaments';
  data[key] = data[key].filter((item) => item.id !== id);
  persist(); render(); toast('Elemento eliminato.');
};

document.querySelectorAll('[data-modal]').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.modal)));
const closeModalBtn = $('#closeModal');
if (closeModalBtn) closeModalBtn.addEventListener('click', () => $('#modalBackdrop').classList.remove('open'));
const modalBackdropEl = $('#modalBackdrop');
if (modalBackdropEl) modalBackdropEl.addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') $('#modalBackdrop').classList.remove('open'); });

$('#editorForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const item = Object.fromEntries(new FormData(event.target));
  if (edit.type === 'team') item.stars = Number(item.stars);
  const key = edit.type === 'team' ? 'teams' : 'tournaments';
  if (edit.item) Object.assign(edit.item, item);
  else { 
    item.id = Date.now(); 
    if (edit.type === 'tournament' && window.awsAuth?.currentUser) {
      item.creatorId = window.awsAuth.currentUser.uid;
    }
    data[key].push(item); 
  }
  persist(); render(); $('#modalBackdrop').classList.remove('open');
  toast(edit.item ? 'Modifiche salvate.' : edit.type === 'team' ? 'Squadra aggiunta!' : 'Torneo pubblicato!');
});

function openSponsorManager() {
  const currentUser = window.awsAuth?.currentUser;
  const isAdmin = currentUser && currentUser.badges.includes('admin');
  if (!isAdmin) {
    toast('Accesso consentito solo agli amministratori.');
    return;
  }
  renderSponsorManager();
  $('#sponsorsBackdrop').classList.add('open');
}
window.openSponsorManager = openSponsorManager;
const manageSponsorsBtn = $('#manageSponsors');
if (manageSponsorsBtn) manageSponsorsBtn.addEventListener('click', openSponsorManager);
const addSponsorBtn = $('#addSponsor');
if (addSponsorBtn) addSponsorBtn.addEventListener('click', () => openSponsorEditor());
const closeSponsorsBtn = $('#closeSponsors');
if (closeSponsorsBtn) closeSponsorsBtn.addEventListener('click', () => $('#sponsorsBackdrop').classList.remove('open'));
const sponsorsBackdropEl = $('#sponsorsBackdrop');
if (sponsorsBackdropEl) sponsorsBackdropEl.addEventListener('click', (event) => { if (event.target.id === 'sponsorsBackdrop') $('#sponsorsBackdrop').classList.remove('open'); });
const closeSponsorEditorBtn = $('#closeSponsorEditor');
if (closeSponsorEditorBtn) closeSponsorEditorBtn.addEventListener('click', () => $('#sponsorEditorBackdrop').classList.remove('open'));
const sponsorEditorBackdropEl = $('#sponsorEditorBackdrop');
if (sponsorEditorBackdropEl) sponsorEditorBackdropEl.addEventListener('click', (event) => { if (event.target.id === 'sponsorEditorBackdrop') $('#sponsorEditorBackdrop').classList.remove('open'); });

const sponsorFormEl = $('#sponsorForm');
if (sponsorFormEl) {
  sponsorFormEl.addEventListener('submit', (event) => {
    event.preventDefault();
    const sponsor = Object.fromEntries(new FormData(event.currentTarget));
    if (sponsorEdit) Object.assign(sponsorEdit, sponsor);
    else data.sponsors.push({ ...sponsor, id: `sponsor-${Date.now()}` });
    persist(); render(); renderSponsorManager(); $('#sponsorEditorBackdrop').classList.remove('open');
    toast(sponsorEdit ? 'Sponsor modificato.' : 'Sponsor aggiunto.');
  });
}

window.addEventListener('aws-store-ready', async () => {
  try {
    const saved = await window.awsStore.load();
    data = removeDemoContent(saved);
    render();

    // Listen to Firebase Auth
    if (window.awsAuth) {
      window.awsAuth.onAuthChange((user) => {
        const profileLink = $('#profileLink');
        const loginLink = $('#loginLink');
        if (user) {
          if (profileLink) profileLink.classList.remove('hidden');
          if (loginLink) loginLink.classList.add('hidden');
          const avatarEl = $('#navAvatar');
          const nickEl = $('#navNickname');
          if (avatarEl) avatarEl.src = user.photoURL;
          if (nickEl) nickEl.textContent = user.nickname || 'Profilo';
          
          admin = user.badges && user.badges.includes('admin');
        } else {
          if (profileLink) profileLink.classList.add('hidden');
          if (loginLink) loginLink.classList.remove('hidden');
          admin = false;
        }
        render();
      });
    }
  } catch (e) {
    console.error(e);
    render();
  }
});

render();
