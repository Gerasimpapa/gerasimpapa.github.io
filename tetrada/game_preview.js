// Tetris Game with configurable next-piece previews

const PLAYING = 'playing';
const PAUSED = 'paused';
const GAME_OVER = 'gameOver';

const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const CELL_SIZE = 30;
const MAX_PREVIEW_PIECES = 10;
const PREVIEW_CANVAS_WIDTH = 100;
const PREVIEW_CANVAS_HEIGHT = 60;
const PREVIEW_CELL_SIZE = 18;

const COLORS = {
    'I': '#00f0f0',
    'O': '#f0f000',
    'T': '#a000f0',
    'S': '#00f000',
    'Z': '#f00000',
    'J': '#0000f0',
    'L': '#ff7000',
};

const ROTATIONS = {
    'I': [
        [[0, 1], [1, 1], [2, 1], [3, 1]],
        [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
    'O': [
        [[0, 0], [0, 1], [1, 0], [1, 1]],
    ],
    'T': [
        [[0, 1], [1, 0], [1, 1], [2, 1]],
        [[1, 0], [1, 1], [2, 1], [1, 2]],
        [[0, 0], [1, 0], [2, 0], [1, 1]],
        [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
    'S': [
        [[0, 1], [1, 0], [1, 1], [2, 0]],
        [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
    'Z': [
        [[0, 0], [1, 0], [1, 1], [2, 1]],
        [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
    'J': [
        [[0, 0], [0, 1], [1, 1], [2, 1]],
        [[0, 0], [1, 0], [0, 1], [0, 2]],
        [[0, 0], [1, 0], [2, 0], [2, 1]],
        [[1, 0], [1, 1], [1, 2], [0, 2]],
    ],
    'L': [
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

    rotate() {
        this.rotationState = (this.rotationState + 1) % ROTATIONS[this.type].length;
    }

    undoRotate() {
        this.rotationState = (this.rotationState - 1 + ROTATIONS[this.type].length) % ROTATIONS[this.type].length;
    }

    moveLeft() {
        this.x--;
    }

    moveRight() {
        this.x++;
    }

    moveDown() {
        this.y++;
    }

    undoMove() {
        this.y--;
    }

    undoLeft() {
        this.x++;
    }

    undoRight() {
        this.x--;
    }
}

class TetrisGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.previewCountSelect = document.getElementById('previewCountSelect');
        this.nextQueueContainer = document.getElementById('nextQueueContainer');

        this.previewCount = Number(this.previewCountSelect.value);
        this.grid = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(null));
        this.nextQueue = [];
        this.currentPiece = null;
        this.state = PLAYING;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropSpeed = 1000;
        this.lastDropTime = Date.now();
        this.nextTouchHardDropTime = 0;
        this.gameRunning = false;

        this.refillQueue();
        this.currentPiece = this.takeNextPiece();

        this.setupEventListeners();
        this.updateDisplay();
        this.drawNextQueue();
        this.render();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        document.getElementById('leftBtn').addEventListener('click', () => this.movePieceLeft());
        document.getElementById('rightBtn').addEventListener('click', () => this.movePieceRight());
        document.getElementById('rotateBtn').addEventListener('click', () => this.rotatePiece());
        document.getElementById('dropBtn').addEventListener('click', () => this.hardDrop());
        this.previewCountSelect.addEventListener('change', () => this.updatePreviewCount());

        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), false);
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), false);
    }

    updatePreviewCount() {
        this.previewCount = Number(this.previewCountSelect.value);
        this.drawNextQueue();
    }

    createRandomPiece() {
        return new Piece();
    }

    refillQueue() {
        while (this.nextQueue.length < MAX_PREVIEW_PIECES) {
            this.nextQueue.push(this.createRandomPiece());
        }
    }

    takeNextPiece() {
        this.refillQueue();
        const piece = this.nextQueue.shift();
        this.refillQueue();
        return piece;
    }

    handleTouchStart(e) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchStartTime = Date.now();
        this.hasMoved = false;
    }

    handleTouchMove(e) {
        e.preventDefault();

        if (!this.touchStartX || !this.touchStartY || !this.gameRunning) return;

        this.hasMoved = true;
        const touchEndX = e.touches[0].clientX;
        const touchEndY = e.touches[0].clientY;

        const diffX = this.touchStartX - touchEndX;
        const diffY = this.touchStartY - touchEndY;
        const threshold = 30;
        const thresholdY = 100;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > threshold) {
                this.movePieceLeft();
                this.touchStartX = touchEndX;
            } else if (diffX < -threshold) {
                this.movePieceRight();
                this.touchStartX = touchEndX;
            }
        } else if (diffY < -thresholdY) {
            if (this.canTriggerTouchHardDrop()) {
                this.hardDrop();
                this.applyTouchHardDropCooldown();
            }
            this.touchStartY = touchEndY;
        }
    }

    handleTouchEnd(e) {
        e.preventDefault();

        if (!this.gameRunning) return;

        if (!this.hasMoved && this.touchStartTime) {
            const timeDiff = Date.now() - this.touchStartTime;
            if (timeDiff < 300) {
                this.rotatePiece();
            }
        }

        this.touchStartX = null;
        this.touchStartY = null;
        this.touchStartTime = null;
        this.hasMoved = false;
    }

    handleKeyPress(e) {
        if (!this.gameRunning) return;

        switch (e.key.toLowerCase()) {
            case 'arrowleft':
                e.preventDefault();
                this.movePieceLeft();
                break;
            case 'arrowright':
                e.preventDefault();
                this.movePieceRight();
                break;
            case 'arrowdown':
                e.preventDefault();
                this.hardDrop();
                break;
            case 'arrowup':
                e.preventDefault();
                this.rotatePiece();
                break;
            case 'p':
                this.togglePause();
                break;
            case 'r':
                this.reset();
                break;
        }
    }

    movePieceLeft() {
        if (this.state !== PLAYING) return;
        this.currentPiece.moveLeft();
        if (this.isColliding()) {
            this.currentPiece.undoLeft();
        }
        this.render();
    }

    movePieceRight() {
        if (this.state !== PLAYING) return;
        this.currentPiece.moveRight();
        if (this.isColliding()) {
            this.currentPiece.undoRight();
        }
        this.render();
    }

    rotatePiece() {
        if (this.state !== PLAYING) return;
        this.currentPiece.rotate();
        if (this.isColliding()) {
            this.currentPiece.undoRotate();
        }
        this.render();
    }

    hardDrop() {
        if (this.state !== PLAYING) return;
        while (!this.isCollidingDown()) {
            this.currentPiece.moveDown();
        }
        this.placePiece();
    }

    canTriggerTouchHardDrop() {
        return Date.now() >= this.nextTouchHardDropTime;
    }

    applyTouchHardDropCooldown() {
        this.nextTouchHardDropTime = Date.now() + this.dropSpeed;
    }

    isColliding() {
        return this.currentPiece.getCells().some(([x, y]) => {
            if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return true;
            if (y >= 0 && this.grid[y][x] !== null) return true;
            return false;
        });
    }

    isCollidingDown() {
        const originalY = this.currentPiece.y;
        this.currentPiece.moveDown();
        const colliding = this.isColliding();
        this.currentPiece.y = originalY;
        return colliding;
    }

    placePiece() {
        this.currentPiece.getCells().forEach(([x, y]) => {
            if (y >= 0 && y < GRID_HEIGHT && x >= 0 && x < GRID_WIDTH) {
                this.grid[y][x] = this.currentPiece.type;
            }
        });

        this.clearLines();
        this.currentPiece = this.takeNextPiece();
        this.drawNextQueue();

        if (this.isColliding()) {
            this.gameOver();
        }
    }

    clearLines() {
        let clearedLines = 0;

        for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
            if (this.grid[y].every((cell) => cell !== null)) {
                this.grid.splice(y, 1);
                this.grid.unshift(Array(GRID_WIDTH).fill(null));
                clearedLines++;
                y++;
            }
        }

        if (clearedLines > 0) {
            this.lines += clearedLines;
            this.score += clearedLines * clearedLines * 100;
            this.level = Math.floor(this.lines / 10) + 1;
            this.dropSpeed = Math.max(100, 1000 - this.level * 50);
            this.updateDisplay();
        }
    }

    updateDisplay() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('lines').textContent = this.lines;
        document.getElementById('level').textContent = this.level;
    }

    drawNextQueue() {
        this.nextQueueContainer.innerHTML = '';

        if (this.previewCount === 0) {
            const hiddenMessage = document.createElement('div');
            hiddenMessage.className = 'next-empty';
            hiddenMessage.textContent = 'Upcoming pieces are hidden.';
            this.nextQueueContainer.appendChild(hiddenMessage);
            return;
        }

        const visiblePieces = this.nextQueue.slice(0, this.previewCount);
        visiblePieces.forEach((piece) => {
            const canvas = document.createElement('canvas');
            canvas.width = PREVIEW_CANVAS_WIDTH;
            canvas.height = PREVIEW_CANVAS_HEIGHT;
            canvas.className = 'preview-canvas';
            this.nextQueueContainer.appendChild(canvas);
            this.drawPreviewPiece(canvas, piece);
        });
    }

    drawPreviewPiece(canvas, piece) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const shape = ROTATIONS[piece.type][0];
        const xs = shape.map(([x]) => x);
        const ys = shape.map(([, y]) => y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const shapeWidth = (maxX - minX + 1) * PREVIEW_CELL_SIZE;
        const shapeHeight = (maxY - minY + 1) * PREVIEW_CELL_SIZE;
        const offsetX = Math.floor((canvas.width - shapeWidth) / 2);
        const offsetY = Math.floor((canvas.height - shapeHeight) / 2);

        shape.forEach(([x, y]) => {
            const drawX = offsetX + (x - minX) * PREVIEW_CELL_SIZE;
            const drawY = offsetY + (y - minY) * PREVIEW_CELL_SIZE;
            ctx.fillStyle = COLORS[piece.type];
            ctx.fillRect(drawX, drawY, PREVIEW_CELL_SIZE - 2, PREVIEW_CELL_SIZE - 2);
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 1;
            ctx.strokeRect(drawX, drawY, PREVIEW_CELL_SIZE - 2, PREVIEW_CELL_SIZE - 2);
        });
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

        this.currentPiece.getCells().forEach(([x, y]) => {
            if (y >= 0) {
                this.drawCell(x, y, COLORS[this.currentPiece.type]);
            }
        });

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

    drawCell(x, y, color) {
        this.ctx.fillStyle = color;
        this.ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }

    update() {
        if (this.state !== PLAYING) return;

        const now = Date.now();
        if (now - this.lastDropTime > this.dropSpeed) {
            this.currentPiece.moveDown();

            if (this.isColliding()) {
                this.currentPiece.undoMove();
                this.placePiece();
            }

            this.lastDropTime = now;
        }

        this.render();
    }

    start() {
        if (!this.gameRunning) {
            this.gameRunning = true;
            this.state = PLAYING;
            this.gameLoop();
        }
    }

    togglePause() {
        if (!this.gameRunning) return;

        if (this.state === PLAYING) {
            this.state = PAUSED;
        } else if (this.state === PAUSED) {
            this.state = PLAYING;
            this.lastDropTime = Date.now();
        }
        this.render();
    }

    gameOver() {
        this.state = GAME_OVER;
        this.gameRunning = false;
        this.render();
    }

    reset() {
        this.grid = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(null));
        this.nextQueue = [];
        this.refillQueue();
        this.currentPiece = this.takeNextPiece();
        this.state = PLAYING;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropSpeed = 1000;
        this.lastDropTime = Date.now();
        this.nextTouchHardDropTime = 0;
        this.gameRunning = false;
        this.updateDisplay();
        this.drawNextQueue();
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
    new TetrisGame();
});
