// Initialize socket connection
const socket = io();

// Chess piece Unicode symbols - Fixed black pawn symbol
const pieceSymbols = {
    'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
    'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟'
};

// Initial board setup (FEN-like representation)
const initialBoard = [
    ['bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR'],
    ['bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP'],
    ['wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR']
];

// Game State
let gameBoard = JSON.parse(JSON.stringify(initialBoard));
let currentTurn = 'w';
let playerColor = null;
let selectedSquare = null;
let gameHistory = [];
let isGameOver = false;

// Timer variables
let whiteTime = 5 * 60; // 5 minutes in seconds
let blackTime = 5 * 60; // 5 minutes in seconds
let timerInterval = null;
let gameStarted = false;

// DOM Elements
const boardElement = document.getElementById("chessboard");
const gameStatus = document.getElementById("gameStatus");
const playerRole = document.getElementById("playerRole");
const currentTurnElement = document.getElementById("currentTurn");
const gameStatusDetail = document.getElementById("gameStatusDetail");
const moveHistory = document.getElementById("moveHistory");
const resetGameBtn = document.getElementById("resetGame");
const whiteStatus = document.getElementById("whiteStatus");
const blackStatus = document.getElementById("blackStatus");

console.log("Chess game script loaded successfully");

// Timer functions
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updateTimerDisplay() {
    const whiteTimerElement = document.getElementById('whiteTimer');
    const blackTimerElement = document.getElementById('blackTimer');
    
    if (whiteTimerElement) {
        whiteTimerElement.textContent = formatTime(whiteTime);
        // Force white timer to be black text for visibility
        whiteTimerElement.style.color = whiteTime <= 60 ? '#ef4444' : '#1f2937';
    }
    
    if (blackTimerElement) {
        blackTimerElement.textContent = formatTime(blackTime);
        blackTimerElement.style.color = blackTime <= 60 ? '#ef4444' : '#ffffff';
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    timerInterval = setInterval(() => {
        if (currentTurn === 'w') {
            whiteTime--;
            if (whiteTime <= 0) {
                whiteTime = 0;
                endGameByTime('Black');
            }
        } else {
            blackTime--;
            if (blackTime <= 0) {
                blackTime = 0;
                endGameByTime('White');
            }
        }
        updateTimerDisplay();
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function endGameByTime(winner) {
    isGameOver = true;
    stopTimer();
    showVictoryMessage(`Time's up! ${winner} wins!`);
    gameStatus.textContent = `Time's up! ${winner} wins!`;
}

function switchTimer() {
    if (gameStarted && !isGameOver) {
        startTimer();
    }
}

// Socket Event Listeners
socket.on("connect", () => {
    console.log("Connected to server");
    gameStatus.textContent = "Connected to server";
    renderBoard();
    updateTimerDisplay();
});

socket.on("playerRole", (role) => {
    console.log("Assigned role:", role);
    playerColor = role;
    const colorName = role === 'w' ? 'White' : 'Black';
    playerRole.textContent = `You are playing as ${colorName}`;
    gameStatus.textContent = "Waiting for opponent...";
    
    if (role === 'w') {
        whiteStatus.textContent = "You";
    } else {
        blackStatus.textContent = "You";
    }
    
    renderBoard();
});

socket.on("spectatorRole", () => {
    console.log("Spectator mode");
    playerRole.textContent = "You are spectating";
    gameStatus.textContent = "Spectator mode";
    renderBoard();
});

socket.on("boardState", (boardData) => {
    console.log("Received board state:", boardData);
    if (boardData && boardData.board) {
        gameBoard = boardData.board;
        currentTurn = boardData.turn || 'w';
        renderBoard();
        updateGameInfo();
    }
});

socket.on("move", (moveData) => {
    console.log("Received move:", moveData);
    if (moveData && makeMove(moveData.from, moveData.to, false)) {
        addMoveToHistory(moveData);
        currentTurn = currentTurn === 'w' ? 'b' : 'w';
        switchTimer();
        renderBoard();
        updateGameInfo();
    }
});

socket.on("gameState", (state) => {
    console.log("Game state update:", state);
    currentTurn = state.turn || currentTurn;
    updateGameInfo();
    
    // Start the game timer when both players are connected
    if (!gameStarted && !isGameOver) {
        gameStarted = true;
        startTimer();
    }
    
    if (state.isGameOver) {
        isGameOver = true;
        stopTimer();
        if (state.isCheckmate) {
            const winner = currentTurn === 'w' ? 'Black' : 'White';
            gameStatus.textContent = `Game Over! ${winner} wins!`;
        } else {
            gameStatus.textContent = "Game Over! Draw!";
        }
    } else {
        gameStatus.textContent = `${currentTurn === 'w' ? 'White' : 'Black'} to move`;
    }
});

socket.on("invalidMove", (move) => {
    console.log("Invalid move:", move);
    gameStatus.textContent = "Invalid move!";
    setTimeout(() => updateGameInfo(), 2000);
});

socket.on("playerDisconnected", (color) => {
    console.log("Player disconnected:", color);
    gameStatus.textContent = `${color.charAt(0).toUpperCase() + color.slice(1)} player disconnected`;
    stopTimer();
    if (color === 'white') {
        whiteStatus.textContent = "Disconnected";
    } else {
        blackStatus.textContent = "Disconnected";
    }
});

socket.on("gameReset", () => {
    console.log("Game reset");
    gameBoard = JSON.parse(JSON.stringify(initialBoard));
    currentTurn = 'w';
    gameHistory = [];
    isGameOver = false;
    gameStarted = false;
    whiteTime = 5 * 60;
    blackTime = 5 * 60;
    stopTimer();
    moveHistory.innerHTML = "Game started...";
    renderBoard();
    updateGameInfo();
    updateTimerDisplay();
    gameStatus.textContent = "Game reset!";
});

// Find king position
function findKing(color) {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameBoard[row][col];
            if (piece === color + 'K') {
                return { row, col };
            }
        }
    }
    return null;
}

// Check if a position is under attack by the opponent
function isSquareUnderAttack(row, col, byColor) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = gameBoard[r][c];
            if (piece && piece[0] === byColor) {
                if (canPieceAttackSquare(r, c, row, col)) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Check if a piece can attack a specific square
function canPieceAttackSquare(fromRow, fromCol, toRow, toCol) {
    const piece = gameBoard[fromRow][fromCol];
    if (!piece) return false;
    
    const pieceType = piece[1];
    const pieceColor = piece[0];
    
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    
    switch (pieceType) {
        case 'P': // Pawn
            const direction = pieceColor === 'w' ? -1 : 1;
            // Pawns attack diagonally
            return Math.abs(fromCol - toCol) === 1 && toRow === fromRow + direction;
            
        case 'R': // Rook
            return (fromRow === toRow || fromCol === toCol) && isPathClear(fromRow, fromCol, toRow, toCol);
            
        case 'N': // Knight
            return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
            
        case 'B': // Bishop
            return rowDiff === colDiff && isPathClear(fromRow, fromCol, toRow, toCol);
            
        case 'Q': // Queen
            return ((fromRow === toRow || fromCol === toCol) || (rowDiff === colDiff)) && 
                   isPathClear(fromRow, fromCol, toRow, toCol);
            
        case 'K': // King
            return rowDiff <= 1 && colDiff <= 1;
            
        default:
            return false;
    }
}

// Check if the king is in check
function isInCheck(color) {
    const king = findKing(color);
    if (!king) return false;
    
    const opponentColor = color === 'w' ? 'b' : 'w';
    return isSquareUnderAttack(king.row, king.col, opponentColor);
}

// Get all valid moves for a piece
function getValidMoves(fromRow, fromCol) {
    const piece = gameBoard[fromRow][fromCol];
    if (!piece) return [];
    
    const validMoves = [];
    const pieceColor = piece[0];
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if (isValidMove(fromRow, fromCol, row, col)) {
                // Test if this move would leave the king in check
                const originalPiece = gameBoard[row][col];
                gameBoard[row][col] = gameBoard[fromRow][fromCol];
                gameBoard[fromRow][fromCol] = null;
                
                const stillInCheck = isInCheck(pieceColor);
                
                // Restore board
                gameBoard[fromRow][fromCol] = gameBoard[row][col];
                gameBoard[row][col] = originalPiece;
                
                if (!stillInCheck) {
                    validMoves.push({ row, col });
                }
            }
        }
    }
    
    return validMoves;
}

// Check if it's checkmate
function isCheckmate(color) {
    if (!isInCheck(color)) return false;
    
    // Check if any piece can make a valid move
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = gameBoard[row][col];
            if (piece && piece[0] === color) {
                const validMoves = getValidMoves(row, col);
                if (validMoves.length > 0) {
                    return false;
                }
            }
        }
    }
    
    return true;
}

