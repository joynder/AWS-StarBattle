const defaults = {
  teams: [
    { id: 1, name: 'Black Wolves', stars: 38, logo: 'https://placehold.co/90x90/17111f/bd70ff?text=BW' },
    { id: 2, name: 'Phoenix Bladers', stars: 31, logo: 'https://placehold.co/90x90/3b1527/ff9aca?text=PB' },
    { id: 3, name: 'Nova Strike', stars: 26, logo: 'https://placehold.co/90x90/112440/8ec3ff?text=NS' },
    { id: 4, name: 'Iron Ronin', stars: 18, logo: 'https://placehold.co/90x90/382515/ffd287?text=IR' }
  ],
  tournaments: [
    { id: 1, title: 'AWS Night Clash', date: '18 Luglio 2026', time: '15:30', place: 'Milano · X Arena', max: '12 squadre', cost: '€ 10 / player', format: '3vs3 Team Battle' },
    { id: 2, title: 'Purple Storm Cup', date: '2 Agosto 2026', time: '10:00', place: 'Bologna · Blade Hub', max: '16 squadre', cost: '€ 15 / player', format: '5vs5 Team Battle' },
    { id: 3, title: 'Rising Stars', date: '23 Agosto 2026', time: '14:00', place: 'Roma · Spin Zone', max: '8 squadre', cost: '€ 8 / player', format: 'Rookie Team Battle' }
  ]
};

let data = JSON.parse(JSON.stringify(defaults));
let admin = false;
let edit = {};
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

async function persist() {
  try {
    if (!window.awsStore) throw new Error('storage-not-ready');
    await window.awsStore.save(data);
  } catch {
    toast('Impossibile salvare le modifiche.');
  }
}

function render() {
  data.teams.sort((a, b) => b.stars - a.stars);
  $('#rankingBody').innerHTML = data.teams.length ? data.teams.map((team, index) => `
    <tr>
      <td class="rank">${index + 1}</td>
      <td><div class="team-cell"><img class="team-logo" src="${esc(team.logo)}" alt="Logo ${esc(team.name)}" onerror="this.src='https://placehold.co/90x90/41156d/fff?text=★'"><span>${esc(team.name)}</span></div></td>
      <td class="stars">${team.stars}</td>
      <td class="admin-only"><div class="table-actions"><button class="action" onclick="openEdit('team',${team.id})">Modifica</button><button class="action delete" onclick="removeItem('team',${team.id})">Elimina</button></div></td>
    </tr>`).join('') : '<tr><td colspan="4" class="empty">Nessuna squadra in classifica.</td></tr>';

  $('#tournamentGrid').innerHTML = data.tournaments.length ? data.tournaments.map((tournament) => `
    <article class="tournament-card">
      <div class="card-actions"><button class="action" onclick="openEdit('tournament',${tournament.id})">Modifica</button><button class="action delete" onclick="removeItem('tournament',${tournament.id})">Elimina</button></div>
      <p class="eyebrow">TORNEO AWS</p><h3>${esc(tournament.title)}</h3>
      <div class="meta">
        <div><small>DATA · ORA</small><span>${esc(tournament.date)} · ${esc(tournament.time)}</span></div>
        <div><small>LUOGO</small><span>${esc(tournament.place)}</span></div>
        <div><small>PARTECIPANTI</small><span>${esc(tournament.max)}</span></div>
        <div><small>COSTO</small><span>${esc(tournament.cost)}</span></div>
        <div><small>FORMATO</small><span>${esc(tournament.format)}</span></div>
      </div>
    </article>`).join('') : '<div class="empty">Non ci sono tornei programmati.</div>';
  document.body.classList.toggle('admin', admin);
}

const fields = {
  team: [['name', 'Nome squadra', 'text'], ['logo', 'URL logo squadra', 'url'], ['stars', 'Numero stelle', 'number']],
  tournament: [['title', 'Nome torneo', 'text'], ['date', 'Data', 'text'], ['time', 'Ora', 'time'], ['place', 'Luogo', 'text'], ['max', 'Numero massimo partecipanti', 'text'], ['cost', 'Costo', 'text'], ['format', 'Formato', 'text']]
};

