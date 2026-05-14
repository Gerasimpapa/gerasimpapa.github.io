// Tetris Game in JavaScript

// Constants
const PLAYING = 'playing';
const PAUSED = 'paused';
const GAME_OVER = 'gameOver';

const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const CELL_SIZE = 30;

const COLORS = {
    'I': '#00f0f0',
    'O': '#f0f000',
    'T': '#a000f0',
    'S': '#00f000',
    'Z': '#f00000',
    'J': '#0000f0',
    'L': '#ff7000',
};

// Piece Rotations
const ROTATIONS = {
    'I': [
        [[0, 1], [1, 1], [2, 1], [3, 1]],      // Horizontal
        [[1, 0], [1, 1], [1, 2], [1, 3]],       // Vertical
    ],
    'O': [
        [[0, 0], [0, 1], [1, 0], [1, 1]],       // No rotation needed
    ],
    'T': [
        [[0, 1], [1, 0], [1, 1], [2, 1]],       // Up (normal)
        [[1, 0], [1, 1], [2, 1], [1, 2]],       // Right
        [[0, 0], [1, 0], [2, 0], [1, 1]],       // Down
        [[1, 0], [0, 1], [1, 1], [1, 2]],       // Left
    ],
    'S': [
        [[0, 1], [1, 0], [1, 1], [2, 0]],       // Horizontal
        [[0, 0], [0, 1], [1, 1], [1, 2]],       // Vertical
    ],
    'Z': [
        [[0, 0], [1, 0], [1, 1], [2, 1]],       // Horizontal
        [[1, 0], [0, 1], [1, 1], [0, 2]],       // Vertical
    ],
    'J': [
        [[0, 0], [0, 1], [1, 1], [2, 1]],       // Up
        [[0, 0], [1, 0], [0, 1], [0, 2]],       // Right
        [[0, 0], [1, 0], [2, 0], [2, 1]],       // Down
        [[1, 0], [1, 1], [1, 2], [0, 2]],       // Left
    ],
    'L': [
        [[0, 0], [0, 1], [0, 2], [1, 2]],       // Up
        [[0, 0], [1, 0], [2, 0], [0, 1]],       // Right
        [[0, 0], [1, 0], [1, 1], [1, 2]],       // Down
        [[2, 0], [0, 1], [1, 1], [2, 1]],       // Left
    ],
};

