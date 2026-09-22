const loginScreen = document.getElementById("login-screen");
const remoteScreen = document.getElementById("remote-screen");
const codeInput = document.getElementById("code-input");
const passwordInput = document.getElementById("password-input");
const connectBtn = document.getElementById("connect-btn");
const disconnectBtn = document.getElementById("disconnect-btn");
const errorMsg = document.getElementById("error-msg");
const statusText = document.getElementById("status-text");
const canvas = document.getElementById("screen-canvas");
const ctx = canvas.getContext("2d");
const hiddenInput = document.getElementById("hidden-keyboard-input");

let socket = null;
let remoteW = 1920;
let remoteH = 1080;

connectBtn.addEventListener("click", connect);
codeInput.addEventListener("keydown", (e) => { if (e.key === "Enter") connect(); });

function connect() {
  const code = codeInput.value.trim().toUpperCase();
  const password = passwordInput.value;
  if (!code) {
    errorMsg.textContent = "Nhập mã kết nối.";
    return;
  }
  errorMsg.textContent = "";
  connectBtn.disabled = true;
  connectBtn.textContent = "Đang kết nối...";

  socket = io({ transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    socket.emit("viewer-join", { code, password }, (res) => {
      connectBtn.disabled = false;
      connectBtn.textContent = "Kết nối";
      if (!res.ok) {
        errorMsg.textContent = res.error || "Không kết nối được.";
        socket.disconnect();
        return;
      }
      remoteW = res.screenWidth || remoteW;
      remoteH = res.screenHeight || remoteH;
      canvas.width = remoteW;
      canvas.height = remoteH;
      showRemoteScreen();
    });
  });

  socket.on("connect_error", () => {
    connectBtn.disabled = false;
    connectBtn.textContent = "Kết nối";
    errorMsg.textContent = "Không kết nối được tới server.";
  });

  socket.on("frame", (b64) => {
    const img = new Image();
    img.onload = () => {
      if (canvas.width !== img.width || canvas.height !== img.height) {
        canvas.width = img.width;
        canvas.height = img.height;
      }
      ctx.drawImage(img, 0, 0);
    };
    img.src = "data:image/jpeg;base64," + b64;
  });

  socket.on("host-disconnected", () => {
    statusText.textContent = "PC đã ngắt kết nối.";
    setTimeout(backToLogin, 1500);
  });
}

function showRemoteScreen() {
  loginScreen.classList.add("hidden");
  remoteScreen.classList.remove("hidden");
  statusText.textContent = "Đã kết nối";
  hiddenInput.focus();
}

function backToLogin() {
  if (socket) socket.disconnect();
  remoteScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
}

disconnectBtn.addEventListener("click", backToLogin);

// ---- Mouse input ----
function relCoords(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = (evt.clientX - rect.left) / rect.width;
  const y = (evt.clientY - rect.top) / rect.height;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

canvas.addEventListener("mousemove", (evt) => {
  if (!socket) return;
  const { x, y } = relCoords(evt);
  socket.emit("input", { type: "move", x, y });
});

canvas.addEventListener("mousedown", (evt) => {
  if (!socket) return;
  hiddenInput.focus();
  const { x, y } = relCoords(evt);
  socket.emit("input", { type: "mousedown", x, y, button: evt.button });
});

canvas.addEventListener("mouseup", (evt) => {
  if (!socket) return;
  const { x, y } = relCoords(evt);
  socket.emit("input", { type: "mouseup", x, y, button: evt.button });
});

canvas.addEventListener("wheel", (evt) => {
  if (!socket) return;
  socket.emit("input", { type: "scroll", deltaY: evt.deltaY });
  evt.preventDefault();
}, { passive: false });

canvas.addEventListener("touchstart", (evt) => {
  hiddenInput.focus();
}, { passive: true });

// ---- Keyboard input ----
// A hidden text input keeps the mobile keyboard usable while still letting
// us capture raw keydown/keyup for things like Ctrl, Alt, Enter, arrows.
document.addEventListener("keydown", (evt) => {
  if (!socket || remoteScreen.classList.contains("hidden")) return;
  socket.emit("input", {
    type: "keydown",
    key: evt.key,
    code: evt.code,
    ctrlKey: evt.ctrlKey,
    shiftKey: evt.shiftKey,
    altKey: evt.altKey,
    metaKey: evt.metaKey,
  });
  // Prevent the browser from doing its own thing with e.g. Tab, Backspace
  if (["Tab", "Backspace"].includes(evt.key)) evt.preventDefault();
});

document.addEventListener("keyup", (evt) => {
  if (!socket || remoteScreen.classList.contains("hidden")) return;
  socket.emit("input", { type: "keyup", key: evt.key, code: evt.code });
});
