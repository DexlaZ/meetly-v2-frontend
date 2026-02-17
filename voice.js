const API_WS_BASE = "wss://meetly-api.teomaze456.workers.dev"; // adapte si besoin
const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

let ws = null;
let me = { id: null, name: null };
let localStream = null;
let pcs = new Map(); // peerId -> RTCPeerConnection
let muted = false;

const el = (id) => document.getElementById(id);
const status = (t) => (el("status").textContent = t);

function addPeerLi(peerId) {
  const li = document.createElement("li");
  li.id = `peer-${peerId}`;
  li.textContent = peerId;
  el("peers").appendChild(li);
}
function removePeerLi(peerId) {
  const li = el(`peer-${peerId}`);
  if (li) li.remove();
}

async function getMic() {
  if (localStream) return localStream;
  localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  return localStream;
}

function createPC(peerId) {
  const pc = new RTCPeerConnection({ iceServers });

  // Send ICE candidates to peer
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      ws.send(JSON.stringify({ type: "ice", to: peerId, payload: e.candidate }));
    }
  };

  // When receiving audio, play it
  pc.ontrack = (e) => {
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.srcObject = e.streams[0];
    audio.id = `audio-${peerId}`;
    document.body.appendChild(audio);
  };

  // Add our mic track
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  pcs.set(peerId, pc);
  return pc;
}

async function callPeer(peerId) {
  const pc = pcs.get(peerId) || createPC(peerId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  ws.send(JSON.stringify({ type: "offer", to: peerId, payload: offer }));
}

async function onOffer(from, offer) {
  const pc = pcs.get(from) || createPC(from);
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  ws.send(JSON.stringify({ type: "answer", to: from, payload: answer }));
}

async function onAnswer(from, answer) {
  const pc = pcs.get(from);
  if (!pc) return;
  await pc.setRemoteDescription(answer);
}

async function onIce(from, candidate) {
  const pc = pcs.get(from);
  if (!pc) return;
  try { await pc.addIceCandidate(candidate); } catch {}
}

function cleanup() {
  for (const [peerId, pc] of pcs.entries()) {
    try { pc.close(); } catch {}
    pcs.delete(peerId);
    removePeerLi(peerId);
    const aud = document.getElementById(`audio-${peerId}`);
    if (aud) aud.remove();
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  if (ws) {
    try { ws.close(); } catch {}
    ws = null;
  }
  me = { id: null, name: null };
  muted = false;
}

function setMuted(m) {
  muted = m;
  if (localStream) {
    localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }
  el("mute").textContent = muted ? "Unmute" : "Mute";
}

el("join").onclick = async () => {
  const room = el("room").value.trim();
  const name = el("name").value.trim() || "anon";

  status("Demande micro…");
  await getMic();

  status("Connexion…");
  ws = new WebSocket(`${API_WS_BASE}/ws/${room}?name=${encodeURIComponent(name)}`);

  ws.onopen = () => {
    status(`Connecté au vocal #${room}`);
    el("join").disabled = true;
    el("leave").disabled = false;
    el("mute").disabled = false;
  };

  ws.onmessage = async (evt) => {
    const msg = JSON.parse(evt.data);

    if (msg.type === "welcome") {
      me = msg.you;
      // existing peers -> we call them (newcomer initiates)
      for (const p of msg.peers) {
        addPeerLi(p.id);
        await callPeer(p.id);
      }
      return;
    }

    if (msg.type === "peer-joined") {
      addPeerLi(msg.peer.id);
      // the newcomer will call us, so we don't need to call
      return;
    }

    if (msg.type === "peer-left") {
      const pid = msg.peer.id;
      const pc = pcs.get(pid);
      if (pc) { try { pc.close(); } catch {} pcs.delete(pid); }
      removePeerLi(pid);
      const aud = document.getElementById(`audio-${pid}`);
      if (aud) aud.remove();
      return;
    }

    if (msg.type === "offer") return onOffer(msg.from, msg.payload);
    if (msg.type === "answer") return onAnswer(msg.from, msg.payload);
    if (msg.type === "ice") return onIce(msg.from, msg.payload);
  };

  ws.onclose = () => {
    status("Déconnecté");
    el("join").disabled = false;
    el("leave").disabled = true;
    el("mute").disabled = true;
    cleanup();
  };

  ws.onerror = () => status("Erreur WebSocket");
};

el("leave").onclick = () => {
  status("Déconnexion…");
  cleanup();
  el("join").disabled = false;
  el("leave").disabled = true;
  el("mute").disabled = true;
  status("Déconnecté");
};

el("mute").onclick = () => setMuted(!muted);
