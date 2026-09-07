// Dispose Clone - Temp Mail API Client
// Uses mail.tm API as backend. Provides /api/@getmail and /api/@checkinbox endpoints.

const MAIL_API = 'https://api.mail.tm';
const MAIL_DOMAIN = 'uberip.com';

const FIRST_NAMES = [
  'James','Mary','Robert','Patricia','John','Jennifer','Michael','Linda','David','Elizabeth',
  'William','Barbara','Richard','Susan','Joseph','Jessica','Thomas','Sarah','Charles','Karen',
  'Christopher','Lisa','Daniel','Nancy','Matthew','Betty','Anthony','Margaret','Mark','Sandra',
  'Donald','Ashley','Steven','Kimberly','Paul','Emily','Andrew','Donna','Joshua','Michelle',
  'Kenneth','Carol','Kevin','Amanda','Brian','Dorothy','George','Melissa','Timothy','Deborah',
  'Ronald','Stephanie','Edward','Rebecca','Jason','Sharon','Jeffrey','Laura','Ryan','Cynthia',
  'Jacob','Amy','Gary','Kathleen','Nicholas','Angela','Eric','Shirley','Jonathan','Anna',
  'Stephen','Brenda','Larry','Pamela','Justin','Emma','Scott','Nicole','Brandon','Helen',
  'Benjamin','Samantha','Samuel','Katherine','Gregory','Christine','Alexander','Debra',
  'Frank','Rachel','Patrick','Carolyn','Raymond','Janet','Jack','Catherine','Dennis','Maria',
  'Jerry','Heather','Tyler','Diane','Aaron','Ruth','Jose','Julie','Adam','Olivia',
  'Nathan','Joyce','Henry','Victoria','Douglas','Kelly','Zachary','Christina','Peter','Joan',
  'Kyle','Evelyn','Walter','Lauren','Ethan','Judith','Jeremy','Megan','Harold','Cheryl',
  'Keith','Andrea','Christian','Hannah','Roger','Jacqueline','Noah','Martha','Gerald','Gloria',
  'Carl','Teresa','Terry','Ann','Sean','Sara','Austin','Madison','Arthur','Frances',
  'Lawrence','Kathryn','Jesse','Janice','Dylan','Jean','Bryan','Abigail','Joe','Alice',
  'Jordan','Julie','Billy','Julia','Bruce','Heather','Albert','Teresa','Willie','Doris',
  'Gabriel','Marie','Logan','Dawn','Alan','Rose','Juan','Mildred','Wayne','Grace',
  'Roy','Judy','Ralph','Theresa','Randy','Beverly','Eugene','Denise','Vincent','Marilyn',
  'Russell','Amber','Louis','Danielle','Philip','Diana','Bobby','Brittany','Johnny','Natalie',
  'Bradley','Sylvia','Earl','Valerie','Jimmy','Patti','Leonard','Hannah','Danny','Marlene'
];

const LAST_NAMES = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez',
  'Hernandez','Lopez','Gonzalez','Wilson','Anderson','Thomas','Taylor','Moore','Jackson','Martin',
  'Lee','Perez','Thompson','White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson',
  'Walker','Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
  'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell','Carter','Roberts',
  'Gomez','Phillips','Evans','Turner','Diaz','Parker','Cruz','Edwards','Collins','Reyes',
  'Stewart','Morris','Morales','Murphy','Cook','Rogers','Gutierrez','Ortiz','Morgan','Cooper',
  'Peterson','Bailey','Reed','Kelly','Howard','Ramos','Kim','Cox','Ward','Richardson',
  'Watson','Brooks','Chavez','Wood','James','Bennett','Gray','Mendoza','Ruiz','Hughes',
  'Price','Alvarez','Castillo','Sanders','Patel','Myers','Long','Ross','Foster','Jimenez',
  'Powell','Jenkins','Perry','Russell','Sullivan','Bell','Coleman','Butler','Henderson','Barnes',
  'Gonzales','Fisher','Vasquez','Simmons','Romero','Jordan','Patterson','Alexander','Hamilton','Graham',
  'Reynolds','Griffin','Wallace','Moreno','West','Cole','Hayes','Bryant','Herrera','Gibson',
  'Ellis','Tran','Medina','Aguilar','Stevens','Murray','Ford','Castro','Marshall','Owens',
  'Harrison','Fernandez','McDonald','Woods','Washington','Kennedy','Wells','Vargas','Henry','Chen',
  'Freeman','Webb','Tucker','Guzman','Burns','Crawford','Olson','Simpson','Porter','Hunter',
  'Gordon','Mendez','Silva','Shaw','Snyder','Mason','Dixon','Munoz','Hunt','Hicks',
  'Holmes','Palmer','Wagner','Black','Robertson','Boyd','Rose','Stone','Salazar','Fox',
  'Warren','Mills','Meyer','Rice','Schmidt','Garza','Daniels','Ferguson','Nichols','Stephens'
];

