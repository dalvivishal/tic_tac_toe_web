const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not Found');
    }
    res.writeHead(200);
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });
let rooms = new Map();

function createRoom(roomId, boardSize, gameMode) {
  return {
    players: [],
    gameState: Array(boardSize * boardSize).fill(null),
    currentPlayer: 0,
    startingPlayer: 0,
    boardSize,
    gameMode,
    moveHistory: [],
    lastWinner: null
  };
}

function generateWinLines(size) {
  const lines = [];
  for (let i = 0; i < size; i++) {
    lines.push([...Array(size).keys()].map(x => i * size + x)); // rows
    lines.push([...Array(size).keys()].map(x => x * size + i)); // columns
  }
  lines.push([...Array(size).keys()].map(x => x * size + x)); // main diagonal
  lines.push([...Array(size).keys()].map(x => (x + 1) * (size - 1))); // anti-diagonal
  return lines;
}

function checkWinner(board, size) {
  const lines = generateWinLines(size);
  for (let line of lines) {
    const [first, ...rest] = line;
    if (board[first] && rest.every(i => board[i] === board[first])) {
      return board[first];
    }
  }
  return board.every(cell => cell) ? 'draw' : null;
}

function broadcastGameState(roomId, winner = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  const usernames = room.players.map(p => p.username);

  room.players.forEach((p, index) => {
    const isWinner = (winner && winner !== 'draw') && ((index === 0 && winner === 'X') || (index === 1 && winner === 'O'));
    const isLoser = (winner && winner !== 'draw') && !isWinner;

    p.ws.send(JSON.stringify({
      type: 'update',
      board: room.gameState,
      yourTurn: index === room.currentPlayer,
      symbol: index === 0 ? 'X' : 'O',
      winner,
      boardSize: room.boardSize,
      usernames,
      result: winner === 'draw' ? 'draw' : isWinner ? 'win' : 'lose'
    }));
  });
}


wss.on('connection', (ws) => {
  ws.on('message', (msg) => {
    let message;
    try {
      message = JSON.parse(msg);
    } catch (e) {
      return;
    }

    if (message.type === 'join') {
      const { clientId, username, roomId, role, boardSize, gameMode } = message;

      let room = rooms.get(roomId);

      if (!room) {
        if (role !== 'create') {
          ws.send(JSON.stringify({ type: 'error', message: 'Room does not exist. Please create it first.' }));
          return;
        }
        rooms.set(roomId, createRoom(roomId, boardSize, gameMode));
        room = rooms.get(roomId);
      }

      if (room && role === 'create' && room.players.length > 0) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room already exists. Choose "Join Room" instead.' }));
        return;
      }

      let playerIndex = room.players.findIndex(p => p.clientId === clientId);
      if (playerIndex === -1 && room.players.length < 2) {
        playerIndex = room.players.length;
        room.players.push({ ws, clientId, username });
      } else if (playerIndex !== -1) {
        room.players[playerIndex].ws = ws;
        room.players[playerIndex].username = username;
      } else {
        return ws.send(JSON.stringify({ type: 'full' }));
      }

      ws.playerIndex = playerIndex;
      ws.roomId = roomId;

      ws.send(JSON.stringify({
        type: 'start',
        symbol: playerIndex === 0 ? 'X' : 'O',
        boardSize: room.boardSize,
        gameMode: room.gameMode
      }));

      if (room.players.length === 2) {
        broadcastGameState(roomId);
      }
    }

    if (message.type === 'move') {
      const { index } = message;
      const room = rooms.get(ws.roomId);
      if (!room || room.players.length < 2) return;
      if (room.players[room.currentPlayer].ws !== ws || room.gameState[index]) return;

      if (room.gameMode === 'advanced') {
        const maxFilled = room.boardSize * room.boardSize - 3;
        if (room.moveHistory.length >= maxFilled) {
          const oldest = room.moveHistory.shift();
          room.gameState[oldest] = null;
        }
      }

      room.gameState[index] = room.currentPlayer === 0 ? 'X' : 'O';
      room.moveHistory.push(index);

      const winner = checkWinner(room.gameState, room.boardSize);
      if (winner) {
        room.lastWinner = winner;
        broadcastGameState(ws.roomId, winner);
        setTimeout(() => {
          room.gameState = Array(room.boardSize * room.boardSize).fill(null);
          room.moveHistory = [];
          room.startingPlayer = winner === 'draw' ? 1 - room.currentPlayer : (winner === 'X' ? 0 : 1);
          room.currentPlayer = room.startingPlayer;
          broadcastGameState(ws.roomId);
        }, 2000);
      } else {
        room.currentPlayer = 1 - room.currentPlayer;
        broadcastGameState(ws.roomId);
      }
    }

    if (message.type === 'restart') {
      const room = rooms.get(ws.roomId);
      if (!room || room.players.length < 2) return;
      room.gameState = Array(room.boardSize * room.boardSize).fill(null);
      room.moveHistory = [];
      room.currentPlayer = room.startingPlayer;
      broadcastGameState(ws.roomId);
    }
  });

  ws.on('close', () => {
    const room = rooms.get(ws.roomId);
    if (!room) return;
    room.players = room.players.filter(p => p.ws !== ws);
    if (room.players.length === 0) rooms.delete(ws.roomId);
  });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
