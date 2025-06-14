let canvas = document.querySelector('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let c = canvas.getContext('2d');
let width = 1000;
let height = 1000;
let tileSize = 90;
let originX = width / 2 - 400;
let originY = height / 2 - 400;

function resizeCanvas(board) {
    canvas.width = width;
    canvas.height = height;

    originY = width / 2 - 400;
    originX = height / 2 - 400;

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
        this.moveNumber = 1;
        this.enPassantTarget = false;
        this.enPassantSquare = null;
        this.enPassantCount = 0;
        this.controlledSquares = this.getControlledSquares(this.moveNumber % 2 !== 0)
        this.kingChecked = false;
        this.whiteKingMoved = false;
        this.blackKingMoved = false;
        this.whiteRookMoved = { kingSide: false, queenSide: false };
        this.blackRookMoved = { kingSide: false, queenSide: false };

        this.moveHistory = []

        this.flipped = false;
        this.toggle = false;

        this.solutionIndex = null;
        this.solution = null;
        this.opponentMoves = null;
        this.maxMoves = 0;

        this.gameOver = false;
    }

    copy() {
        let newBoard = new Board();

        newBoard.squares = this.squares.slice();
        newBoard.moveNumber = this.moveNumber;
        newBoard.kingChecked = this.kingChecked;
        newBoard.enPassantTarget = this.enPassantTarget;
        newBoard.enPassantSquare = this.enPassantSquare;
        newBoard.enPassantCount = this.enPassantCount;
        newBoard.draggedPiece = this.draggedPiece;
        newBoard.draggedPieceIndex = this.draggedPieceIndex;
        newBoard.controlledSquares = new Set(this.controlledSquares);
        newBoard.pieceImages = this.pieceImages;
        newBoard.whiteKingMoved = this.whiteKingMoved;
        newBoard.blackKingMoved = this.blackKingMoved;
        newBoard.whiteRookMoved = this.whiteRookMoved;
        newBoard.blackRookMoved = this.blackRookMoved;
        newBoard.moveHistory = this.moveHistory;
        newBoard.flipped = this.flipped;

        return newBoard;
    }
    drawBoard() {
        c.clearRect(0, 0, canvas.width, canvas.height)
        for (let file = 0; file < 8; file++) {
            for (let rank = 0; rank < 8; rank++) {
                c.fillStyle = (file + rank) % 2 === 0 ? "#f6f6f6" : "steelblue";
                c.strokeStyle = "darkgray";

                let x = originX + rank * tileSize;
                let y = originY + file * tileSize;

                c.fillRect(x, y, tileSize, tileSize);
                c.strokeRect(x, y, tileSize, tileSize);

                if (rank === 0) {
                    c.fillStyle = "ivory";
                    c.font = "16px Arial";
                    c.textAlign = "right";
                    c.textBaseline = "middle";

                    if (this.flipped) {
                        c.fillText(""+ Math.abs(file + 1), x - 10, y + tileSize / 2);
                    } else {
                        c.fillText(""+(8 - file), x - 10, y + tileSize / 2);
                    }
                }

                if (file === 7) {
                    c.fillStyle = "ivory";
                    c.font = "16px Arial";
                    c.textAlign = "center";
                    c.textBaseline = "bottom";
                    let letter = null;
                    if (this.flipped) {
                        letter = String.fromCharCode(104 - rank);
                    } else {
                        letter = String.fromCharCode(97 + rank);
                    }

                    c.fillText(letter, x + tileSize / 2, y + tileSize + 24);
                }
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
                img.src = `pieces/${color}-${piece}.png`;
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
            if (this.isValid(currentPiece, currentIndex, parseInt(tile)) && this.simulateMove(currentPiece, currentIndex, parseInt(tile))) {
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
            c.arc(x, y, tileSize/8, 0, 2 * Math.PI);
            c.fillStyle = "lightblue";
            c.fill();
        }
    }
    handleDragAndDrop() {
        let isDragging = false;

        canvas.addEventListener("mousedown", (e) => {
            if (this.gameOver) return;
            let mouseX = e.offsetX;
            let mouseY = e.offsetY;

            for (let i = 0; i < this.squares.length; i++) {
                let x = originX + (i % 8) * tileSize;
                let y = originY + Math.floor(i / 8) * tileSize;

                if (mouseX >= x && mouseX <= x + tileSize && mouseY >= y && mouseY <= y + tileSize && this.squares[i] !== 0) {
                    this.draggedPiece = this.squares[i];
                    this.draggedPieceIndex = i;

                    let currentPlayer = (this.moveNumber % 2 === 0) ? Piece.White : Piece.Black;

                    if ((this.draggedPiece & currentPlayer) === 0) {
                        isDragging = true;

                        this.drawBoard();
                        this.drawPieces();

                        this.displayMoves(this.draggedPiece, this.draggedPieceIndex);
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

                //this.highlightControlledSquares(this.getControlledSquares(this.moveNumber % 2 !== 0))
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

        canvas.addEventListener("mouseup", async (e) => {
            if (this.draggedPiece !== null && isDragging) {
                let mouseX = e.offsetX;
                let mouseY = e.offsetY;

                let newRank = Math.floor((mouseX - originX) / tileSize);
                let newFile = Math.floor((mouseY - originY) / tileSize);
                let newIndex = newFile * 8 + newRank;

                let tempIndex = this.draggedPieceIndex;
                let tempPiece = this.draggedPiece;
                let tempTarget = this.squares[newIndex];

                if (newRank < 0 || newRank > 7 || newFile < 0 || newFile > 7 || this.draggedPieceIndex === newIndex) {
                    isDragging = this.colorTile("#f55538", this.draggedPieceIndex);
                    this.draggedPiece = null;
                    this.draggedPieceIndex = null;
                    return;
                }

                if (!this.isValid(this.draggedPiece, this.draggedPieceIndex, newIndex)) {
                    isDragging = this.colorTile("#f55538", this.draggedPieceIndex);
                    this.draggedPiece = null;
                    this.draggedPieceIndex = null;
                    return;
                }

                if (!this.simulateMove(this.draggedPiece, this.draggedPieceIndex, newIndex)) {
                    isDragging = this.colorTile("#f55538", this.draggedPieceIndex);
                    let king = this.findKing(this.moveNumber % 2 !== 0);
                    this.highlightTile("#f55538", king);
                    this.draggedPiece = null;
                    this.draggedPieceIndex = null;
                    return;
                }

                let captured = this.squares[newIndex] !== 0 || (this.enPassantTarget && (this.draggedPiece & 0b111) === Piece.Pawn && newIndex === this.enPassantSquare);

                let piece = this.draggedPiece;
                let index = this.draggedPieceIndex;

                let row = Math.floor(newIndex / 8);

                if (newFile < 0 || newFile > 7 || newRank < 0 || newRank > 7) {
                    newIndex = this.draggedPieceIndex;
                } else {
                    let logicalIndex = this.getLogicalIndex(index);
                    let logicalNewIndex = this.getLogicalIndex(newIndex);

                    let row1 = Math.floor(logicalIndex / 8);
                    let col1 = logicalIndex % 8;
                    let row2 = Math.floor(logicalNewIndex / 8);
                    let col2 = logicalNewIndex % 8;

                    if ((piece & 0b111) === Piece.Pawn) {
                        if (row2 === 7 || 0) {
                            this.draggedPiece = Piece.Queen;
                            this.drawPieces()
                        }
                    }

                    // Castling Logic
                    if ((piece & 0b111) === Piece.King && row1 === row2 && Math.abs(col2 - col1) === 2) {
                        if (col2 === 6) { // KingSide
                            let rookFrom = row1 * 8 + 7;
                            let rookTo = row1 * 8 + 5;
                            if (this.flipped) {
                                rookFrom = 63 - rookFrom;
                                rookTo = 63 - rookTo;
                            }

                            this.squares[rookTo] = this.squares[rookFrom];
                            this.squares[rookFrom] = 0;

                            if ((piece & Piece.White) !== 0) this.whiteRookMoved.kingSide = true;
                            else this.blackRookMoved.kingSide = true;
                        } else if (col2 === 2) { // QueenSide
                            let rookFrom = row1 * 8;
                            let rookTo = row1 * 8 + 3;
                            if (this.flipped) {
                                rookFrom = 63 - rookFrom;
                                rookTo = 63 - rookTo;
                            }

                            this.squares[rookTo] = this.squares[rookFrom];
                            this.squares[rookFrom] = 0;

                            if ((piece & Piece.White) !== 0) this.whiteRookMoved.queenSide = true;
                            else this.blackRookMoved.queenSide = true;
                        }

                        if ((piece & Piece.White) !== 0) this.whiteKingMoved = true;
                        else this.blackKingMoved = true;

                        this.squares[newIndex] = piece;
                        this.squares[index] = 0;
                    } else {
                        this.squares[index] = 0;
                        this.squares[newIndex] = piece;

                        let isWhite = (piece & Piece.White) !== 0;

                        if ((piece & 0b111) === Piece.King) {
                            if (isWhite) this.whiteKingMoved = true;
                            else this.blackKingMoved = true;
                        }
                        if ((piece & 0b111) === Piece.Rook) {
                            let startRow = isWhite ? 0 : 7;
                            let startQueenSideIndex = startRow * 8;
                            let startKingSideIndex = startRow * 8 + 7;

                            let visualStartQueenSideIndex = this.flipped ? 63 - startQueenSideIndex : startQueenSideIndex;
                            let visualStartKingSideIndex = this.flipped ? 63 - startKingSideIndex : startKingSideIndex;

                            if (index === visualStartQueenSideIndex) {
                                if (isWhite) this.whiteRookMoved.queenSide = true;
                                else this.blackRookMoved.queenSide = true;
                            }
                            if (index === visualStartKingSideIndex) {
                                if (isWhite) this.whiteRookMoved.kingSide = true;
                                else this.blackRookMoved.kingSide = true;
                            }
                        }
                    }

                    this.squares[this.draggedPieceIndex] = 0;
                    let captured = this.squares[newIndex] !== 0 || (this.enPassantTarget && (piece & 0b111) === Piece.Pawn && newIndex === this.enPassantSquare);

                    if (captured) {
                        this.enPassantTarget = false;
                        this.enPassantCount = 0;
                        this.enPassantSquare = null;
                    }
                }

                if (captured) {
                    this.enPassantTarget = false;
                    this.enPassantCount = 0;
                    this.enPassantSquare = null;
                }

                if (Math.abs(this.draggedPieceIndex - newIndex) > 8) {
                    this.enPassantSquare = newIndex;
                    this.enPassantTarget = true;
                }
                if (this.enPassantTarget) {
                    this.enPassantCount++;
                }

                let moveNotation = this.generateMoveNotation(piece, index, newIndex, captured);
                this.moveHistory.push(moveNotation);
                this.updateMoveList();

                isDragging = this.colorTile("#868686", newIndex);


                this.solutionIndex = newIndex;

                this.draggedPiece = null;
                this.draggedPieceIndex = null;

                this.moveNumber++;

                let isWhite = this.moveNumber % 2 !== 0;
                this.controlledSquares = this.getControlledSquares(isWhite);

                if (this.controlledSquares.has(this.findKing(isWhite))) {
                    this.kingChecked = true;
                    this.highlightTile("red", this.findKing(isWhite));
                } else {
                    this.kingChecked = false;
                }

                if (this.enPassantCount === 2) {
                    this.enPassantTarget = false;
                    this.enPassantSquare = null;
                    this.enPassantCount = 0;
                }

                // Promotion
                if ((piece & 0b111) === Piece.Pawn) {
                    if (row === 0 || row === 7) {
                        let colorBits = piece & ~0b111;
                        this.squares[newIndex] = colorBits | Piece.Queen;
                        this.drawBoard();
                        this.drawPieces();
                    }
                }

                if (this.solution !== null) {
                    let isCorrect = await this.checkSolution();
                    if (!isCorrect) {
                        this.draggedPiece = tempPiece;
                        this.squares[newIndex] = tempTarget;
                        this.squares[tempIndex] = tempPiece;
                        this.moveNumber--;
                        this.enPassantCount--;
                        this.moveHistory.pop();
                        isDragging = this.colorTile("#f55538", tempIndex);

                        return;
                    }
                }

                this.checkGameEnd();

                if (this.toggle) {
                    setTimeout(() => {
                        this.flip();
                    }, 250);
                }

            }
        });
    }

    flip() {
        this.flipped = !board.flipped;
        this.squares.reverse();
        this.drawBoard()
        this.drawPieces()
    }
    getLogicalIndex(index) {
        return this.flipped ? 63 - index : index;
    }
    canCapture(currentPiece, currentIndex, newIndex) {
        // This checks colors;
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
    kingMove(currentPiece, currentIndex, newIndex) {
        let controlled =  this.controlledSquares

        if (controlled.has(newIndex))
            return false;

        let row1 = Math.floor(currentIndex / 8);
        let col1 = currentIndex % 8;
        let row2 = Math.floor(newIndex / 8);
        let col2 = newIndex % 8;

        let rowDiff = Math.abs(row1 - row2);
        let colDiff = Math.abs(col1 - col2);

        if (rowDiff <= 1 && colDiff <= 1) {
            return true;
        }

        if (rowDiff === 0 && colDiff === 2) {
            let isWhite = (currentPiece & Piece.White) !== 0;

            if (isWhite) {
                if (this.whiteKingMoved) return false;
            } else {
                if (this.blackKingMoved) return false;
            }

            let rookCol = (col2 === 6) ? 7 : 0;
            let rookIndex = row1 * 8 + rookCol;
            let rookPiece = this.squares[rookIndex];

            if ((rookPiece & 0b111) !== Piece.Rook) return false;

            if (isWhite) {
                if (col2 === 6 && this.whiteRookMoved.kingSide) return false;
                if (col2 === 2 && this.whiteRookMoved.queenSide) return false;
            } else {
                if (col2 === 6 && this.blackRookMoved.kingSide) return false;
                if (col2 === 2 && this.blackRookMoved.queenSide) return false;
            }

            let step = col2 > col1 ? 1 : -1;
            for (let c = col1 + step; c !== rookCol; c += step) {
                if (this.squares[row1 * 8 + c] !== 0) return false;
            }

            return true;
        }

        return false;
    }
    pawnMove(currentPiece, currentIndex, newIndex) {
        let isWhite = this.moveNumber % 2 !== 0;

        let direction = isWhite ? -1 : 1;
        let startRow = isWhite ? 6 : 1;

        if (this.flipped) {
            direction = isWhite ? 1 : -1;
            startRow = isWhite ? 1 : 6;
        }


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
                if (this.squares[intermediateIndex] === 0 && this.squares[newIndex] === 0) {
                    return true;
                }
            }
        }

        if (this.enPassantCount > 0 && this.enPassantCount < 2) {
            if (Math.abs(col2 - col1) === 1 && distance === direction) {
                if (newIndex === this.enPassantSquare - 8 || newIndex === this.enPassantSquare + 8) {
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
        let currentRow = Math.floor(currentIndex / 8);
        let currentCol = currentIndex % 8;

        let newRow = Math.floor(newIndex / 8);
        let newCol = newIndex % 8;

        let rowDiff = Math.abs(newRow - currentRow);
        let colDiff = Math.abs(newCol - currentCol);

        return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2)
}
    bishopMove(currentIndex, newIndex) {
        let currentRow = Math.floor(currentIndex / 8);
        let currentCol = currentIndex % 8;

        let newRow = Math.floor(newIndex / 8);
        let newCol = newIndex % 8;

        let rowDiff = Math.abs(newRow - currentRow);
        let colDiff = Math.abs(newCol - currentCol);

        if (rowDiff !== colDiff) return false;

        let rowStep = newRow > currentRow ? 1 : -1;
        let colStep = newCol > currentCol ? 1 : -1;

        let row = currentRow + rowStep;
        let col = currentCol + colStep;

        while (row !== newRow && col !== newCol) {
            let index = row * 8 + col;
            if (this.squares[index] !== 0) return false;
            row += rowStep;
            col += colStep;
        }

        return true;
    }
    rookMove(currentIndex, newIndex) {
        let currentRow = Math.floor(currentIndex / 8);
        let currentCol = currentIndex % 8;
        let newRow = Math.floor(newIndex / 8);
        let newCol = newIndex % 8;

        if (currentRow === newRow) {
            let colStep = newCol > currentCol ? 1 : -1;
            for (let col = currentCol + colStep; col !== newCol; col += colStep) {
                let index = currentRow * 8 + col;
                if (this.squares[index] !== 0) return false;
            }
            return true;
        }

        if (currentCol === newCol) {
            let rowStep = newRow > currentRow ? 1 : -1;
            for (let row = currentRow + rowStep; row !== newRow; row += rowStep) {
                let index = row * 8 + currentCol;
                if (this.squares[index] !== 0) return false;
            }
            return true;
        }

        return false;
    }
    isValid(currentPiece, currentIndex, newIndex, checkingControl = false) {
        let piece = currentPiece & 0b111;

        if (piece === 1) {
            return this.kingMove(currentPiece, currentIndex, newIndex) && this.canCapture(currentPiece, currentIndex, newIndex)
        }

        if (piece === 2) {
            if (checkingControl) {
                let fromRank = Math.floor(currentIndex / 8);
                let fromFile = currentIndex % 8;
                let toRank = Math.floor(newIndex / 8);
                let toFile = newIndex % 8;

                let isWhite = (currentPiece & Piece.White) === Piece.White;

                if (isWhite && toRank === fromRank - 1 && Math.abs(toFile - fromFile) === 1) return true;
                return !isWhite && toRank === fromRank + 1 && Math.abs(toFile - fromFile) === 1;

            }
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

        if ((this.draggedPiece & 0b111) === Piece.Pawn && this.enPassantTarget) {

            let direction = (this.draggedPiece & Piece.White) ? 1 : -1;
            if (this.flipped) direction = direction * -1;
            let capturedPawnIndex = newIndex + 8 * direction;

            if (newIndex !== 0) {
                let draggedColor = this.draggedPiece & Piece.White
                let capturedColor = this.squares[capturedPawnIndex] & Piece.White

                if (draggedColor !== capturedColor) {
                    this.squares[capturedPawnIndex] = 0;
                }
            }
        }

        c.clearRect(0, 0, canvas.width, canvas.height)

        this.drawBoard();

        let x = originX + (newIndex % 8) * tileSize;
        let y = originY + Math.floor(newIndex / 8) * tileSize;
        c.strokeStyle = "darkgray";
        c.fillStyle = color;
        c.fillRect(x, y, tileSize, tileSize);
        c.strokeRect(x, y, tileSize, tileSize);

        this.drawPieces();
        return false;
    }
    highlightTile(color, index) {
        c.clearRect(0, 0, canvas.width, canvas.height)
        this.drawBoard();
        let x = originX + (index % 8) * tileSize;
        let y = originY + Math.floor(index / 8) * tileSize;
        c.strokeStyle = "darkgrey";
        c.fillStyle = color;
        c.fillRect(x, y, tileSize, tileSize)
        c.strokeRect(x, y, tileSize, tileSize);
        this.drawPieces();
    }
    getControlledSquares(isWhite) {
        let controlledSquares = new Set();

        for (let i = 0; i < this.squares.length; i++) {
            let piece = this.squares[i];
            if (piece === 0) continue;

            let isPieceWhite = (piece & Piece.White) === Piece.White;

            if (isPieceWhite !== isWhite) {
                for (let target = 0; target < this.squares.length; target++) {
                    if (this.isValid(piece, i, target, true)) {
                        controlledSquares.add(target);
                    }
                }
            }
        }
        return controlledSquares;
    }
    highlightControlledSquares(controlled) {
        for (let move of controlled) {
            let x = originX + (move % 8) * tileSize + tileSize / 2;
            let y = originY + Math.floor(move / 8) * tileSize + tileSize / 2;

            c.beginPath();
            c.arc(x, y, tileSize / 8, 0, 2 * Math.PI);
            c.fillStyle = "red";
            c.fill();
        }
    }
    findKing(isWhite) {
        for (let i = 0; i < this.squares.length; i++) {
            let piece = this.squares[i];
            if (piece === 0) continue;

            let pieceIsWhite = (piece & Piece.White) === Piece.White;
            let pieceType = piece & 0b111;

            if (pieceIsWhite === isWhite && pieceType === 1) {
                return i;
            }
        }
        return -1;
    }
    simulateMove(currentPiece, currentIndex, newIndex) {
        let copy = this.copy();

        copy.squares[newIndex] = currentPiece;
        copy.squares[currentIndex] = 0;

        copy.moveNumber++;

        let isWhite = (currentPiece & Piece.White) === Piece.White;

        copy.controlledSquares = copy.getControlledSquares(isWhite);

        let kingIndex = copy.findKing(isWhite);

        // printBoard(copy.squares)

        return !copy.controlledSquares.has(kingIndex);
    }
    availableMoves() {
        let available = [];

        let isWhite = this.moveNumber % 2 !== 0;

        for (let index = 0; index < this.squares.length; index++) {
            let piece = this.squares[index];
            if (piece === 0) continue;

            let isWhitePiece = (piece & Piece.White) === Piece.White;
            if (isWhitePiece !== isWhite) continue;

            for (let target = 0; target < this.squares.length; target++) {
                if (this.isValid(piece, index, target)) {
                    if (this.simulateMove(piece, index, target)) {
                        available.push({ from: index, to: target });
                    }
                }
            }
        }

        return available;
    }
    checkGameEnd() {
        let moves = this.availableMoves();

        let isWhite = this.moveNumber % 2 !== 0;
        let kingIndex = this.findKing(isWhite);
        let inCheck = this.controlledSquares.has(kingIndex);

        if (moves.length === 0) {
            if (inCheck) {
                document.getElementById("label").innerHTML = (isWhite ? "Checkmate! Black wins!" : "Checkmate! White wins!");
                this.gameOver = true;
            } else {
                document.getElementById("label").innerHTML = "Stalemate! It's a draw.";
                this.gameOver = true;
            }
            return true;
        }

        if (this.isInsufficientMaterial()) {
            document.getElementById("label").innerHTML ="Draw due to insufficient material.";
            this.gameOver = true;
            return true;
        }

        return false;
    }
    isInsufficientMaterial() {
        let pieces = this.squares.filter(p => p !== 0);

        if (pieces.length === 2) {
            return true;
        }

        if (pieces.length === 3) {
            return pieces.some(p => (p & 0b111) === Piece.Bishop || (p & 0b111) === Piece.Knight);
        }

        if (pieces.length === 4) {
            let bishops = this.squares
                .map((p, i) => ({ piece: p, index: i }))
                .filter(p => (p.piece & 0b111) === Piece.Bishop);

            if (bishops.length === 2) {
                let sameColorSquare = (index) => {
                    let row = Math.floor(index / 8);
                    let col = index % 8;
                    return (row + col) % 2 === 0 ? 'light' : 'dark';
                };

                return sameColorSquare(bishops[0].index) === sameColorSquare(bishops[1].index);
            }
        }

        return false;
    }
    toAlgebraic(index, flipped) {
        let file = index % 8;
        let rank = Math.floor(index / 8);

        if (flipped) {
            file = 7 - file;
        } else {
            rank = 7 - rank;
        }

        let fileChar = String.fromCharCode(97 + file);
        let rankChar = (rank + 1).toString();

        return fileChar + rankChar;
    }
    generateMoveNotation(piece, fromIndex, toIndex, capture = false) {
        let pieceType = piece & 0b111;
        let isPawn = pieceType === Piece.Pawn;
        let isKing = pieceType === Piece.King;

        let from = this.toAlgebraic(fromIndex, this.flipped);
        let to = this.toAlgebraic(toIndex, this.flipped);

        if (isKing && Math.abs(fromIndex - toIndex) === 2) {
            return toIndex % 8 === 6 ? 'O-O' : 'O-O-O';
        }

        let pieceChar = {
            [Piece.King]: 'K',
            [Piece.Queen]: 'Q',
            [Piece.Rook]: 'R',
            [Piece.Bishop]: 'B',
            [Piece.Knight]: 'N'
        }[pieceType] || '';

        let move = '';

        if (isPawn && capture) {
            let fromFile = from[0];
            move = fromFile + 'x' + to;
        } else {
            move = pieceChar + (capture ? 'x' : '') + to;
        }

        return move;
    }
    updateMoveList() {
        let moveListElement = document.getElementById('moveList');
        if (!moveListElement) return;

        let html = '<table style="width: 100%; border-collapse: collapse;">';
        for (let i = 0; i < this.moveHistory.length; i += 2) {
            let whiteMove = this.moveHistory[i] || '';
            let blackMove = this.moveHistory[i + 1] || '';
            html += `
            <tr>
                <td style="padding: 4px;">${Math.floor(i / 2) + 1}.</td>
                <td style="padding: 4px;">${whiteMove}</td>
                <td style="padding: 4px;">${blackMove}</td>
            </tr>
        `;
        }
        html += '</table>';

        moveListElement.innerHTML = html;
    }
    async checkSolution() {
        let j = 0;
        let correct = this.moveHistory.every((move, i) => {
            if (i % 2 === 0) {
                return move === this.solution[j++];
            }
            return true;
        });


        let label = document.getElementById("label")
        this.moveHistory.every((move, i) => console.log(move))

        if (correct) {
            this.highlightTile("#80ff80", this.solutionIndex);

            let isWhite = this.moveNumber % 2 !== 0;

            if (this.controlledSquares.has(this.findKing(isWhite))) {
                this.kingChecked = true;
                this.highlightTile("red", this.findKing(isWhite));
            } else {
                this.kingChecked = false;
            }

            label.innerHTML = this.moveHistory[this.moveHistory.length - 1] + " is Correct!"
            label.style.backgroundColor = "seagreen"

            if (this.moveHistory.length === this.maxMoves) {
                label.innerHTML =  "Success!"
                this.gameOver = true;
            }

            if (this.opponentMoves.length > 0) {
                let moves = this.opponentMoves.shift();

                let index = moves[0]
                let newIndex = moves[1]
                let piece = this.squares[index]

                let captured = this.squares[newIndex] !== 0 || (this.enPassantTarget && (piece & 0b111) === Piece.Pawn && newIndex === this.enPassantSquare);

                await this.makeMove(piece, index, newIndex);

                let moveNotation = this.generateMoveNotation(piece, index, newIndex, captured);
                this.moveHistory.push(moveNotation);
                this.updateMoveList();

                let isWhite = this.moveNumber % 2 !== 0;
                if (this.controlledSquares.has(this.findKing(isWhite))) {
                    this.kingChecked = true;
                    this.highlightTile("red", this.findKing(isWhite));
                } else {
                    this.kingChecked = false;
                }
                this.moveNumber++;
            }

            return true;
        } else {
            document.getElementById("label").innerHTML = "Incorrect!"
            label.style.backgroundColor = "darkred"
            return false;
        }
    }
    makeMove(piece, index, newIndex) {
        return new Promise(resolve => {
            setTimeout(() => {
                this.squares[index] = 0;
                this.squares[newIndex] = piece;
                this.highlightTile("#868686", newIndex);
                resolve();
            }, 250);
        });
    }
}
function printBoard(squares) {
    let pieceToChar = {
        [Piece.King]: 'K',
        [Piece.Queen]: 'Q',
        [Piece.Rook]: 'R',
        [Piece.Bishop]: 'B',
        [Piece.Knight]: 'N',
        [Piece.Pawn]: 'P'
    };

    for (let row = 0; row < 8; row++) {
        let line = '';
        for (let col = 0; col < 8; col++) {
            let piece = squares[row * 8 + col];
            if (piece === 0) {
                line += '. ';
            } else {
                let type = piece & 0b111;
                let isWhite = (piece & Piece.White) === Piece.White;
                let char = pieceToChar[type] || '?';
                line += isWhite ? char : char.toLowerCase();
                line += ' ';
            }
        }
        console.log(line);
    }

    console.log('\n')
}
function isDigit(char) {
    return !isNaN(char) && char.trim() !== '';
}
function isUpper(char) {
    return /^[A-Z]$/.test(char);
}


let board = new Board();

function startGame(fen) {
    c.clearRect(0, 0, canvas.width, canvas.height);

    let newCanvas = canvas.cloneNode(true);
    canvas.replaceWith(newCanvas);
    canvas = newCanvas;
    c = canvas.getContext('2d');

    board = new Board();

    board.initializePieces(fen);
    board.drawBoard();
    board.drawPieces();
    board.handleDragAndDrop();

    window.onresize = () => resizeCanvas(board);
    resizeCanvas(board);

    document.getElementById("moveList").innerHTML = ""
    document.getElementById("label").innerHTML = ""
}
function loadPuzzle(puzzle) {
    c.clearRect(0, 0, canvas.width, canvas.height);

    let newCanvas = canvas.cloneNode(true);
    canvas.replaceWith(newCanvas);
    canvas = newCanvas;
    c = canvas.getContext('2d');

    board = new Board()

    board.initializePieces(puzzle.fen);

    if (puzzle.turn === "Black") {
        flipBoard()
        board.moveNumber = 2;
    }

    board.solution = puzzle.solution;
    board.opponentMoves = puzzle.opponentMoves;
    board.maxMoves = puzzle.maxMoves;
    board.drawBoard();
    board.drawPieces();
    board.handleDragAndDrop();

    window.onresize = () => resizeCanvas(board);
    resizeCanvas(board);

    document.getElementById("moveList").innerHTML = ""
    document.getElementById("label").innerHTML = puzzle.turn + " to move."
}

let puzzles = [
    {
        id: 1,
        fen: "4r3/7p/p2p1kp1/1ppP4/2P3PP/1P2RK2/P7/8",
        turn: "Black",
        opponentMoves: [],
        maxMoves: 1,
        solution: ["Rxe3"],
    },
    {
        id: 2,
        fen: "r5k1/p4p2/2bp3Q/2p2q2/3b1r2/5N1P/PPP5/R4R1K",
        turn: "White",
        opponentMoves: [[37, 38], [29, 38]],
        maxMoves: 5,
        solution: ["Rg1", "Rxg4", "hxg4"],
    },
    {
        id: 3,
        fen: "1r2kb1r/Qb1q1pp1/1p2p3/2pn4/1P4Pp/P1N2P2/1B1P1PBP/R3R1K1",
        turn: "Black",
        opponentMoves: [[55, 54]],
        maxMoves: 3,
        solution: ["Ra8", "Qxb7"],
    },
    {
        id: 4,
        fen: "3r4/5pp1/p2kb2p/3p4/8/2R1N3/PrP2PPP/3R2K1",
        turn: "White",
        opponentMoves: [[19, 11]],
        maxMoves: 3,
        solution: ["Nc4", "Nxb2"],
    },
    {
        id: 5,
        fen: "r2qk1nr/pp3ppp/2n1b3/1Bb1P3/3pN3/5N2/PP3PPP/R1BQK2R",
        turn: "Black",
        opponentMoves: [[5, 12]],
        maxMoves: 3,
        solution: ["Qa5", "Qxb5"],
    },
    {
        id: 6,
        fen: "r3r1k1/1p3pp1/2pq3p/p2n1N2/3P4/P6n/1P1B1PP1/2QRR1K1",
        turn: "White",
        opponentMoves: [[19, 22]],
        maxMoves: 3,
        solution: ["gxh3", "Ng3"],
    },
    {
        id: 7,
        fen: "7k/1p4p1/p1n5/3pb1Bq/7P/2P2r2/PPB3Q1/R5K1",
        turn: "Black",
        opponentMoves: [[9, 17]],
        maxMoves: 3,
        solution: ["Rg3", "Bxg3"],
    },
    {
        id: 8,
        fen: "8/5pk1/1Q4p1/7p/P2P3P/6P1/1p1rqPB1/1R4K1",
        turn: "Black",
        opponentMoves: [[1, 8]],
        maxMoves: 3,
        solution: ["Qxf2", "Qxg2"],
    },
    {
        id: 9,
        fen: "5rk1/p1pp3p/1pn1p1p1/8/2PP4/2Pq4/P2B1Q2/2KR4",
        turn: "White",
        opponentMoves: [[6, 5], [5, 6]],
        maxMoves: 5,
        solution: ["Qxf8", "Bh6", "Rxd3"],
    },
    {
        id: 10,
        fen: "r5qk/7p/pp2p1n1/2p1P1r1/P2p3R/3P1Q2/1PP2RPP/6K1",
        turn: "White",
        opponentMoves: [[6, 14]],
        maxMoves: 3,
        solution: ["Qf6", "Qxg5"],
    },

];

let i = 0;
let finished = false;

function nextPuzzle() {
    if (!finished) {
        loadPuzzle(puzzles[i]);
        i++;

        if (i >= puzzles.length) {
            finished = true;
        }
    } else {
        const randomIndex = Math.floor(Math.random() * puzzles.length);
        loadPuzzle(puzzles[randomIndex]);
    }
    document.getElementById("label").style.backgroundColor = "steelblue"
}
function flipBoard() {
    board.flipped = !board.flipped;
    board.squares.reverse();
    board.drawBoard()
    board.drawPieces()
}
function toggleFlip() {
    board.toggle = !board.toggle;

    if (board.toggle) {
        document.getElementById("toggle_button").style.backgroundColor = "#3c76a6"
    } else {
        document.getElementById("toggle_button").style.backgroundColor = "steelblue"
    }
}






