// Relay server: sits between the PC agent and the web viewer.
// It never sees your screen content persist anywhere - it just forwards
// frames from the agent to the viewer, and input events from the viewer
// to the agent, in real time.

const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 5e6, // allow ~5MB per frame message
});

// Serve the web viewer (the /web folder) as static files at "/"
app.use(express.static(path.join(__dirname, "..", "web")));

// roomCode -> { hostSocketId, viewerSocketIds: Set, password }
const rooms = new Map();

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

io.on("connection", (socket) => {
  // --- Agent (host) registers a new session ---
  socket.on("host-register", (payload, ack) => {
    let code = randomCode();
    while (rooms.has(code)) code = randomCode();

    rooms.set(code, {
      hostSocketId: socket.id,
      viewerSocketIds: new Set(),
      password: (payload && payload.password) || null,
      screenWidth: payload && payload.screenWidth,
      screenHeight: payload && payload.screenHeight,
    });

    socket.data.role = "host";
    socket.data.roomCode = code;
    socket.join(code);

    if (ack) ack({ ok: true, code });
    console.log(`[host] registered room ${code}`);
  });

  // --- Viewer (browser) joins an existing session ---
  socket.on("viewer-join", (payload, ack) => {
    const code = (payload && payload.code || "").toUpperCase().trim();
    const room = rooms.get(code);

    if (!room) {
      if (ack) ack({ ok: false, error: "Mã không tồn tại hoặc PC chưa bật agent." });
      return;
    }
    if (room.password && room.password !== (payload && payload.password)) {
      if (ack) ack({ ok: false, error: "Sai mật khẩu." });
      return;
    }

    socket.data.role = "viewer";
    socket.data.roomCode = code;
    socket.join(code);
    room.viewerSocketIds.add(socket.id);

    if (ack) {
      ack({ ok: true, screenWidth: room.screenWidth, screenHeight: room.screenHeight });
    }
    io.to(room.hostSocketId).emit("viewer-connected", { viewerId: socket.id });
    console.log(`[viewer] joined room ${code}`);
  });

  // --- Agent streams a screen frame ---
  socket.on("frame", (data) => {
    const code = socket.data.roomCode;
    if (!code || socket.data.role !== "host") return;
    // Forward straight to all viewers in this room, don't buffer/store it.
    socket.to(code).emit("frame", data);
  });

  // --- Viewer sends an input event (mouse/keyboard) ---
  socket.on("input", (data) => {
    const code = socket.data.roomCode;
    if (!code || socket.data.role !== "viewer") return;
    const room = rooms.get(code);
    if (!room) return;
    io.to(room.hostSocketId).emit("input", data);
  });

  socket.on("disconnect", () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    if (!room) return;

    if (socket.data.role === "host") {
      // Host left: tell viewers and tear down the room.
      io.to(code).emit("host-disconnected");
      rooms.delete(code);
      console.log(`[host] room ${code} closed`);
    } else {
      room.viewerSocketIds.delete(socket.id);
      io.to(room.hostSocketId).emit("viewer-disconnected", { viewerId: socket.id });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Relay server listening on port ${PORT}`);
});