const MIRROR_TRANSFORMS = {
    'J': { type: 'L', rotations: [3, 2, 1, 0] },
    'L': { type: 'J', rotations: [3, 2, 1, 0] },
    'S': { type: 'Z', rotations: [0, 1] },
    'Z': { type: 'S', rotations: [0, 1] },
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
        this.nextCanvas = document.getElementById('nextPieceCanvas');
        this.nextCtx = this.nextCanvas.getContext('2d');
        
        this.grid = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(null));
        this.currentPiece = new Piece();
        this.nextPiece = new Piece();
        this.state = PLAYING;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropSpeed = 1000; // milliseconds
        this.lastDropTime = Date.now();
        this.nextTouchHardDropTime = 0;
        this.doubleTapThreshold = 140;
        this.lastTapTime = 0;
        this.singleTapTimer = null;
        this.gameRunning = false;
        
        this.setupEventListeners();
        this.drawNextPiece();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        document.getElementById('startBtn').addEventListener('click', () => this.start());
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.reset());
        
        // Mobile touch controls
        document.getElementById('leftBtn').addEventListener('click', () => this.movePieceLeft());
        document.getElementById('rightBtn').addEventListener('click', () => this.movePieceRight());
        document.getElementById('rotateBtn').addEventListener('click', () => this.rotatePiece());
        ['mirrorBtnDesktop', 'mirrorBtnMobile'].forEach((buttonId) => {
            const mirrorBtn = document.getElementById(buttonId);
            if (mirrorBtn) {
                mirrorBtn.addEventListener('click', () => this.mirrorCurrentPiece());
            }
        });
        document.getElementById('dropBtn').addEventListener('click', () => this.hardDrop());
        
        // Touch support for mobile
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), false);
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), false);
    }

    handleTouchStart(e) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchStartTime = Date.now();
        this.hasMoved = false;
    }

    handleTouchMove(e) {
        e.preventDefault(); // Disable scroll
        
        if (!this.touchStartX || !this.touchStartY || !this.gameRunning) return;
        
        this.hasMoved = true;
        const touchEndX = e.touches[0].clientX;
        const touchEndY = e.touches[0].clientY;
        
        const diffX = this.touchStartX - touchEndX;
        const diffY = this.touchStartY - touchEndY;
        
        // Swipe detection threshold
        const threshold = 30;
        const thresholdY = 100;
        
        if (Math.abs(diffX) > Math.abs(diffY)) {
            // Horizontal swipe
            if (diffX > threshold) {
                // Swipe left
                this.movePieceLeft();
                this.touchStartX = touchEndX;
            } else if (diffX < -threshold) {
                // Swipe right
                this.movePieceRight();
                this.touchStartX = touchEndX;
            }
        } else {
            // Vertical swipe
            if (diffY < -thresholdY) {
                // Swipe down - hard drop (negative diffY)
                e.preventDefault();
                if (this.canTriggerTouchHardDrop()) {
                    this.hardDrop();
                    this.applyTouchHardDropCooldown();
                }
                this.touchStartY = touchEndY;
            }
        }
    }

    handleTouchEnd(e) {
        e.preventDefault(); // Disable default touch behavior
        
        if (!this.gameRunning) return;
        
        if (!this.hasMoved && this.touchStartTime) {
            const timeDiff = Date.now() - this.touchStartTime;
            if (timeDiff < 300) {
                this.handleCanvasTap();
            }
        }
        
        // Reset touch tracking
        this.touchStartX = null;
        this.touchStartY = null;
        this.touchStartTime = null;
        this.hasMoved = false;
    }

    handleCanvasTap() {
        const now = Date.now();

        if (now - this.lastTapTime <= this.doubleTapThreshold) {
            this.clearPendingTapAction();
            this.mirrorCurrentPiece();
            return;
        }

        this.lastTapTime = now;
        this.singleTapTimer = setTimeout(() => {
            this.singleTapTimer = null;
            this.lastTapTime = 0;
            if (this.gameRunning && this.state === PLAYING) {
                this.rotatePiece();
            }
        }, this.doubleTapThreshold);
    }

    clearPendingTapAction() {
        if (this.singleTapTimer) {
            clearTimeout(this.singleTapTimer);
            this.singleTapTimer = null;
        }
        this.lastTapTime = 0;
    }

    handleKeyPress(e) {
        if (!this.gameRunning) return;

        if (e.code === 'Space') {
            e.preventDefault();
            this.mirrorCurrentPiece();
            return;
        }

        switch(e.key.toLowerCase()) {
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

    mirrorCurrentPiece() {
        if (this.state !== PLAYING) return;

        const mirroredState = this.getMirroredPieceState(this.currentPiece.type, this.currentPiece.rotationState);
        if (!mirroredState) return;

        const originalType = this.currentPiece.type;
        const originalRotation = this.currentPiece.rotationState;

        this.currentPiece.type = mirroredState.type;
        this.currentPiece.rotationState = mirroredState.rotationState;

        if (this.isColliding()) {
            this.currentPiece.type = originalType;
            this.currentPiece.rotationState = originalRotation;
            return;
        }

        this.render();
    }

    getMirroredPieceState(type, rotationState) {
        const transform = MIRROR_TRANSFORMS[type];
        if (!transform) return null;

        return {
            type: transform.type,
            rotationState: transform.rotations[rotationState] ?? rotationState,
        };
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
        const piece = this.currentPiece;
        const originalY = piece.y;
        piece.moveDown();
        const colliding = this.isColliding();
        piece.y = originalY;
        return colliding;
    }

    placePiece() {
        this.currentPiece.getCells().forEach(([x, y]) => {
            if (y >= 0 && y < GRID_HEIGHT && x >= 0 && x < GRID_WIDTH) {
                this.grid[y][x] = this.currentPiece.type;
            }
        });

        this.clearLines();
        this.currentPiece = this.nextPiece;
        this.nextPiece = new Piece();
        this.drawNextPiece();

        if (this.isColliding()) {
            this.gameOver();
        }
    }

    clearLines() {
        let clearedLines = 0;

        for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
            if (this.grid[y].every(cell => cell !== null)) {
                this.grid.splice(y, 1);
                this.grid.unshift(Array(GRID_WIDTH).fill(null));
                clearedLines++;
                y++; // Check this row again
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

    drawNextPiece() {
        this.nextCtx.fillStyle = '#000';
        this.nextCtx.fillRect(0, 0, this.nextCanvas.width, this.nextCanvas.height);

        const cells = this.nextPiece.getCells();
        const minX = Math.min(...cells.map(([x]) => x));
        const minY = Math.min(...cells.map(([, y]) => y));

        cells.forEach(([x, y]) => {
            const drawX = (x - minX) * CELL_SIZE + 10;
            const drawY = (y - minY) * CELL_SIZE + 10;
            
            this.nextCtx.fillStyle = COLORS[this.nextPiece.type];
            this.nextCtx.fillRect(drawX, drawY, CELL_SIZE - 2, CELL_SIZE - 2);
            this.nextCtx.strokeStyle = '#00ff88';
            this.nextCtx.lineWidth = 1;
            this.nextCtx.strokeRect(drawX, drawY, CELL_SIZE - 2, CELL_SIZE - 2);
        });
    }

    render() {
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw grid
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

        // Draw placed blocks
        for (let y = 0; y < GRID_HEIGHT; y++) {
            for (let x = 0; x < GRID_WIDTH; x++) {
                if (this.grid[y][x] !== null) {
                    this.drawCell(x, y, COLORS[this.grid[y][x]]);
                }
            }
        }

        // Draw current piece
        this.currentPiece.getCells().forEach(([x, y]) => {
            if (y >= 0) {
                this.drawCell(x, y, COLORS[this.currentPiece.type]);
            }
        });

        // Draw pause overlay
        if (this.state === PAUSED) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.fillStyle = '#00ff88';
            this.ctx.font = 'bold 40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('PAUSED', this.canvas.width / 2, this.canvas.height / 2);
        }

        // Draw game over overlay
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
        this.clearPendingTapAction();
        this.state = GAME_OVER;
        this.gameRunning = false;
        this.render();
    }

    reset() {
        this.clearPendingTapAction();
        this.grid = Array(GRID_HEIGHT).fill(null).map(() => Array(GRID_WIDTH).fill(null));
        this.currentPiece = new Piece();
        this.nextPiece = new Piece();
        this.state = PLAYING;
        this.score = 0;
        this.lines = 0;
        this.level = 1;
        this.dropSpeed = 1000;
        this.lastDropTime = Date.now();
        this.nextTouchHardDropTime = 0;
        this.doubleTapThreshold = 140;
        this.lastTapTime = 0;
        this.singleTapTimer = null;
        this.gameRunning = false;
        this.drawNextPiece();
        this.render();
    }

    gameLoop() {
        if (this.gameRunning) {
            this.update();
            requestAnimationFrame(() => this.gameLoop());
        }
    }
}

// Initialize game when page loads
window.addEventListener('DOMContentLoaded', () => {
    new TetrisGame();
});



