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
        this.fftSize = 512; // Increased for more detail
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

        // Visualization types
        this.visualizationTypes = [
            'bars',
            'wave',
            'circular',
            'particles',
            'spectrum'
        ];
        this.currentVisualization = 0;

        // Particle system
        this.particles = [];
        this.maxParticles = 100;
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

    nextVisualization() {
        this.currentVisualization = (this.currentVisualization + 1) % this.visualizationTypes.length;
        return this.visualizationTypes[this.currentVisualization];
    }

    getCurrentVisualizationName() {
        return this.visualizationTypes[this.currentVisualization];
    }

    draw() {
        if (!this.active) return;

        // Get frequency data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Clear canvas
        this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw current visualization type
        const type = this.visualizationTypes[this.currentVisualization];

        switch (type) {
            case 'bars':
                this.drawBars();
                break;
            case 'wave':
                this.drawWave();
                break;
            case 'circular':
                this.drawCircular();
                break;
            case 'particles':
                this.drawParticles();
                break;
            case 'spectrum':
                this.drawSpectrum();
                break;
            default:
                this.drawBars();
        }

        // Schedule next frame
        this.animationFrame = requestAnimationFrame(() => this.draw());
    }

    // Original bar visualization - modify to use full width
    drawBars() {
        const bufferLength = this.analyser.frequencyBinCount;
        // Calculate total available width and adjust bar width to fill entire canvas
        const availableWidth = this.canvas.width;
        const totalBars = Math.min(bufferLength, Math.floor(availableWidth / 2)); // Use same bar count as spectrum

        // Dynamically calculate bar width to distribute bars evenly across full width
        this.barWidth = (availableWidth / totalBars) - this.barSpacing;

        const barHeightMultiplier = this.canvas.height / 255;

        for (let i = 0; i < totalBars; i++) {
            // Use logarithmic scale for frequencies like in spectrum visualization
            const percent = i / totalBars;
            const dataIndex = Math.floor(percent * bufferLength);
            const barHeight = this.dataArray[dataIndex] * barHeightMultiplier;

            const colorIndex = Math.floor((this.dataArray[dataIndex] / 255) * this.barColors.length);
            const color = this.barColors[Math.min(colorIndex, this.barColors.length - 1)];

            const x = i * (this.barWidth + this.barSpacing);
            const y = this.canvas.height - barHeight;

            this.canvasContext.fillStyle = color;
            this.canvasContext.fillRect(x, y, this.barWidth, barHeight);
        }
    }

    // Waveform visualization
    drawWave() {
        const bufferLength = this.analyser.frequencyBinCount;
        this.analyser.getByteTimeDomainData(this.dataArray);

        this.canvasContext.lineWidth = 2;
        this.canvasContext.strokeStyle = this.barColors[2]; // Purple
        this.canvasContext.beginPath();

        const sliceWidth = this.canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = this.dataArray[i] / 128.0;
            const y = v * this.canvas.height / 2;

            if (i === 0) {
                this.canvasContext.moveTo(x, y);
            } else {
                this.canvasContext.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.canvasContext.lineTo(this.canvas.width, this.canvas.height / 2);
        this.canvasContext.stroke();
    }

    // Circular visualization
    drawCircular() {
        const bufferLength = this.analyser.frequencyBinCount;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(centerX, centerY) * 0.8;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = this.dataArray[i] * 0.5;
            const angle = (i * 2 * Math.PI) / bufferLength;
            const x1 = centerX + Math.cos(angle) * radius;
            const y1 = centerY + Math.sin(angle) * radius;
            const x2 = centerX + Math.cos(angle) * (radius + barHeight);
            const y2 = centerY + Math.sin(angle) * (radius + barHeight);

            const colorIndex = Math.floor((this.dataArray[i] / 255) * this.barColors.length);
            const color = this.barColors[Math.min(colorIndex, this.barColors.length - 1)];

            this.canvasContext.strokeStyle = color;
            this.canvasContext.lineWidth = 2;
            this.canvasContext.beginPath();
            this.canvasContext.moveTo(x1, y1);
            this.canvasContext.lineTo(x2, y2);
            this.canvasContext.stroke();
        }
    }

    // Particle visualization
    drawParticles() {
        // Create a base energy level from audio data
        let energy = 0;
        const bufferLength = this.analyser.frequencyBinCount;
        for (let i = 0; i < bufferLength; i++) {
            energy += this.dataArray[i];
        }
        energy = energy / bufferLength / 255; // Normalize to 0-1

        // Add new particles based on energy
        const particlesToAdd = Math.floor(energy * 5);
        for (let i = 0; i < particlesToAdd; i++) {
            if (this.particles.length < this.maxParticles) {
                this.particles.push({
                    x: Math.random() * this.canvas.width,
                    y: Math.random() * this.canvas.height,
                    size: Math.random() * 5 + 2,
                    speedX: (Math.random() - 0.5) * 3 * energy,
                    speedY: (Math.random() - 0.5) * 3 * energy,
                    color: this.barColors[Math.floor(Math.random() * this.barColors.length)],
                    life: 100
                });
            }
        }

        // Update and draw particles
        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            p.x += p.speedX;
            p.y += p.speedY;
            p.life -= 1;

            // Draw particle
            this.canvasContext.fillStyle = p.color;
            this.canvasContext.beginPath();
            this.canvasContext.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.canvasContext.fill();

            // Remove dead particles
            if (p.life <= 0 || p.x < 0 || p.x > this.canvas.width || p.y < 0 || p.y > this.canvas.height) {
                this.particles.splice(i, 1);
                i--;
            }
        }
    }

    // Spectrum visualization
    drawSpectrum() {
        const bufferLength = this.analyser.frequencyBinCount;
        const barCount = Math.min(bufferLength, Math.floor(this.canvas.width / 2));

        // Create a gradient across the entire spectrum
        const gradient = this.canvasContext.createLinearGradient(0, 0, this.canvas.width, 0);
        for (let i = 0; i < this.barColors.length; i++) {
            gradient.addColorStop(i / (this.barColors.length - 1), this.barColors[i]);
        }

        this.canvasContext.fillStyle = gradient;
        this.canvasContext.beginPath();
        this.canvasContext.moveTo(0, this.canvas.height);

        // Draw spectrum shape
        for (let i = 0; i < barCount; i++) {
            const percent = i / barCount;
            const x = percent * this.canvas.width;

            // Use logarithmic scale for frequencies
            const dataIndex = Math.floor(percent * bufferLength);
            const value = this.dataArray[dataIndex];

            // Mirror the visualization for aesthetic appeal
            const height = (value / 255) * this.canvas.height;
            const y = this.canvas.height - height;

            this.canvasContext.lineTo(x, y);
        }

        // Complete the path
        this.canvasContext.lineTo(this.canvas.width, this.canvas.height);
        this.canvasContext.closePath();
        this.canvasContext.fill();

        // Add a highlight line on top
        this.canvasContext.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.canvasContext.lineWidth = 2;
        this.canvasContext.beginPath();
        for (let i = 0; i < barCount; i++) {
            const percent = i / barCount;
            const x = percent * this.canvas.width;
            const dataIndex = Math.floor(percent * bufferLength);
            const value = this.dataArray[dataIndex];
            const height = (value / 255) * this.canvas.height;
            const y = this.canvas.height - height;

            if (i === 0) {
                this.canvasContext.moveTo(x, y);
            } else {
                this.canvasContext.lineTo(x, y);
            }
        }
        this.canvasContext.stroke();
    }

    handleResize() {
        if (this.canvas) {
            this.canvas.width = window.innerWidth;
        }
    }
}

// Export as global
window.AudioVisualizer = new AudioVisualizer();
