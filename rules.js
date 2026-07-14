let rulesData = {};
let rulesAdmin = false;
const defaultRules = window.DEFAULT_TEAM_BATTLE_RULES || '';
const $ = (selector) => document.querySelector(selector);

function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;' }[char]));
}

function inlineMarkdown(value) {
  return esc(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function markdownToHtml(markdown) {
  let html = '';
  let listOpen = false;
  const closeList = () => {
    if (listOpen) {
      html += '</ul>';
      listOpen = false;
    }
  };

  for (const line of String(markdown).replace(/\r/g, '').split('\n')) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const listItem = line.match(/^\*\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html += `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`;
    } else if (listItem) {
      if (!listOpen) {
        html += '<ul>';
        listOpen = true;
      }
      html += `<li>${inlineMarkdown(listItem[1])}</li>`;
    } else if (/^---+\s*$/.test(line)) {
      closeList();
      html += '<hr>';
    } else if (line.trim()) {
      closeList();
      html += `<p>${inlineMarkdown(line)}</p>`;
    } else {
      closeList();
    }
  }
  closeList();
  return html;
}

function currentRules() {
  return typeof rulesData.rules === 'string' && rulesData.rules.trim() ? rulesData.rules : defaultRules;
}

function render() {
  $('#rulesContent').innerHTML = markdownToHtml(currentRules());
  document.body.classList.toggle('admin', rulesAdmin);
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => element.classList.remove('show'), 2500);
}

function openRulesEditor() {
  $('#rulesInput').value = currentRules();
  $('#rulesBackdrop').classList.add('open');
  setTimeout(() => $('#rulesInput').focus(), 50);
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
      if (allowed?.redirecting) {
        toast('Reindirizzamento a Google in corso…');
        return;
      }
      if (!allowed) {
        toast('Questo account Google non è autorizzato.');
        return;
      }
    }
    rulesAdmin = true;
    $('#adminPassword').value = '';
    $('#loginBackdrop').classList.remove('open');
    render();
    toast('Benvenuto nell’area riservata.');
  } catch (error) {
    toast(window.awsStore?.loginErrorMessage?.(error) || 'Accesso non completato. Riprova.');
  }
}

$('#adminToggle').addEventListener('click', () => {
  if (rulesAdmin) {
    rulesAdmin = false;
    render();
    toast('Modalità amministratore disattivata.');
    return;
  }
  $('#loginBackdrop').classList.add('open');
  setTimeout(() => $('#adminPassword').focus(), 50);
});

$('#editRules').addEventListener('click', openRulesEditor);
$('#closeRules').addEventListener('click', () => $('#rulesBackdrop').classList.remove('open'));
$('#rulesBackdrop').addEventListener('click', (event) => { if (event.target.id === 'rulesBackdrop') $('#rulesBackdrop').classList.remove('open'); });
$('#closeLogin').addEventListener('click', () => $('#loginBackdrop').classList.remove('open'));
$('#loginBackdrop').addEventListener('click', (event) => { if (event.target.id === 'loginBackdrop') $('#loginBackdrop').classList.remove('open'); });
$('#loginSubmit').addEventListener('click', finishLogin);
$('#loginForm').addEventListener('submit', (event) => { event.preventDefault(); finishLogin(); });

$('#rulesForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const rules = $('#rulesInput').value.trim();
  try {
    if (!window.awsStore) throw new Error('storage-not-ready');
    const latest = await window.awsStore.load();
    rulesData = { ...(latest || {}), rules };
    await window.awsStore.save(rulesData);
    $('#rulesBackdrop').classList.remove('open');
    render();
    toast('Regole salvate.');
  } catch {
    toast('Impossibile salvare le regole.');
  }
});

window.addEventListener('aws-store-ready', async () => {
  try {
    rulesData = await window.awsStore.load() || {};
    const redirectLogin = window.awsStore.consumeRedirectLogin?.();
    if (redirectLogin === true) {
      rulesAdmin = true;
      toast('Benvenuto nell’area riservata.');
    } else if (redirectLogin === false) {
      toast('Questo account Google non è autorizzato.');
    } else if (redirectLogin?.error) {
      toast(window.awsStore.loginErrorMessage?.({ code: redirectLogin.error }) || 'Accesso non completato. Riprova.');
    }
  } catch {
    rulesData = {};
  }
  render();
});

render();
