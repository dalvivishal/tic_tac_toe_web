# 🕹️ Tic Tac Toe (WebSocket-based)

A real-time multiplayer Tic Tac Toe game built with **Node.js** and **WebSocket**. Supports two players in a shared room, persistent turns, reconnections, and mobile responsiveness.

---

## 🚀 Features

- 🔁 Real-time two-player gameplay via WebSocket
- 🔐 Username and room-based matchmaking
- 🔁 Turn logic remembers last match result (draw or win)
- 🔄 Page refresh does not reset game state (client ID based session)
- 🎨 Dark theme with responsive UI
- 🧠 Win, draw, and turn logic
- 🎉 Simple animation/sound hooks (customizable)

---

## 📦 Installation

```bash
git clone https://github.com/yourusername/tictactoe-multiplayer.git
cd tictactoe-multiplayer
npm install
node server.js