// Basic chess move validation
function isValidMove(fromRow, fromCol, toRow, toCol) {
    const piece = gameBoard[fromRow][fromCol];
    if (!piece) return false;
    
    const pieceColor = piece[0];
    const pieceType = piece[1];
    const targetPiece = gameBoard[toRow][toCol];
    
    // Can't capture own piece
    if (targetPiece && targetPiece[0] === pieceColor) return false;
    
    // Basic movement rules
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    
    switch (pieceType) {
        case 'P': // Pawn
            const direction = pieceColor === 'w' ? -1 : 1;
            const startRow = pieceColor === 'w' ? 6 : 1;
            
            if (fromCol === toCol && !targetPiece) {
                if (toRow === fromRow + direction) return true;
                if (fromRow === startRow && toRow === fromRow + 2 * direction) return true;
            }
            if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow + direction && targetPiece) {
                return true;
            }
            return false;
            
        case 'R': // Rook
            return (fromRow === toRow || fromCol === toCol) && isPathClear(fromRow, fromCol, toRow, toCol);
            
        case 'N': // Knight
            return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
            
        case 'B': // Bishop
            return rowDiff === colDiff && isPathClear(fromRow, fromCol, toRow, toCol);
            
        case 'Q': // Queen
            return ((fromRow === toRow || fromCol === toCol) || (rowDiff === colDiff)) && 
                   isPathClear(fromRow, fromCol, toRow, toCol);
            
        case 'K': // King
            return rowDiff <= 1 && colDiff <= 1;
            
        default:
            return false;
    }
}

