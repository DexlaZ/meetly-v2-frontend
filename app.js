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

async function renderApp() {
  const me = getMe();
  document.getElementById("app").innerHTML = `
    <h1>Meetly V2</h1>
    <p>Connecté en: <b>${me.name}</b> (id: ${me.id})</p>
    <button id="logout">Changer de pseudo</button>
    <hr/>
    <p>✅ Prochaine étape: afficher / créer des events + gérer dispos</p>
  `;

  document.getElementById("logout").onclick = () => {
    localStorage.removeItem("meetly_me");
    renderLogin();
  };
}

(function start() {
  const me = getMe();
  if (!me) renderLogin();
  else renderApp();
})();
