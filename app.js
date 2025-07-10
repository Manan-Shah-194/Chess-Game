
const express = require('express');
const socket = require('socket.io');
const http = require('http');
const { Chess } = require('chess.js');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socket(server);

const chess = new Chess();
let players = {
    white: null,
    black: null
};
let currentPlayer = 'w';

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.render("index", {title : "Chess Game"});
});

io.on("connection", function(uniquesocket){
    console.log("Player connected:", uniquesocket.id);
    
    // Assign player roles
    if(!players.white) {
        players.white = uniquesocket.id;
        uniquesocket.emit("playerRole", "w");
        console.log("Player assigned white:", uniquesocket.id);
    }
    else if(!players.black){
        players.black = uniquesocket.id;
        uniquesocket.emit("playerRole", "b");
        console.log("Player assigned black:", uniquesocket.id);
    }
    else {
        uniquesocket.emit("spectatorRole");
        console.log("Spectator joined:", uniquesocket.id);
    }

    // Send current board state to new player
    uniquesocket.emit("boardState", chess.fen());
    uniquesocket.emit("gameState", {
        turn: chess.turn(),
        inCheck: chess.inCheck(),
        isGameOver: chess.isGameOver(),
        isCheckmate: chess.isCheckmate(),
        isStalemate: chess.isStalemate()
    });

    uniquesocket.on("disconnect", function(){
        console.log("Player disconnected:", uniquesocket.id);
        if(uniquesocket.id === players.white){
            delete players.white;
            io.emit("playerDisconnected", "white");
        }
        else if (uniquesocket.id === players.black){
            delete players.black;
            io.emit("playerDisconnected", "black");
        }
    });

    uniquesocket.on("move", (move) => {
        try{
            // Check if it's the player's turn
            if(chess.turn() === "w" && uniquesocket.id !== players.white) {
                console.log("Not white player's turn");
                uniquesocket.emit("invalidMove", "Not your turn");
                return;
            }
            if(chess.turn() === "b" && uniquesocket.id !== players.black) {
                console.log("Not black player's turn");
                uniquesocket.emit("invalidMove", "Not your turn");
                return;
            }

            const result = chess.move(move);
            if(result) {
                currentPlayer = chess.turn();
                console.log("Move made:", result);
                
                // Emit move to all players
                io.emit("move", result);
                io.emit("boardState", chess.fen());
                
                // Check game state
                const gameState = {
                    turn: chess.turn(),
                    inCheck: chess.inCheck(),
                    isGameOver: chess.isGameOver(),
                    isCheckmate: chess.isCheckmate(),
                    isStalemate: chess.isStalemate(),
                    isDraw: chess.isDraw()
                };
                
                io.emit("gameState", gameState);
                
                if(chess.isGameOver()) {
                    if(chess.isCheckmate()) {
                        io.emit("gameOver", { winner: chess.turn() === 'w' ? 'black' : 'white', reason: 'checkmate' });
                    } else if(chess.isStalemate()) {
                        io.emit("gameOver", { winner: null, reason: 'stalemate' });
                    } else if(chess.isDraw()) {
                        io.emit("gameOver", { winner: null, reason: 'draw' });
                    }
                }
            }
            else {
                console.log("Invalid move:", move);
                uniquesocket.emit("invalidMove", move);
            }
        }
        catch(err){
            console.log("Move error:", err);
            uniquesocket.emit("invalidMove", move);
        }
    });

    uniquesocket.on("resetGame", () => {
        if(uniquesocket.id === players.white || uniquesocket.id === players.black) {
            chess.reset();
            currentPlayer = 'w';
            io.emit("gameReset");
            io.emit("boardState", chess.fen());
            console.log("Game reset by player:", uniquesocket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, function () {
    console.log(`Chess server started on port ${PORT}`);
});