function isPathClear(fromRow, fromCol, toRow, toCol) {
    const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
    const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
    
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    
    while (currentRow !== toRow || currentCol !== toCol) {
        if (gameBoard[currentRow][currentCol]) return false;
        currentRow += rowStep;
        currentCol += colStep;
    }
    
    return true;
}

// Make a move on the board
function makeMove(from, to, broadcast = true) {
    if (isGameOver) return false;
    
    const fromCol = from.charCodeAt(0) - 97; // a-h to 0-7
    const fromRow = 8 - parseInt(from[1]); // 1-8 to 7-0
    const toCol = to.charCodeAt(0) - 97;
    const toRow = 8 - parseInt(to[1]);
    
    console.log(`Making move from ${from} (${fromRow},${fromCol}) to ${to} (${toRow},${toCol})`);
    
    if (fromRow < 0 || fromRow > 7 || fromCol < 0 || fromCol > 7 ||
        toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) {
        console.log("Invalid coordinates");
        return false;
    }
    
    const piece = gameBoard[fromRow][fromCol];
    if (!piece) {
        console.log("No piece at source");
        return false;
    }
    
    // Check if the move is valid and doesn't leave king in check
    const validMoves = getValidMoves(fromRow, fromCol);
    const isValidDestination = validMoves.some(move => move.row === toRow && move.col === toCol);
    
    if (!isValidDestination) {
        console.log("Invalid move or would leave king in check");
        return false;
    }
    
    // Make the move
    const capturedPiece = gameBoard[toRow][toCol];
    gameBoard[toRow][toCol] = gameBoard[fromRow][fromCol];
    gameBoard[fromRow][fromCol] = null;
    
    // Check for checkmate
    const opponentColor = currentTurn === 'w' ? 'b' : 'w';
    if (isCheckmate(opponentColor)) {
        isGameOver = true;
        stopTimer();
        const winner = currentTurn === 'w' ? 'White' : 'Black';
        showVictoryMessage(`Checkmate! ${winner} wins!`);
    } else if (isInCheck(opponentColor)) {
        gameStatus.textContent = `${opponentColor === 'w' ? 'White' : 'Black'} is in check!`;
    }
    
    if (broadcast) {
        socket.emit("move", { from, to });
    }
    
    return true;
}

