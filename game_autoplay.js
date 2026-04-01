const PLAYING = 'playing';
const PAUSED = 'paused';
const GAME_OVER = 'gameOver';

const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const CELL_SIZE = 30;
const AUTO_PLAY_INTERVAL = 35;

const COLORS = {
    I: '#00f0f0',
    O: '#f0f000',
    T: '#a000f0',
    S: '#00f000',
    Z: '#f00000',
    J: '#0000f0',
    L: '#ff7000',
};

const ROTATIONS = {
    I: [
        [[0, 1], [1, 1], [2, 1], [3, 1]],
        [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
    O: [
        [[0, 0], [0, 1], [1, 0], [1, 1]],
    ],
    T: [
        [[0, 1], [1, 0], [1, 1], [2, 1]],
        [[1, 0], [1, 1], [2, 1], [1, 2]],
        [[0, 0], [1, 0], [2, 0], [1, 1]],
        [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
    S: [
        [[0, 1], [1, 0], [1, 1], [2, 0]],
        [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
    Z: [
        [[0, 0], [1, 0], [1, 1], [2, 1]],
        [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
    J: [
        [[0, 0], [0, 1], [1, 1], [2, 1]],
        [[0, 0], [1, 0], [0, 1], [0, 2]],
        [[0, 0], [1, 0], [2, 0], [2, 1]],
        [[1, 0], [1, 1], [1, 2], [0, 2]],
    ],
    L: [
        [[0, 0], [0, 1], [0, 2], [1, 2]],
        [[0, 0], [1, 0], [2, 0], [0, 1]],
        [[0, 0], [1, 0], [1, 1], [1, 2]],
        [[2, 0], [0, 1], [1, 1], [2, 1]],
    ],
};

class Piece {
    constructor(type = null) {
        const types = Object.keys(ROTATIONS);
        this.type = type || types[Math.floor(Math.random() * types.length)];
        this.rotationState = 0;
        this.x = 3;
        this.y = 0;
    }

    getShape() {
        return ROTATIONS[this.type][this.rotationState];
    }

    getCells() {
        return this.getShape().map(([dx, dy]) => [this.x + dx, this.y + dy]);
    }
}

class TetrisAutoplayGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.aiStatus = document.getElementById('aiStatus');

        this.grid = this.createEmptyGrid();
        this.currentPiece = new Piece();
        this.state = PLAYING;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropSpeed = 1000;
        this.lastAutoPlayTime = 0;
        this.gameRunning = false;

        this.setupEventListeners();
        this.updateDisplay();
        this.render();
    }

    createEmptyGrid() {
        return Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(null));
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
    }

    handleKeyPress(e) {
        if (e.key.toLowerCase() === 'p') {
            e.preventDefault();
            this.togglePause();
        }

        if (e.key.toLowerCase() === 'r') {
            e.preventDefault();
            this.reset();
        }
    }

    isValidPosition(piece, grid = this.grid) {
        return piece.getCells().every(([x, y]) => {
            if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return false;
            return grid[y][x] === null;
        });
    }

    cloneGrid(grid = this.grid) {
        return grid.map((row) => [...row]);
    }

    getRotationBounds(type, rotationState) {
        const shape = ROTATIONS[type][rotationState];
        const xs = shape.map(([x]) => x);

        return {
            minX: Math.min(...xs),
            maxX: Math.max(...xs),
        };
    }

    buildCandidatePiece(type, rotationState, x) {
        const piece = new Piece(type);
        piece.rotationState = rotationState;
        piece.x = x;
        piece.y = 0;
        return piece;
    }

    dropPieceToRest(piece, grid = this.grid) {
        if (!this.isValidPosition(piece, grid)) {
            return null;
        }

        while (true) {
            piece.y += 1;
            if (!this.isValidPosition(piece, grid)) {
                piece.y -= 1;
                return piece;
            }
        }
    }

    simulatePlacement(piece) {
        const grid = this.cloneGrid();

        piece.getCells().forEach(([x, y]) => {
            grid[y][x] = piece.type;
        });

        const { clearedLines, clearedGrid } = this.clearLinesFromGrid(grid);
        const metrics = this.evaluateGrid(clearedGrid);
        const supportScore = this.countSupportContacts(piece);

        return {
            clearedLines,
            grid: clearedGrid,
            metrics,
            supportScore,
        };
    }

    clearLinesFromGrid(grid) {
        const nextGrid = grid.filter((row) => row.some((cell) => cell === null));
        const clearedLines = GRID_HEIGHT - nextGrid.length;

        while (nextGrid.length < GRID_HEIGHT) {
            nextGrid.unshift(Array(GRID_WIDTH).fill(null));
        }

        return { clearedLines, clearedGrid: nextGrid };
    }

    evaluateGrid(grid) {
        const heights = [];
        let holes = 0;
        let coveredHoleWeight = 0;

        for (let x = 0; x < GRID_WIDTH; x++) {
            let seenBlock = false;
            let columnHeight = 0;
            let blocksAboveHoles = 0;

            for (let y = 0; y < GRID_HEIGHT; y++) {
                const cell = grid[y][x];
                if (cell !== null) {
                    if (!seenBlock) {
                        columnHeight = GRID_HEIGHT - y;
                        seenBlock = true;
                    }
                    blocksAboveHoles += 1;
                } else if (seenBlock) {
                    holes += 1;
                    coveredHoleWeight += blocksAboveHoles;
                }
            }

            heights.push(columnHeight);
        }

        let bumpiness = 0;
        for (let x = 0; x < heights.length - 1; x++) {
            bumpiness += Math.abs(heights[x] - heights[x + 1]);
        }

        const aggregateHeight = heights.reduce((sum, height) => sum + height, 0);
        const maxHeight = Math.max(...heights);

        return {
            holes,
            coveredHoleWeight,
            aggregateHeight,
            bumpiness,
            maxHeight,
        };
    }

    countSupportContacts(piece) {
        let contacts = 0;

        piece.getCells().forEach(([x, y]) => {
            if (y === GRID_HEIGHT - 1 || this.grid[y + 1][x] !== null) {
                contacts += 1;
            }
        });

        return contacts;
    }

    compareMoves(candidate, best) {
        if (!best) return -1;

        const checks = [
            best.clearedLines - candidate.clearedLines,
            candidate.metrics.holes - best.metrics.holes,
            candidate.metrics.coveredHoleWeight - best.metrics.coveredHoleWeight,
            best.supportScore - candidate.supportScore,
            candidate.metrics.aggregateHeight - best.metrics.aggregateHeight,
            candidate.metrics.bumpiness - best.metrics.bumpiness,
            candidate.metrics.maxHeight - best.metrics.maxHeight,
            best.finalY - candidate.finalY,
            candidate.rotationState - best.rotationState,
            candidate.x - best.x,
        ];

        return checks.find((value) => value !== 0) ?? 0;
    }

    findBestMove() {
        const pieceType = this.currentPiece.type;
        let bestMove = null;
        let legalMoves = 0;

        for (let rotationState = 0; rotationState < ROTATIONS[pieceType].length; rotationState++) {
            const { minX, maxX } = this.getRotationBounds(pieceType, rotationState);
            const startX = -minX;
            const endX = GRID_WIDTH - 1 - maxX;

            for (let x = startX; x <= endX; x++) {
                const candidatePiece = this.buildCandidatePiece(pieceType, rotationState, x);
                const droppedPiece = this.dropPieceToRest(candidatePiece);

                if (!droppedPiece) {
                    continue;
                }

                legalMoves += 1;
                const simulation = this.simulatePlacement(droppedPiece);
                const candidate = {
                    type: pieceType,
                    rotationState,
                    x,
                    finalY: droppedPiece.y,
                    ...simulation,
                };

                if (this.compareMoves(candidate, bestMove) < 0) {
                    bestMove = candidate;
                }
            }
        }

        if (bestMove) {
            bestMove.legalMoves = legalMoves;
        }

        return bestMove;
    }

    updateStatus(bestMove) {
        if (!bestMove) {
            this.aiStatus.textContent = 'No legal move found.';
            return;
        }

        this.aiStatus.textContent = `Piece ${bestMove.type} | moves ${bestMove.legalMoves} | clear ${bestMove.clearedLines} | holes ${bestMove.metrics.holes}`;
    }

    applyBestMove(bestMove) {
        if (!bestMove) {
            this.gameOver();
            return;
        }

        this.currentPiece.rotationState = bestMove.rotationState;
        this.currentPiece.x = bestMove.x;
        this.currentPiece.y = bestMove.finalY;
        this.placePiece();
    }

    placePiece() {
        this.currentPiece.getCells().forEach(([x, y]) => {
            this.grid[y][x] = this.currentPiece.type;
        });

        this.clearLines();
        this.currentPiece = new Piece();

        if (!this.isValidPosition(this.currentPiece)) {
            this.gameOver();
        }
    }

    clearLines() {
        let clearedLines = 0;

        for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
            if (this.grid[y].every((cell) => cell !== null)) {
                this.grid.splice(y, 1);
                this.grid.unshift(Array(GRID_WIDTH).fill(null));
                clearedLines += 1;
                y += 1;
            }
        }

        if (clearedLines > 0) {
            this.lines += clearedLines;
            this.score += clearedLines * clearedLines * 100;
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropSpeed = Math.max(100, 1000 - this.level * 50);
        }

        this.updateDisplay();
    }

    updateDisplay() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lines').textContent = this.lines;
        document.getElementById('level').textContent = this.level;
    }

    drawCell(x, y, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }

    render() {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 0.5;
        for (let x = 0; x <= GRID_WIDTH; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * CELL_SIZE, 0);
            this.ctx.lineTo(x * CELL_SIZE, this.canvas.height);
            this.ctx.stroke();
        }
        for (let y = 0; y <= GRID_HEIGHT; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * CELL_SIZE);
            this.ctx.lineTo(this.canvas.width, y * CELL_SIZE);
            this.ctx.stroke();
        }

        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (this.grid[y][x] !== null) {
                    this.drawCell(x, y, COLORS[this.grid[y][x]]);
                }
            }
        }

        if (this.state !== GAME_OVER) {
            this.currentPiece.getCells().forEach(([x, y]) => {
                if (y >= 0) {
                    this.drawCell(x, y, COLORS[this.currentPiece.type]);
                }
            });
        }

        if (this.state === PAUSED) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.ctx.fillStyle = '#00ff88';
            this.ctx.font = 'bold 40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
        }

        if (this.state === GAME_OVER) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            this.ctx.fillStyle = '#ff0000';
            this.ctx.font = 'bold 40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 30);

            this.ctx.fillStyle = '#fff';
            this.ctx.font = '20px Arial';
            this.ctx.fillText(`Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 30);
        }
    }

    update() {
        if (this.state !== PLAYING) {
            this.render();
            return;
        }

        const now = Date.now();
        if (now - this.lastAutoPlayTime >= AUTO_PLAY_INTERVAL) {
            const bestMove = this.findBestMove();
            this.updateStatus(bestMove);
            this.applyBestMove(bestMove);
            this.lastAutoPlayTime = now;
        }

        this.render();
    }

    start() {
        if (!this.gameRunning) {
            this.gameRunning = true;
            this.state = PLAYING;
            this.aiStatus.textContent = 'Autoplay running.';
            this.lastAutoPlayTime = 0;
            this.gameLoop();
            return;
        }

        if (this.state === PAUSED) {
            this.state = PLAYING;
            this.aiStatus.textContent = 'Autoplay running.';
            this.lastAutoPlayTime = 0;
        }
    }

    togglePause() {
        if (!this.gameRunning) return;

        if (this.state === PLAYING) {
            this.state = PAUSED;
            this.aiStatus.textContent = 'Autoplay paused.';
        } else if (this.state === PAUSED) {
            this.state = PLAYING;
            this.aiStatus.textContent = 'Autoplay running.';
            this.lastAutoPlayTime = 0;
        }

        this.render();
    }

    gameOver() {
        this.state = GAME_OVER;
        this.gameRunning = false;
        this.aiStatus.textContent = 'No more legal placements. Game over.';
        this.render();
    }

    reset() {
        this.grid = this.createEmptyGrid();
        this.currentPiece = new Piece();
        this.state = PLAYING;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropSpeed = 1000;
        this.lastAutoPlayTime = 0;
        this.gameRunning = false;
        this.aiStatus.textContent = 'Waiting to start.';
        this.updateDisplay();
        this.render();
    }

    gameLoop() {
        if (this.gameRunning) {
            this.update();
            requestAnimationFrame(() => this.gameLoop());
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new TetrisAutoplayGame();
});