function openModal(type, item) {
  edit = { type, item };
  $('#modalTitle').textContent = item ? `Modifica ${type === 'team' ? 'squadra' : 'torneo'}` : `Crea ${type === 'team' ? 'una squadra' : 'un torneo'}`;
  $('#editorForm').innerHTML = `<div class="${type === 'tournament' ? 'form-grid' : ''}">${fields[type].map(([key, label, inputType]) => `<label>${label}<input required name="${key}" type="${inputType}" value="${esc(item?.[key] ?? (key === 'logo' ? 'https://placehold.co/90x90/41156d/fff?text=★' : ''))}"></label>`).join('')}</div><button class="form-save">${item ? 'Salva modifiche' : 'Aggiungi'}</button>`;
  $('#modalBackdrop').classList.add('open');
}

window.openEdit = (type, id) => openModal(type, (type === 'team' ? data.teams : data.tournaments).find((item) => item.id === id));
window.removeItem = (type, id) => {
  if (!confirm('Vuoi eliminare questo elemento?')) return;
  const key = type === 'team' ? 'teams' : 'tournaments';
  data[key] = data[key].filter((item) => item.id !== id);
  persist(); render(); toast('Elemento eliminato.');
};

async function finishLogin() {
  if ($('#adminPassword').value !== 'starbattle') {
    toast('Password non corretta.');
    return;
  }
  try {
    if (window.awsStore?.login) {
      const allowed = await window.awsStore.login();
      if (allowed?.redirecting) {
        toast('Reindirizzamento a Google in corso…');
        return;
      }
      if (!allowed) {
        toast('Questo account Google non è autorizzato.');
        return;
      }
    }
    admin = true;
    $('#adminPassword').value = '';
    $('#loginBackdrop').classList.remove('open');
    render();
    toast('Benvenuto nell’area riservata.');
  } catch {
    toast('Accesso non completato. Riprova.');
  }
}

$('#adminToggle').addEventListener('click', () => {
  if (admin) { admin = false; render(); toast('Modalità amministratore disattivata.'); return; }
  $('#loginBackdrop').classList.add('open');
  setTimeout(() => $('#adminPassword').focus(), 50);
});
$('#closeLogin').addEventListener('click', () => $('#loginBackdrop').classList.remove('open'));
$('#loginBackdrop').addEventListener('click', (event) => { if (event.target.id === 'loginBackdrop') $('#loginBackdrop').classList.remove('open'); });
$('#loginSubmit').addEventListener('click', finishLogin);
$('#loginForm').addEventListener('submit', (event) => { event.preventDefault(); finishLogin(); });
document.querySelectorAll('[data-modal]').forEach((button) => button.addEventListener('click', () => openModal(button.dataset.modal)));
$('#closeModal').addEventListener('click', () => $('#modalBackdrop').classList.remove('open'));
$('#modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') $('#modalBackdrop').classList.remove('open'); });
$('#editorForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const item = Object.fromEntries(new FormData(event.target));
  if (edit.type === 'team') item.stars = Number(item.stars);
  const key = edit.type === 'team' ? 'teams' : 'tournaments';
  if (edit.item) Object.assign(edit.item, item);
  else { item.id = Date.now(); data[key].push(item); }
  persist(); render(); $('#modalBackdrop').classList.remove('open');
  toast(edit.item ? 'Modifiche salvate.' : edit.type === 'team' ? 'Squadra aggiunta!' : 'Torneo pubblicato!');
});

window.addEventListener('aws-store-ready', async () => {
  try {
    const saved = await window.awsStore.load();
    data = (saved.teams?.length || saved.tournaments?.length) ? saved : JSON.parse(JSON.stringify(defaults));
    const redirectLogin = window.awsStore.consumeRedirectLogin?.();
    if (redirectLogin === true) {
      admin = true;
      toast('Benvenuto nell’area riservata.');
    } else if (redirectLogin === false) {
      toast('Questo account Google non è autorizzato.');
    }
    render();
  } catch { render(); }
});

render();
