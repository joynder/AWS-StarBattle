let tournamentData = { teams: [], tournaments: [] };
let tournamentAdmin = false;
const tournamentId = new URLSearchParams(window.location.search).get('id');
const $ = (selector) => document.querySelector(selector);

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2500);
}

function currentTournament() {
  return (tournamentData.tournaments || []).find((item) => String(item.id) === String(tournamentId));
}

function formatDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return date || 'Data da definire';
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}

function teamById(id) {
  return (tournamentData.teams || []).find((team) => String(team.id) === String(id));
}

function teamName(id) {
  return teamById(id)?.name || 'Squadra non disponibile';
}

function participantIds(tournament) {
  return [...new Set(Array.isArray(tournament?.teamIds) ? tournament.teamIds.map(String) : [])].filter((id) => teamById(id));
}

function render() {
  const tournament = currentTournament();
  document.body.classList.toggle('admin', tournamentAdmin);
  if (!tournament) {
    $('#eventHero').innerHTML = '<p class="eyebrow">TORNEO NON TROVATO</p><h1>Questo torneo non è disponibile.</h1>';
    $('#registrationCopy').textContent = 'Torna alla pagina dei tornei e selezionane uno valido.';
    return;
  }
  const ids = participantIds(tournament);
  $('#eventHero').innerHTML = `<p class="eyebrow">TORNEO AWS</p><h1>${esc(tournament.title)}</h1><div class="event-info"><span><small>DATA · ORA</small>${esc(formatDate(tournament.date))} · ${esc(tournament.time)}</span><span><small>LUOGO</small>${esc(tournament.place)}</span><span><small>FORMATO</small>${esc(tournament.format)}</span></div>`;
  $('#registrationCopy').textContent = ids.length ? `${ids.length} ${ids.length === 1 ? 'squadra iscritta' : 'squadre iscritte'}.` : 'Nessuna squadra iscritta.';
  $('#registeredTeams').innerHTML = ids.length ? ids.map((id) => {
    const team = teamById(id);
    return `<div class="team-entry"><img src="${esc(team.logo)}" alt=""><span>${esc(team.name)}</span></div>`;
  }).join('') : '<p class="empty-message">Le iscrizioni verranno pubblicate qui.</p>';
  $('#teamPicker').innerHTML = (tournamentData.teams || []).length ? tournamentData.teams.map((team) => `<label><input type="checkbox" name="team" value="${esc(team.id)}" ${ids.includes(String(team.id)) ? 'checked' : ''}><img class="team-logo" src="${esc(team.logo)}" alt=""><span>${esc(team.name)}</span></label>`).join('') : '<p class="empty-message">Aggiungi prima le squadre nella classifica.</p>';
  const rounds = Array.isArray(tournament.rounds) ? tournament.rounds : [];
  $('#rounds').innerHTML = rounds.length ? `${tournament.startedAt ? '<span class="started">ROUND ROBIN AVVIATO</span>' : ''}${rounds.map((round, index) => `<section class="round"><h3>Round ${index + 1}</h3>${round.matches.map((match) => `<div class="match"><span class="home">${esc(teamName(match.home))}</span><span class="versus">VS</span><span>${esc(teamName(match.away))}</span></div>`).join('')}${round.bye ? `<div class="bye">Riposa: <strong>${esc(teamName(round.bye))}</strong></div>` : ''}</section>`).join('')}` : '<p class="empty-message">Il Round Robin non è stato ancora avviato.</p>';
}

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function createRoundRobin(ids) {
  let rotation = shuffled(ids);
  if (rotation.length % 2) rotation.push(null);
  const rounds = [];
  for (let round = 0; round < rotation.length - 1; round += 1) {
    const matches = [];
    let bye = null;
    for (let index = 0; index < rotation.length / 2; index += 1) {
      const home = rotation[index];
      const away = rotation[rotation.length - 1 - index];
      if (home === null || away === null) bye = home ?? away;
      else matches.push({ home, away });
    }
    rounds.push({ matches, bye });
    rotation = [rotation[0], rotation[rotation.length - 1], ...rotation.slice(1, -1)];
  }
  return rounds;
}

async function saveTournament(update) {
  if (!window.awsStore) throw new Error('storage-not-ready');
  const latest = await window.awsStore.load();
  const tournament = (latest.tournaments || []).find((item) => String(item.id) === String(tournamentId));
  if (!tournament) throw new Error('tournament-not-found');
  update(tournament);
  await window.awsStore.save(latest);
  tournamentData = latest;
  render();
}

async function finishLogin() {
  if ($('#adminPassword').value !== 'starbattle') {
    toast('Password non corretta.');
    return;
  }
  try {
    if (!window.awsStore) throw new Error('storage-not-ready');
    if (window.awsStore.login) {
      const allowed = await window.awsStore.login();
      if (allowed?.redirecting) { toast('Reindirizzamento a Google in corso…'); return; }
      if (!allowed) { toast('Questo account Google non è autorizzato.'); return; }
    }
    tournamentAdmin = true;
    $('#adminPassword').value = '';
    $('#loginBackdrop').classList.remove('open');
    render();
    toast('Area riservata attivata.');
  } catch (error) {
    toast(window.awsStore?.loginErrorMessage?.(error) || 'Accesso non completato. Riprova.');
  }
}

$('#adminToggle').addEventListener('click', () => {
  if (tournamentAdmin) { tournamentAdmin = false; render(); toast('Modalità amministratore disattivata.'); return; }
  $('#loginBackdrop').classList.add('open');
  setTimeout(() => $('#adminPassword').focus(), 50);
});
$('#closeLogin').addEventListener('click', () => $('#loginBackdrop').classList.remove('open'));
$('#loginBackdrop').addEventListener('click', (event) => { if (event.target.id === 'loginBackdrop') $('#loginBackdrop').classList.remove('open'); });
$('#loginSubmit').addEventListener('click', finishLogin);
$('#loginForm').addEventListener('submit', (event) => { event.preventDefault(); finishLogin(); });
$('#registrationForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const teamIds = [...new FormData(event.currentTarget).getAll('team')];
  try {
    await saveTournament((tournament) => {
      tournament.teamIds = teamIds;
      delete tournament.rounds;
      delete tournament.startedAt;
    });
    toast('Iscrizioni salvate.');
  } catch { toast('Impossibile salvare le iscrizioni.'); }
});
async function generateRoundRobin() {
  try {
    await saveTournament((tournament) => {
      const ids = (Array.isArray(tournament.teamIds) ? tournament.teamIds : []).map(String).filter((id) => teamById(id));
      if (ids.length < 2) throw new Error('not-enough-teams');
      tournament.rounds = createRoundRobin(ids);
      tournament.startedAt = new Date().toISOString();
    });
    toast('Abbinamenti Round Robin generati.');
  } catch (error) {
    toast(error.message === 'not-enough-teams' ? 'Iscrivi almeno due squadre prima di avviare il torneo.' : 'Impossibile generare gli abbinamenti.');
  }
}
$('#startTournament').addEventListener('click', generateRoundRobin);
$('#shuffleTournament').addEventListener('click', generateRoundRobin);
window.addEventListener('aws-store-ready', async () => {
  try {
    tournamentData = await window.awsStore.load() || { teams: [], tournaments: [] };
    const redirectLogin = window.awsStore.consumeRedirectLogin?.();
    if (redirectLogin === true) { tournamentAdmin = true; toast('Area riservata attivata.'); }
    else if (redirectLogin === false) toast('Questo account Google non è autorizzato.');
  } catch { toast('Impossibile caricare i dati del torneo.'); }
  render();
});
render();