// Show victory message
function showVictoryMessage(message) {
    gameStatus.textContent = message;
    gameStatusDetail.textContent = "Game Over";
    
    // Create victory popup
    const popup = document.createElement('div');
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 30px;
        border-radius: 15px;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        text-align: center;
        z-index: 1000;
        font-size: 24px;
        font-weight: bold;
        border: 3px solid #fff;
    `;
    popup.innerHTML = `
        <div style="margin-bottom: 20px; font-size: 28px;">🏆</div>
        <div>${message}</div>
        <button onclick="this.parentElement.remove()" style="
            margin-top: 20px;
            padding: 10px 20px;
            background: white;
            color: #667eea;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
        ">Close</button>
    `;
    document.body.appendChild(popup);
}

// Board Rendering
function renderBoard() {
    if (!boardElement) return;
    
    console.log("Rendering board");
    boardElement.innerHTML = '';
    
    // Flip board for black player
    const shouldFlip = playerColor === 'b';
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const displayRow = shouldFlip ? 7 - row : row;
            const displayCol = shouldFlip ? 7 - col : col;
            
            const piece = gameBoard[displayRow][displayCol];
            const squareDiv = document.createElement('div');
            
            // Square setup
            const file = String.fromCharCode(97 + displayCol); // a-h
            const rank = 8 - displayRow; // 1-8
            const squareId = file + rank;
            
            squareDiv.classList.add('square');
            squareDiv.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');
            squareDiv.setAttribute('data-square', squareId);
            
            // Highlight selected square
            if (selectedSquare === squareId) {
                squareDiv.style.backgroundColor = '#yellow';
                squareDiv.style.boxShadow = '0 0 10px rgba(255, 255, 0, 0.7)';
            }
            
            // Add piece if present
            if (piece) {
                const pieceElement = document.createElement('div');
                pieceElement.classList.add('piece');
                pieceElement.textContent = pieceSymbols[piece] || piece;
                pieceElement.setAttribute('data-piece', piece);
                pieceElement.style.fontSize = '32px';
                pieceElement.style.textAlign = 'center';
                pieceElement.style.lineHeight = '60px';
                pieceElement.style.userSelect = 'none';
                
                // Fix piece coloring - white pieces white, black pieces black
                if (piece[0] === 'b') {
                    pieceElement.style.color = '#000000';
                    pieceElement.style.textShadow = '1px 1px 2px rgba(255, 255, 255, 0.3)';
                } else {
                    pieceElement.style.color = '#ffffff';
                    pieceElement.style.textShadow = '1px 1px 2px rgba(0, 0, 0, 0.8)';
                }
                
                squareDiv.appendChild(pieceElement);
            }
            
            // Event listeners
            squareDiv.addEventListener('click', handleSquareClick);
            
            boardElement.appendChild(squareDiv);
        }
    }
    
    // Highlight valid moves if a piece is selected
    if (selectedSquare) {
        highlightValidMoves();
    }
}

// Highlight valid moves for selected piece
function highlightValidMoves() {
    if (!selectedSquare) return;
    
    const fromCol = selectedSquare.charCodeAt(0) - 97;
    const fromRow = 8 - parseInt(selectedSquare[1]);
    
    const validMoves = getValidMoves(fromRow, fromCol);
    
    validMoves.forEach(move => {
        const file = String.fromCharCode(97 + move.col);
        const rank = 8 - move.row;
        const squareId = file + rank;
        
        const square = document.querySelector(`[data-square="${squareId}"]`);
        if (square) {
            const targetPiece = gameBoard[move.row][move.col];
            if (targetPiece) {
                // Highlight capture moves in red
                square.style.backgroundColor = 'rgba(255, 0, 0, 0.6)';
                square.style.border = '3px solid #ff0000';
            } else {
                // Highlight normal moves in green
                square.style.backgroundColor = 'rgba(0, 255, 0, 0.4)';
                square.style.border = '3px solid #00ff00';
            }
        }
    });
}

// Game Logic
function handleSquareClick(event) {
    if (isGameOver) return;
    
    const square = event.currentTarget;
    const squareId = square.getAttribute('data-square');
    const piece = square.querySelector('.piece');
    
    console.log(`Clicked square: ${squareId}`, piece);
    
    if (selectedSquare) {
        if (selectedSquare === squareId) {
            // Deselect
            clearSelection();
        } else {
            // Try to make move
            if (canMakeMove()) {
                if (makeMove(selectedSquare, squareId)) {
                    currentTurn = currentTurn === 'w' ? 'b' : 'w';
                    switchTimer();
                    addMoveToHistory({ from: selectedSquare, to: squareId });
                    clearSelection();
                    renderBoard();
                    updateGameInfo();
                }
            }
            clearSelection();
        }
    } else if (piece && canSelectPiece(piece)) {
        // Select piece
        selectSquare(squareId);
    }
}

function canSelectPiece(piece) {
    if (!playerColor) return false;
    const pieceColor = piece.getAttribute('data-piece')[0].toLowerCase();
    return pieceColor === playerColor && currentTurn === playerColor;
}

function canMakeMove() {
    return playerColor && currentTurn === playerColor;
}

function selectSquare(squareId) {
    clearSelection();
    selectedSquare = squareId;
    renderBoard(); // Re-render to show selection and valid moves
}

function clearSelection() {
    selectedSquare = null;
    renderBoard(); // Re-render to clear highlights
}

// UI Update Functions
function updateGameInfo() {
    if (currentTurnElement) {
        currentTurnElement.textContent = currentTurn === 'w' ? 'White' : 'Black';
    }
    
    if (gameStatusDetail) {
        gameStatusDetail.textContent = isGameOver ? 'Game Over' : 'In Progress';
    }
    
    if (gameStatus && !isGameOver) {
        gameStatus.textContent = `${currentTurn === 'w' ? 'White' : 'Black'} to move`;
    }
    
    updateTimerDisplay();
}

function addMoveToHistory(move) {
    const moveElement = document.createElement('div');
    moveElement.textContent = `${move.from}-${move.to}`;
    if (moveHistory) {
        moveHistory.appendChild(moveElement);
        moveHistory.scrollTop = moveHistory.scrollHeight;
    }
    gameHistory.push(move);
}

// Event Listeners
if (resetGameBtn) {
    resetGameBtn.addEventListener('click', () => {
        socket.emit('resetGame');
    });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, initializing chess game");
    renderBoard();
    updateGameInfo();
    updateTimerDisplay();
});

console.log("Chess game initialized successfully");