const USERNAME_PATTERNS = [
  (f, l) => `${f}.${l}`,
  (f, l) => `${f}${l}`,
  (f, l) => `${f}.${l}${rand(1, 99)}`,
  (f, l) => `${f}${l}${rand(1, 99)}`,
  (f, l) => `${f}.${l}.${rand(1980, 2005)}`,
  (f, l) => `${f}${l}${rand(1980, 2005)}`,
  (f, l) => `${f}.${l}${rand(1980, 2005)}`,
  (f, l) => `${f}_${l}`,
  (f, l) => `${f}${l}_${rand(1, 999)}`,
  (f, l) => `${f}.${l}.${rand(1, 999)}`,
  (f, l) => `${f}${l}${rand(100, 999)}`,
  (f, l) => `${f}.${l}${rand(100, 999)}`,
  (f, l) => `${f}${l}${rand(10, 99)}${rand(10, 99)}`,
  (f, l) => `${f}.${l}${rand(10, 99)}${rand(10, 99)}`,
  (f, l) => `${f}${l}${rand(0, 9)}${rand(0, 9)}${rand(0, 9)}`,
  (f, l) => `${f}.${l}${rand(0, 9)}${rand(0, 9)}${rand(0, 9)}`,
  (f, l) => `${f}${l}${rand(1980, 2005)}${rand(1, 99)}`,
  (f, l) => `${f}.${l}${rand(1980, 2005)}${rand(1, 99)}`,
  (f, l) => `${f}${l}${rand(1, 9)}${rand(1, 9)}${rand(1, 9)}${rand(1, 9)}`,
  (f, l) => `${f}.${l}${rand(1, 9)}${rand(1, 9)}${rand(1, 9)}${rand(1, 9)}`
];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateUsername() {
  const f = pick(FIRST_NAMES).toLowerCase();
  const l = pick(LAST_NAMES).toLowerCase();
  const pattern = pick(USERNAME_PATTERNS);
  return pattern(f, l);
}

function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let pwd = '';
  for (let i = 0; i < 16; i++) pwd += chars[rand(0, chars.length - 1)];
  return pwd;
}

// ============================================================
// API Endpoints
// ============================================================

// POST /api/@getmail
// Creates a new temporary email account with a realistic Gmail-style address.
// Returns: { address, password, id }
async function apiGetMail() {
  const address = `${generateUsername()}@${MAIL_DOMAIN}`;
  const password = generatePassword();

  const res = await fetch(`${MAIL_API}/accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.detail && err.detail.includes('already used')) {
      return apiGetMail();
    }
    throw new Error('Failed to create mailbox: ' + (err.detail || res.status));
  }

  const account = await res.json();
  return {
    address: account.address,
    password,
    id: account.id
  };
}

// POST /api/@checkinbox
// Checks the inbox for messages. Requires { address, password } in body.
// Returns: { messages: [...] }
async function apiCheckInbox(address, password) {
  const tokenRes = await fetch(`${MAIL_API}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password })
  });

  if (!tokenRes.ok) {
    throw new Error('Authentication failed');
  }

  const tokenData = await tokenRes.json();
  const token = tokenData.token;

  const msgRes = await fetch(`${MAIL_API}/messages`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!msgRes.ok) {
    throw new Error('Failed to fetch messages');
  }

  const data = await msgRes.json();
  const messages = (data['hydra:member'] || []).map(m => ({
    id: m.id,
    from: m.from && m.from.address ? m.from.address : (m.from || 'unknown'),
    subject: m.subject || '(no subject)',
    intro: m.intro || '',
    seen: m.seen || false,
    createdAt: m.createdAt || ''
  }));

  return { messages };
}

