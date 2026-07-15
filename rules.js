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

$('#editRules').addEventListener('click', openRulesEditor);
const closeRulesBtn = $('#closeRules');
if (closeRulesBtn) closeRulesBtn.addEventListener('click', () => $('#rulesBackdrop').classList.remove('open'));
const rulesBackdropEl = $('#rulesBackdrop');
if (rulesBackdropEl) rulesBackdropEl.addEventListener('click', (event) => { if (event.target.id === 'rulesBackdrop') $('#rulesBackdrop').classList.remove('open'); });

$('#rulesForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const currentUser = window.awsAuth?.currentUser;
  const isAdmin = currentUser && currentUser.badges.includes('admin');
  if (!isAdmin) {
    toast('Solo gli amministratori possono salvare le regole.');
    return;
  }

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
          
          rulesAdmin = user.badges && user.badges.includes('admin');
        } else {
          if (profileLink) profileLink.classList.add('hidden');
          if (loginLink) loginLink.classList.remove('hidden');
          rulesAdmin = false;
        }
        document.body.classList.toggle('admin', rulesAdmin);
        render();
      });
    }
  } catch {
    rulesData = {};
  }
  render();
});

render();
