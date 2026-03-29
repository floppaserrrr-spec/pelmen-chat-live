const socket = io('https://pelmen-chat.onrender.com');
const chat = document.getElementById('chat');
const userList = document.getElementById('user-list');
const input = document.getElementById('inp');
const nickInput = document.getElementById('nickname');
const remoteAudio = document.getElementById('remote-audio');
const callScreen = document.getElementById('call-screen');

let localStream;
let peerConnection;
let targetUserId; // Для запоминания, кому мы звоним
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// --- КОНТАКТЫ ---
nickInput.onchange = () => {
    socket.emit('set nickname', nickInput.value || "Аноним");
};

socket.on('user list', (users) => {
    userList.innerHTML = '<div style="padding:10px; color:gray; font-size:12px;">Кликни для звонка:</div>';
    Object.keys(users).forEach((id) => {
        if (id !== socket.id) {
            const el = document.createElement('div');
            el.className = 'user-item';
            el.innerText = "👤 " + users[id];
            el.onclick = () => startCall(id, users[id]);
            userList.appendChild(el);
        }
    });
});

// --- ЧАТ ---
function send() {
    const text = input.value.trim();
    if (text) {
        socket.emit('chat message', { name: nickInput.value || "Аноним", type: 'text', msg: text });
        input.value = '';
    }
}

function sendPhoto() {
    const file = document.getElementById('file-input').files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        socket.emit('chat message', { name: nickInput.value || "Аноним", type: 'image', msg: e.target.result });
    };
    if (file) reader.readAsDataURL(file);
}

socket.on('chat message', (data) => {
    const msgDiv = document.createElement('div');
    msgDiv.style.margin = "10px 0";
    let content = data.type === 'image' ? `<br><img src="${data.msg}" style="max-width:200px; border-radius:10px; border:1px solid #ff9900;">` : data.msg;
    msgDiv.innerHTML = `<b style="color:#ff9900;">${data.name}:</b> ${content}`;
    chat.appendChild(msgDiv);
    chat.scrollTop = chat.scrollHeight;
});

// --- ЗВОНКИ (WebRTC) ---
async function startCall(id, name) {
    if(!confirm("Позвонить " + name + "?")) return;
    targetUserId = id;
    callScreen.style.display = 'flex';
    document.getElementById('caller-name').innerText = name;
    document.getElementById('call-status').innerText = "📞 Исходящий звонок...";

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    peerConnection.ontrack = e => remoteAudio.srcObject = e.streams[0];

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('call user', { to: id, offer: offer, fromName: nickInput.value || "Zivo" });
}

let incomingOfferData;
socket.on('incoming call', (data) => {
    incomingOfferData = data;
    targetUserId = data.from;
    callScreen.style.display = 'flex';
    document.getElementById('caller-name').innerText = data.fromName;
    document.getElementById('call-status').innerText = "📞 Входящий звонок...";
    document.getElementById('answer-btn').style.display = 'block';
});

async function answerCall() {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    peerConnection = new RTCPeerConnection(config);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    peerConnection.ontrack = e => remoteAudio.srcObject = e.streams[0];

    await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingOfferData.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('accept call', { to: incomingOfferData.from, answer: answer });
    
    document.getElementById('call-status').innerText = "🎙️ В эфире";
    document.getElementById('answer-btn').style.display = 'none';
}

socket.on('call accepted', async (data) => {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    document.getElementById('call-status').innerText = "🎙️ В эфире";
});

function endCall() {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (peerConnection) peerConnection.close();
    socket.emit('end call', { to: targetUserId });
    location.reload();
}

socket.on('call ended', () => {
    alert("Звонок завершен");
    location.reload();
});