/**
 * Audio Visualizer for Disco Mode
 * Uses Web Audio API to capture and visualize audio from user's microphone
 * Note: Web browsers cannot directly access system audio output due to security restrictions
 */

class AudioVisualizer {
    constructor() {
        this.initialized = false;
        this.active = false;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.canvas = null;
        this.canvasContext = null;
        this.animationFrame = null;
        this.dataArray = null;

        // Configuration
        this.fftSize = 256;
        this.smoothingTimeConstant = 0.8;
        this.barWidth = 4;
        this.barSpacing = 1;
        this.barColors = [
            '#ff006e', // Pink
            '#3a86ff', // Blue
            '#8338ec', // Purple
            '#ffbe0b', // Yellow
            '#fb5584'  // Rose
        ];
    }

    async init() {
        if (this.initialized) return;

        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;

            // Create buffer to store frequency data
            const bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(bufferLength);

            this.initialized = true;
            console.log('Audio visualizer initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize audio visualizer:', error);
            return false;
        }
    }

    async requestMicrophoneAccess() {
        try {
            // Show a message explaining why we need microphone access
            console.log('Requesting microphone access to visualize audio. Note: Browsers cannot directly access system audio.');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            console.log('Microphone access granted');
            return true;
        } catch (error) {
            console.error('Microphone access denied:', error);
            return false;
        }
    }

    createCanvas() {
        // Create canvas for visualization
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'audio-visualizer';
        this.canvas.width = window.innerWidth;
        this.canvas.height = 150; // Fixed height for the visualizer

        // Apply styles to position at bottom of screen
        this.canvas.style.position = 'fixed';
        this.canvas.style.bottom = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.zIndex = '999';
        this.canvas.style.pointerEvents = 'none'; // Allow clicks to pass through
        this.canvas.style.opacity = '0';
        this.canvas.style.transition = 'opacity 0.5s ease';

        // Get drawing context
        this.canvasContext = this.canvas.getContext('2d');

        // Add to DOM
        document.body.appendChild(this.canvas);
    }

    start() {
        if (!this.initialized || this.active) return;

        if (!this.canvas) {
            this.createCanvas();
        }

        // Show canvas
        this.canvas.style.opacity = '0.7';
        this.active = true;

        // Start visualization loop
        this.draw();
    }

    stop() {
        if (!this.active) return;

        // Hide canvas
        if (this.canvas) {
            this.canvas.style.opacity = '0';
        }

        // Cancel animation
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        this.active = false;
    }

    draw() {
        if (!this.active) return;

        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Clear canvas
        this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Calculate bar dimensions
        const bufferLength = this.analyser.frequencyBinCount;
        const barCount = Math.min(bufferLength, Math.floor(this.canvas.width / (this.barWidth + this.barSpacing)));
        const barHeightMultiplier = this.canvas.height / 255;

        // Draw visualization
        for (let i = 0; i < barCount; i++) {
            // Use a subset of the data array for more interesting visuals
            const dataIndex = Math.floor(i * (bufferLength / barCount));
            const barHeight = this.dataArray[dataIndex] * barHeightMultiplier;

            // Create gradient based on value
            const colorIndex = Math.floor((this.dataArray[dataIndex] / 255) * this.barColors.length);
            const color = this.barColors[Math.min(colorIndex, this.barColors.length - 1)];

            // Set drawing position
            const x = i * (this.barWidth + this.barSpacing);
            const y = this.canvas.height - barHeight;

            // Draw bar
            this.canvasContext.fillStyle = color;
            this.canvasContext.fillRect(x, y, this.barWidth, barHeight);
        }

        // Schedule next frame
        this.animationFrame = requestAnimationFrame(() => this.draw());
    }

    handleResize() {
        if (this.canvas) {
            this.canvas.width = window.innerWidth;
        }
    }
}

// Export as global
window.AudioVisualizer = new AudioVisualizer();
