const API = "https://meetly-api.teomaze456.workers.dev";

function getMe() {
  const raw = localStorage.getItem("meetly_me");
  return raw ? JSON.parse(raw) : null;
}
function setMe(me) {
  localStorage.setItem("meetly_me", JSON.stringify(me));
}

async function createOrGetUser(name) {
  const res = await fetch(`${API}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });
  const data = await res.json();
  // Ton API renvoie { ok, user, existed } sur POST
  if (!data.ok) throw new Error(data.error || "API error");
  return data.user;
}

function renderLogin() {
  document.body.innerHTML = `
    <h1>Meetly V2</h1>
    <p>Choisis ton pseudo :</p>
    <input id="name" placeholder="Teoma" />
    <button id="go">Continuer</button>
    <p id="err" style="color:red;"></p>
  `;

  document.getElementById("go").onclick = async () => {
    const name = document.getElementById("name").value.trim();
    if (!name) return;

    try {
      const user = await createOrGetUser(name);
      setMe({ id: user.id, name: user.name });
      renderApp();
    } catch (e) {
      document.getElementById("err").textContent = e.message;
    }
  };
}

async function fetchEvents() {
  const res = await fetch(`${API}/api/events`);
  return await res.json();
}

async function createEvent(title, date, userId) {
  const res = await fetch(`${API}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      date,
      created_by: userId
    })
  });
  return await res.json();
}

async function renderApp() {
  const me = getMe();
  const data = await fetchEvents();
  const events = data.events || [];

  document.getElementById("app").innerHTML = `
    <h1>Meetly V2</h1>
    <p>Connecté en: <b>${me.name}</b></p>
    <button id="logout">Changer de pseudo</button>

    <hr/>

    <h2>Créer une soirée</h2>
    <input id="eventTitle" placeholder="Titre de la soirée" />
    <input id="eventDate" type="datetime-local" />
    <button id="createEvent">Créer</button>

    <hr/>

    <h2>Soirées</h2>
    <ul>
      ${events.map(e => `
        <li>
          <b>${e.title}</b><br/>
          ${new Date(e.date).toLocaleString()}
        </li>
      `).join("")}
    </ul>
  `;

  document.getElementById("logout").onclick = () => {
    localStorage.removeItem("meetly_me");
    renderLogin();
  };

  document.getElementById("createEvent").onclick = async () => {
    const title = document.getElementById("eventTitle").value;
    const date = document.getElementById("eventDate").value;

    if (!title || !date) return;

    await createEvent(title, date, me.id);
    renderApp(); // refresh
  };
}
