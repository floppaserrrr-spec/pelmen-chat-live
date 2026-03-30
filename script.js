const socket = io('https://pelmen-chat.onrender.com'); 

const chat = document.getElementById('chat'), userList = document.getElementById('user-list');
const input = document.getElementById('inp'), nickInput = document.getElementById('nickname');
const roomInput = document.getElementById('room-id'), chatTargetLabel = document.getElementById('chat-target');
const backBtn = document.getElementById('back-btn'), recordBtn = document.getElementById('record-btn');
const remoteAudio = document.getElementById('remote-audio'), callScreen = document.getElementById('call-screen');

let targetUserId = null, mediaRecorder, chunks = [];
let localStream, peerConnection;

const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] };

// --- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ОТРИСОВКИ ---
function displayMessage(data) {
    const div = document.createElement('div');
    let content = "";
    if (data.type === 'image') content = `<img src="${data.msg}" style="max-width:250px;border-radius:10px;margin-top:5px;display:block;">`;
    else if (data.type === 'video') content = `<video src="${data.msg}" controls style="max-width:250px;border-radius:10px;"></video>`;
    else if (data.type === 'audio') content = `<audio src="${data.msg}" controls style="width:100%;"></audio>`;
    else content = `<span>${data.msg}</span>`;

    div.innerHTML = `<b style="color:${data.isPrivate ? '#ffcc00' : '#ff9900'};">${data.isPrivate ? '[ЛС] ' : ''}${data.name}:</b><br>${content}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

function join() {
    const roomId = roomInput.value.trim(), name = nickInput.value.trim() || "Аноним";
    if (roomId) {
        localStorage.setItem('pelmen_room', roomId);
        localStorage.setItem('pelmen_nick', name);
        socket.emit('join room', { roomId, name });
    }
}

function logout() {
    localStorage.removeItem('pelmen_room');
    location.reload();
}

roomInput.value = localStorage.getItem('pelmen_room') || "";
nickInput.value = localStorage.getItem('pelmen_nick') || "";
if (roomInput.value) join();

// Прием истории при входе в комнату
socket.on('load history', (history) => {
    chat.innerHTML = ""; 
    history.forEach(msg => displayMessage(msg));
});

socket.on('chat message', (data) => {
    const isFromMe = (data.from === socket.id || !data.from);
    const isPrivateForMe = (data.isPrivate && (data.from === targetUserId || (data.to === targetUserId && isFromMe)));
    if (!data.isPrivate || isPrivateForMe) {
        displayMessage(data);
    }
});

// --- ОСТАЛЬНАЯ ЛОГИКА (СПИСОК, ЗВОНКИ, ГС) ---
socket.on('user list', (allUsers) => {
    userList.innerHTML = '<div class="user-item" style="background:#222; color:#ff9900; font-weight:bold;" onclick="resetChat()">🏠 ОБЩИЙ ЧАТ</div>'; 
    Object.keys(allUsers).forEach((id) => {
        if (id === socket.id) return;
        const item = document.createElement('div');
        item.className = 'user-item';
        item.innerHTML = `<span>👤 ${allUsers[id]}</span> <button class="call-btn-mini" onclick="event.stopPropagation(); startCall('${id}', '${allUsers[id]}')">📞</button>`;
        item.onclick = () => selectUser(id, allUsers[id]);
        userList.appendChild(item);
    });
});

function selectUser(id, name) {
    targetUserId = id; chatTargetLabel.innerText = name;
    chat.innerHTML = ""; document.body.classList.add('chat-open');
    backBtn.style.display = "inline-block";
}

function resetChat() {
    targetUserId = null; chatTargetLabel.innerText = "ОБЩИЙ ЧАТ";
    chat.innerHTML = ""; document.body.classList.add('chat-open');
    backBtn.style.display = "inline-block";
}

function backToList() {
    document.body.classList.remove('chat-open');
    backBtn.style.display = "none";
}

function sendFile() {
    const file = document.getElementById('file-input').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const type = file.type.includes('video') ? 'video' : 'image';
        socket.emit('chat message', { name: nickInput.value || "Аноним", type: type, msg: e.target.result, to: targetUserId });
        document.getElementById('file-input').value = '';
    };
    reader.readAsDataURL(file);
}

function send() {
    if (!input.value.trim()) return;
    socket.emit('chat message', { name: nickInput.value || "Аноним", type: 'text', msg: input.value, to: targetUserId });
    input.value = '';
}

// ГС и Звонки (всё как в v2.7)
async function startRec() {
    try {
        chunks = []; const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
            const reader = new FileReader();
            reader.onload = (e) => socket.emit('chat message', { name: nickInput.value || "Аноним", type: 'audio', msg: e.target.result, to: targetUserId });
            reader.readAsDataURL(blob); stream.getTracks().forEach(t => t.stop());
        };
        mediaRecorder.start(); recordBtn.style.color = "#ff9900";
    } catch (e) { alert("Микрофон!"); }
}
function stopRec() { if (mediaRecorder && mediaRecorder.state !== "inactive") { mediaRecorder.stop(); recordBtn.style.color = "white"; } }
recordBtn.onmousedown = startRec; recordBtn.onmouseup = stopRec;
recordBtn.ontouchstart = (e) => { e.preventDefault(); startRec(); }; recordBtn.ontouchend = (e) => { e.preventDefault(); stopRec(); };

function initPC() {
    peerConnection = new RTCPeerConnection(config);
    peerConnection.onicecandidate = e => { if (e.candidate) socket.emit('ice-candidate', { to: targetUserId, candidate: e.candidate }); };
    peerConnection.ontrack = e => { remoteAudio.srcObject = e.streams[0]; };
}
async function startCall(id, name) {
    targetUserId = id; callScreen.style.display = 'flex'; document.getElementById('caller-name').innerText = name;
    initPC(); try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
        const offer = await peerConnection.createOffer(); await peerConnection.setLocalDescription(offer);
        socket.emit('call user', { to: id, offer, fromName: nickInput.value || "Аноним" });
    } catch(e) { endCall(); }
}
socket.on('incoming call', d => { window.lastOffer = d.offer; targetUserId = d.from; callScreen.style.display = 'flex'; document.getElementById('caller-name').innerText = d.fromName; document.getElementById('answer-btn').style.display = 'inline-block'; });
async function answerCall() { initPC(); localStream = await navigator.mediaDevices.getUserMedia({ audio: true }); localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream)); await peerConnection.setRemoteDescription(new RTCSessionDescription(window.lastOffer)); const answer = await peerConnection.createAnswer(); await peerConnection.setLocalDescription(answer); socket.emit('accept call', { to: targetUserId, answer }); document.getElementById('answer-btn').style.display = 'none'; }
socket.on('call accepted', d => peerConnection.setRemoteDescription(new RTCSessionDescription(d.answer)));
socket.on('ice-candidate', d => peerConnection && peerConnection.addIceCandidate(new RTCIceCandidate(d.candidate)));
socket.on('call ended', () => location.reload());
function endCall() { socket.emit('end call', { to: targetUserId }); location.reload(); }