// POST /api/@getmail (read message)
// Fetches full message content. Requires { address, password, id } in body.
async function apiGetMessage(address, password, messageId) {
  const tokenRes = await fetch(`${MAIL_API}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, password })
  });

  if (!tokenRes.ok) throw new Error('Authentication failed');
  const tokenData = await tokenRes.json();

  const res = await fetch(`${MAIL_API}/messages/${messageId}`, {
    headers: { 'Authorization': `Bearer ${tokenData.token}` }
  });

  if (!res.ok) throw new Error('Failed to fetch message');
  return await res.json();
}

// ============================================================
// Frontend State
// ============================================================

let currentMail = null;
let currentMessages = [];
let refreshTimer = null;

// ============================================================
// UI Functions
// ============================================================

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

async function createNewMail() {
  const btn = document.getElementById('createBtn');
  btn.disabled = true;
  btn.textContent = 'Creating...';

  try {
    currentMail = await apiGetMail();
    document.getElementById('emailAddr').textContent = currentMail.address;
    localStorage.setItem('dispose_mail', JSON.stringify(currentMail));
    showToast('New mailbox created: ' + currentMail.address);
    await refreshInbox();
    startAutoRefresh();
  } catch (e) {
    showToast('Error: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create';
  }
}

async function copyEmail() {
  if (!currentMail) return;
  try {
    await navigator.clipboard.writeText(currentMail.address);
    showToast('Copied to clipboard!');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = currentMail.address;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied to clipboard!');
  }
}

async function refreshInbox() {
  if (!currentMail) return;

  const icon = document.getElementById('refreshIcon');
  icon.textContent = '⏳';

  try {
    const result = await apiCheckInbox(currentMail.address, currentMail.password);
    currentMessages = result.messages;
    renderInbox();
    showToast(`Inbox refreshed: ${currentMessages.length} message(s)`);
  } catch (e) {
    renderError(e.message);
  } finally {
    icon.textContent = '🔄';
  }
}

function clearInbox() {
  currentMessages = [];
  renderInbox();
  showToast('Inbox cleared');
}

function renderInbox() {
  const container = document.getElementById('inboxContent');

  if (currentMessages.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <p>Your inbox is empty</p>
        <p style="margin-top: 6px; font-size: 12px;">Awaiting for incoming emails</p>
      </div>`;
    return;
  }

  let rows = '';
  for (const msg of currentMessages) {
    const time = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : '';
    rows += `
      <tr>
        <td class="sender">${escapeHtml(msg.from)}</td>
        <td class="subject">${escapeHtml(msg.subject)}</td>
        <td style="color:#a0aec0; font-size:12px; white-space:nowrap;">${time}</td>
        <td><button class="view-btn" onclick="viewMessage('${msg.id}')">View</button></td>
      </tr>`;
  }

  container.innerHTML = `
    <table class="inbox-table">
      <thead>
        <tr>
          <th>Sender</th>
          <th>Subject</th>
          <th>Date</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderError(msg) {
  const container = document.getElementById('inboxContent');
  container.innerHTML = `
    <div class="empty-state">
      <div class="icon">⚠️</div>
      <p>${escapeHtml(msg)}</p>
    </div>`;
}

async function viewMessage(id) {
  if (!currentMail) return;

  const overlay = document.getElementById('mailModal');
  const body = document.getElementById('modalBody');
  const title = document.getElementById('modalTitle');
  body.innerHTML = '<div class="empty-state"><div class="loading"></div><p>Loading...</p></div>';
  overlay.classList.add('open');

  try {
    const msg = await apiGetMessage(currentMail.address, currentMail.password, id);
    title.textContent = msg.subject || '(no subject)';

    let from = '';
    if (msg.from) {
      from = typeof msg.from === 'string' ? msg.from : (msg.from.address || JSON.stringify(msg.from));
    }

    let content = msg.text || msg.html || msg.intro || '(no content)';
    if (msg.html && !msg.text) {
      content = msg.html;
    }

    body.innerHTML = `
      <div class="meta">
        <div><span class="label">From:</span>${escapeHtml(from)}</div>
        <div><span class="label">To:</span>${escapeHtml(currentMail.address)}</div>
        <div><span class="label">Date:</span>${msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}</div>
      </div>
      <div class="content">${escapeHtml(content)}</div>`;
  } catch (e) {
    body.innerHTML = `<div class="empty-state"><p>Error: ${escapeHtml(e.message)}</p></div>`;
  }
}

function closeModal() {
  document.getElementById('mailModal').classList.remove('open');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (currentMail) refreshInbox();
  }, 30000);
}

// ============================================================
// Init
// ============================================================

(async function init() {
  const saved = localStorage.getItem('dispose_mail');
  if (saved) {
    try {
      currentMail = JSON.parse(saved);
      document.getElementById('emailAddr').textContent = currentMail.address;
      await refreshInbox();
      startAutoRefresh();
      return;
    } catch (e) {
      localStorage.removeItem('dispose_mail');
    }
  }
  await createNewMail();
})();

document.getElementById('mailModal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});