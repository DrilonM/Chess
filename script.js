let canvas = document.querySelector('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let c = canvas.getContext('2d');

let tileSize = 100;

let originX = window.innerWidth / 2 - 400;
let originY = window.innerHeight / 2 - 400;

// To do:
// Add castling
// Add promotion
// Add check / mate

function resizeCanvas(board) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    originY = window.innerHeight / 2 - 400;
    originX = window.innerWidth / 2 - 400;

    board.drawBoard();
    board.drawPieces();
}

class Piece {
    static King = 1;
    static Pawn = 2;
    static Knight = 3;
    static Bishop = 4;
    static Rook = 5;
    static Queen = 6;
    static White = 8;
    static Black = 16;
}

class Board {
    constructor() {
        this.squares = Array(64).fill(0);
        this.draggedPiece = null;
        this.draggedPieceIndex = null;
        this.pieceImages = {};
        this.turn = [0b01000, 0b10000]
        this.moveNumber = 1;
        this.lastMoved = null;
        this.lastMovedIndex = null;
        this.enPassantCapture = false;
        this.enPessantTarget = false;
    }

    drawBoard() {
        for (let file = 0; file < 8; file++) {
            for (let rank = 0; rank < 8; rank++) {
                c.fillStyle = (file + rank) % 2 === 0 ? "#f6f6f6" : "#3e3e3e";
                c.strokeStyle = "black";

                let x = originX + rank * tileSize;
                let y = originY + file * tileSize;

                c.fillRect(x, y, tileSize, tileSize);
                c.strokeRect(x, y, tileSize, tileSize);
            }
        }
    }
    initializePieces(fen) {
        this.loadFromFen(fen);
        this.preloadImages();
    }
    preloadImages() {
        let pieces = ["king", "pawn", "knight", "bishop", "rook", "queen"];
        let colors = ["white", "black"];

        pieces.forEach(piece => {
            colors.forEach(color => {
                let img = new Image();
                img.src = `/pieces/${color}-${piece}.png`;
                this.pieceImages[`${color}-${piece}`] = img;
            });
        });

        setTimeout(() => this.drawPieces(), 100);
    }
    getPiece(value) {
        switch (value) {
            case Piece.King: return "king";
            case Piece.Pawn: return "pawn";
            case Piece.Knight: return "knight";
            case Piece.Bishop: return "bishop";
            case Piece.Rook: return "rook";
            case Piece.Queen: return "queen";
            default: return null;
        }
    }
    loadFromFen(fen) {
        let pieceFromSymbol = {
            "k": Piece.King,
            "p": Piece.Pawn,
            "n": Piece.Knight,
            "b": Piece.Bishop,
            "r": Piece.Rook,
            "q": Piece.Queen
        };

        let fenBoard = fen.split(' ')[0];
        let file = 0;
        let rank = 0;

        for (let symbol of fenBoard) {
            if (symbol === '/') {
                file = 0;
                rank++;
            } else if (isDigit(symbol)) {
                file += parseInt(symbol);
            } else {
                let color = isUpper(symbol) ? Piece.White : Piece.Black;
                let type = pieceFromSymbol[symbol.toLowerCase()];
                this.squares[rank * 8 + file] = type | color;
                file++;
            }
        }
    }
    drawPieces() {
        this.squares.forEach((square, index) => {
            if (square !== 0) {
                let color = (square & Piece.White) === 8 ? "white" : "black";
                let piece = this.getPiece(square & 0b111);
                let image = this.pieceImages[`${color}-${piece}`];

                let x = originX + (index % 8) * tileSize;
                let y = originY + Math.floor(index / 8) * tileSize;

                if (image) {
                    c.drawImage(image, x, y, tileSize, tileSize);
                }
            }
        });
    }
    displayMoves(currentPiece, currentIndex) {
        let validMoves = []

        for (let tile in this.squares) {
            if (this.isValid(currentPiece, currentIndex, parseInt(tile))) {
                validMoves.push(parseInt(tile))
            }
        }

        this.highlightMoves(validMoves)
    }
    highlightMoves(validMoves) {
        for (let move of validMoves) {
            let x = originX + (move % 8) * tileSize + tileSize / 2;
            let y = originY + Math.floor(move / 8) * tileSize + tileSize / 2;

            c.beginPath();
            c.arc(x, y, 15, 0, 2 * Math.PI);
            c.fillStyle = "gray";
            c.fill();
        }
    }
    handleDragAndDrop() {
        let isDragging = false;

        canvas.addEventListener("mousedown", (e) => {
            let mouseX = e.offsetX;
            let mouseY = e.offsetY;

            for (let i = 0; i < this.squares.length; i++) {
                let x = originX + (i % 8) * tileSize;
                let y = originY + Math.floor(i / 8) * tileSize;

                if (mouseX >= x && mouseX <= x + tileSize && mouseY >= y && mouseY <= y + tileSize && this.squares[i] !== 0) {
                    this.draggedPiece = this.squares[i];
                    this.draggedPieceIndex = i;

                    if ((this.draggedPiece & this.turn[this.moveNumber % 2 === 0 ? 1 : 0]) !== 0) {
                        isDragging = true;

                        this.drawBoard();
                        this.drawPieces();
                        this.displayMoves(this.draggedPiece, this.draggedPieceIndex)
                    } else {
                        this.draggedPiece = null;
                        this.draggedPieceIndex = null;
                    }
                }
            }
        });

        canvas.addEventListener("mousemove", (e) => {
            if (this.draggedPiece !== null && isDragging) {
                let mouseX = e.offsetX;
                let mouseY = e.offsetY;

                c.clearRect(0, 0, canvas.width, canvas.height)

                this.drawBoard();
                this.drawPieces();
                this.displayMoves(this.draggedPiece, this.draggedPieceIndex)

                let originalX = originX + (this.draggedPieceIndex % 8) * tileSize;
                let originalY = originY + Math.floor(this.draggedPieceIndex / 8) * tileSize;
                c.globalAlpha = 0.5;

                let color = (this.draggedPiece & (Piece.White | Piece.Black)) === Piece.White ? "white" : "black";
                let piece = this.getPiece(this.draggedPiece & 0b111);
                let image = this.pieceImages[`${color}-${piece}`];

                if (image) {
                    this.squares[this.draggedPieceIndex] = 0;
                    c.drawImage(image, originalX, originalY, tileSize, tileSize);
                }
                c.globalAlpha = 1.0;

                c.drawImage(image, mouseX - tileSize / 2, mouseY - tileSize / 2, tileSize, tileSize);
            }
        });

        canvas.addEventListener("mouseup", (e) => {
            if (this.draggedPiece !== null && isDragging) {
                let mouseX = e.offsetX;
                let mouseY = e.offsetY;

                let newFile = Math.floor((mouseY - originY) / tileSize);
                let newRank = Math.floor((mouseX - originX) / tileSize);
                let newIndex = newFile * 8 + newRank;

                if (!this.isValid(this.draggedPiece, this.draggedPieceIndex, newIndex)) {
                    if (newIndex === this.draggedPieceIndex) {
                        isDragging = this.colorTile("gray", newIndex)
                        return;
                    }
                    newIndex = this.draggedPieceIndex;
                    isDragging = this.colorTile("#f55538", newIndex)
                    return;
                }

                let piece = this.draggedPiece;
                let index = this.draggedPieceIndex;

                if (newFile < 0 || newFile > 7 || newRank < 0 || newRank > 7) {
                    newIndex = this.draggedPieceIndex;
                } else {
                    this.squares[this.draggedPieceIndex] = 0;
                }

                this.lastMoved = this.draggedPiece
                this.lastMovedIndex = newIndex

                isDragging = this.colorTile("#868686", newIndex)

                this.draggedPiece = null;
                this.draggedPieceIndex = null;

                this.moveNumber++;
                this.enPessantTarget = false;

                if ((piece & 0b111) === 2 && (index - newIndex > Math.abs(8) || newIndex - index > Math.abs(8))) {
                    this.enPessantTarget = true;
                    console.log("Target")
                }
            }
        });
    }
    canCapture(currentPiece, currentIndex, newIndex) {
        // This function checks whether the piece it's trying
        // to capture is of the opposite color

                if ((currentPiece & Piece.White) !== 0) {
                    if ((this.squares[newIndex] & Piece.Black) !== 0) {
                        return true;
                    } else if ((this.squares[newIndex] & Piece.White) !== 0) {
                        return  false;
                    }
                } else {
                    if ((this.squares[newIndex] & Piece.White) !== 0) {
                        return true;
                    } else if ((this.squares[newIndex] & Piece.Black) !== 0) {
                        return  false;
                    }
                }
                return true;
        }
    kingMove(currentIndex, newIndex) {
        const row1 = Math.floor(currentIndex / 8);
        const col1 = currentIndex % 8;
        const row2 = Math.floor(newIndex / 8);
        const col2 = newIndex % 8;

        const rowDiff = Math.abs(row1 - row2);
        const colDiff = Math.abs(col1 - col2);

        return rowDiff <= 1 && colDiff <= 1;
    }
    pawnMove(currentPiece, currentIndex, newIndex) {
        let isWhite = currentPiece === 18;
        let direction = isWhite ? 1 : -1;
        let startRow = isWhite ? 1 : 6;

        let row1 = Math.floor(currentIndex / 8);
        let col1 = currentIndex % 8;
        let row2 = Math.floor(newIndex / 8);
        let col2 = newIndex % 8;

        let distance = row2 - row1;

        if (col1 === col2) {
            if (this.squares[newIndex] !== 0) return false;
            if (distance === direction) return true;
            if (row1 === startRow && distance === 2 * direction) {
                let intermediateIndex = currentIndex + 8 * direction;
                return this.squares[intermediateIndex] === 0;
            }
        }

        if (this.enPessantTarget) {
            if (Math.abs(col2 - col1) === 1 && distance === direction) {
                let validRow = isWhite ? row1 === 4 : row1 === 3;

                if (validRow && (newIndex + 8 === this.lastMovedIndex || newIndex - 8 === this.lastMovedIndex)) {
                    this.enPassantCapture = true;
                    return true;
                }
            }
        }

        if (Math.abs(col2 - col1) === 1 && distance === direction) {
            return this.squares[newIndex] !== 0;
        }

        return false;
    }
    knightMove(currentIndex, newIndex) {
        const currentRow = Math.floor(currentIndex / 8);
        const currentCol = currentIndex % 8;

        const newRow = Math.floor(newIndex / 8);
        const newCol = newIndex % 8;

        const rowDiff = Math.abs(newRow - currentRow);
        const colDiff = Math.abs(newCol - currentCol);

        return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2)
}
    bishopMove(currentIndex, newIndex) {
        const currentRow = Math.floor(currentIndex / 8);
        const currentCol = currentIndex % 8;

        const newRow = Math.floor(newIndex / 8);
        const newCol = newIndex % 8;

        const rowDiff = Math.abs(newRow - currentRow);
        const colDiff = Math.abs(newCol - currentCol);

        if (rowDiff !== colDiff) return false;

        const rowStep = newRow > currentRow ? 1 : -1;
        const colStep = newCol > currentCol ? 1 : -1;

        let row = currentRow + rowStep;
        let col = currentCol + colStep;

        while (row !== newRow && col !== newCol) {
            const index = row * 8 + col;
            if (this.squares[index] !== 0) return false;
            row += rowStep;
            col += colStep;
        }

        return true;
    }
    rookMove(currentIndex, newIndex) {
        const currentRow = Math.floor(currentIndex / 8);
        const currentCol = currentIndex % 8;
        const newRow = Math.floor(newIndex / 8);
        const newCol = newIndex % 8;

        if (currentRow === newRow) {
            const colStep = newCol > currentCol ? 1 : -1;
            for (let col = currentCol + colStep; col !== newCol; col += colStep) {
                const index = currentRow * 8 + col;
                if (this.squares[index] !== 0) return false;
            }
            return true;
        }

        if (currentCol === newCol) {
            const rowStep = newRow > currentRow ? 1 : -1;
            for (let row = currentRow + rowStep; row !== newRow; row += rowStep) {
                const index = row * 8 + currentCol;
                if (this.squares[index] !== 0) return false;
            }
            return true;
        }

        return false;
    }
    isValid(currentPiece, currentIndex, newIndex) {
        let piece = currentPiece & 0b111;

        if (piece === 1) {
            return this.kingMove(currentIndex, newIndex) && this.canCapture(currentPiece, currentIndex, newIndex)
        }

        if (piece === 2) {
            return this.pawnMove(currentPiece, currentIndex, newIndex) && this.canCapture(currentPiece, currentIndex, newIndex)
        }

        if (piece === 3) {
            return this.knightMove(currentIndex, newIndex) && this.canCapture(currentPiece, currentIndex, newIndex)
        }

        if (piece === 4) {
            return this.bishopMove(currentIndex, newIndex) && this.canCapture(currentPiece, currentIndex, newIndex)
        }

        if (piece === 5) {
            return this.rookMove(currentIndex, newIndex) && this.canCapture(currentPiece, currentIndex, newIndex)
        }

        if (piece === 6) {
            return (this.rookMove(currentIndex, newIndex) || this.bishopMove(currentIndex, newIndex)) && this.canCapture(currentPiece, currentIndex, newIndex);
        }

        return false;
    }
    colorTile(color, newIndex) {
        this.squares[newIndex] = this.draggedPiece;

        if ((this.draggedPiece & 0b111) === 2 && this.enPassantCapture) {
            if (this.squares[newIndex - 8] === 18 || this.squares[newIndex - 8] === 10) {
                this.squares[newIndex - 8] = 0;
            } else if (this.squares[newIndex + 8] === 18 || this.squares[newIndex + 8] === 10) {
                this.squares[newIndex + 8] = 0;
            }
            this.enPassantCapture = false;
        }

        c.clearRect(0, 0, canvas.width, canvas.height)

        this.drawBoard();

        let x = originX + (newIndex % 8) * tileSize;
        let y = originY + Math.floor(newIndex / 8) * tileSize;
        c.strokeStyle = "black";
        c.fillStyle = color;
        c.fillRect(x, y, 100, 100);
        c.strokeRect(x, y, 100, 100);

        this.drawPieces();
        return false;
    }
}

function isDigit(char) {
    return !isNaN(char) && char.trim() !== '';
}
function isUpper(char) {
    return /^[A-Z]$/.test(char);
}

function startGame(fen) {
    c.clearRect(0, 0, canvas.width, canvas.height);

    let newCanvas = canvas.cloneNode(true);
    canvas.replaceWith(newCanvas);
    canvas = newCanvas;
    c = canvas.getContext('2d');

    let board = new Board();
    board.initializePieces(fen);
    board.drawBoard();
    board.drawPieces();
    board.handleDragAndDrop();

    window.onresize = () => resizeCanvas(board);
    resizeCanvas(board);
}

let fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
// let fen = 'rnbqkbnr/8/8/8/8/8/8/RNBQKBNR';

startGame(fen)
