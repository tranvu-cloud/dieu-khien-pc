require("dotenv").config();
const { io } = require("socket.io-client");
const screenshot = require("screenshot-desktop");
const { mouse, keyboard, screen, Point, Button, Key } = require("@nut-tree-fork/nut-js");

const SERVER_URL = process.env.SERVER_URL;
const PASSWORD = process.env.PASSWORD || null;
const FPS = Number(process.env.FPS || 6);
const QUALITY = Number(process.env.QUALITY || 60);

if (!SERVER_URL) {
  console.error("Thiếu SERVER_URL. Hãy tạo file .env (copy từ .env.example) và điền URL server.");
  process.exit(1);
}

// Make input execution snappy and not add extra delay between key presses.
keyboard.config.autoDelayMs = 0;
mouse.config.autoDelayMs = 0;
mouse.config.mouseSpeed = 5000;

// --- Map physical browser keys (event.code) to nut-js Key enum ---
const CODE_MAP = {
  Enter: Key.Enter, Escape: Key.Escape, Backspace: Key.Backspace, Tab: Key.Tab, Space: Key.Space,
  ArrowUp: Key.Up, ArrowDown: Key.Down, ArrowLeft: Key.Left, ArrowRight: Key.Right,
  ControlLeft: Key.LeftControl, ControlRight: Key.RightControl,
  ShiftLeft: Key.LeftShift, ShiftRight: Key.RightShift,
  AltLeft: Key.LeftAlt, AltRight: Key.RightAlt,
  MetaLeft: Key.LeftSuper, MetaRight: Key.RightSuper,
  Comma: Key.Comma, Period: Key.Period, Slash: Key.Slash, Semicolon: Key.Semicolon,
  Quote: Key.Quote, BracketLeft: Key.LeftBracket, BracketRight: Key.RightBracket,
  Backslash: Key.Backslash, Minus: Key.Minus, Equal: Key.Equal,
  Delete: Key.Delete, Home: Key.Home, End: Key.End, PageUp: Key.PageUp, PageDown: Key.PageDown,
};
for (let i = 0; i < 26; i++) {
  const letter = String.fromCharCode(65 + i); // A-Z
  CODE_MAP["Key" + letter] = Key[letter];
}
for (let i = 0; i <= 9; i++) {
  CODE_MAP["Digit" + i] = Key["Num" + i];
}
for (let i = 1; i <= 12; i++) {
  CODE_MAP["F" + i] = Key["F" + i];
}

const MODIFIER_CODES = new Set([
  "ControlLeft", "ControlRight", "ShiftLeft", "ShiftRight",
  "AltLeft", "AltRight", "MetaLeft", "MetaRight",
]);

let remoteWidth = 1920;
let remoteHeight = 1080;

async function main() {
  const size = await screen.width().then((w) => screen.height().then((h) => ({ w, h })));
  remoteWidth = size.w;
  remoteHeight = size.h;

  console.log("Đang kết nối tới server:", SERVER_URL);
  const socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

  socket.on("connect", () => {
    socket.emit(
      "host-register",
      { password: PASSWORD, screenWidth: remoteWidth, screenHeight: remoteHeight },
      (res) => {
        if (!res || !res.ok) {
          console.error("Đăng ký với server thất bại.");
          return;
        }
        console.log("\n=================================");
        console.log("  MÃ KẾT NỐI CỦA BẠN:", res.code);
        console.log("  Nhập mã này trên trang web để điều khiển PC này.");
        console.log("=================================\n");
      }
    );
  });

  socket.on("connect_error", (err) => {
    console.error("Không kết nối được tới server:", err.message);
  });

  socket.on("viewer-connected", () => {
    console.log("Một trình duyệt đã kết nối và có thể điều khiển PC này.");
  });

  socket.on("viewer-disconnected", () => {
    console.log("Trình duyệt đã ngắt kết nối.");
  });

  socket.on("input", handleInput);

  startFrameLoop(socket);
}

function startFrameLoop(socket) {
  const intervalMs = Math.max(50, Math.round(1000 / FPS));
  setInterval(async () => {
    try {
      const img = await screenshot({ format: "jpg" });
      socket.emit("frame", img.toString("base64"));
    } catch (err) {
      // Screenshot can occasionally fail (e.g. display sleeping) - just skip this frame.
    }
  }, intervalMs);
}

async function handleInput(evt) {
  try {
    switch (evt.type) {
      case "move": {
        const x = Math.round(evt.x * remoteWidth);
        const y = Math.round(evt.y * remoteHeight);
        await mouse.setPosition(new Point(x, y));
        break;
      }
      case "mousedown": {
        await mouse.pressButton(evt.button === 2 ? Button.RIGHT : Button.LEFT);
        break;
      }
      case "mouseup": {
        await mouse.releaseButton(evt.button === 2 ? Button.RIGHT : Button.LEFT);
        break;
      }
      case "scroll": {
        if (evt.deltaY > 0) await mouse.scrollDown(Math.min(20, Math.abs(Math.round(evt.deltaY / 20))));
        else await mouse.scrollUp(Math.min(20, Math.abs(Math.round(evt.deltaY / 20))));
        break;
      }
      case "keydown": {
        if (MODIFIER_CODES.has(evt.code)) return; // modifiers alone do nothing visible
        const mapped = CODE_MAP[evt.code];
        if (!mapped) return;

        const combo = [];
        if (evt.ctrlKey) combo.push(Key.LeftControl);
        if (evt.altKey) combo.push(Key.LeftAlt);
        if (evt.shiftKey) combo.push(Key.LeftShift);
        if (evt.metaKey) combo.push(Key.LeftSuper);
        combo.push(mapped);

        await keyboard.pressKey(...combo);
        await keyboard.releaseKey(...combo);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("Lỗi khi xử lý input:", err.message);
  }
}

main().catch((err) => {
  console.error("Agent gặp lỗi khi khởi động:", err);
  process.exit(1);
});
