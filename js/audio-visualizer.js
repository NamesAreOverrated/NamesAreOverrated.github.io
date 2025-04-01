/**
 * Audio Visualizer for Disco Mode
 * Uses Web Audio API to capture and visualize audio from user's microphone
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
        this.fftSize = 512;
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
            'spectrum'
        ];
        this.currentVisualization = 0;
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
            console.log('Requesting microphone access for audio visualization.');
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
        this.canvas.height = 150;

        // Apply styles to position at bottom of screen
        this.canvas.style.position = 'fixed';
        this.canvas.style.bottom = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.zIndex = '999';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.opacity = '0';
        this.canvas.style.transition = 'opacity 0.5s ease';
        this.canvas.style.border = 'none';
        this.canvas.style.outline = 'none';
        this.canvas.style.backgroundColor = 'transparent';

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
            case 'spectrum':
                this.drawSpectrum();
                break;
            default:
                this.drawBars();
        }

        // Schedule next frame
        this.animationFrame = requestAnimationFrame(() => this.draw());
    }

    drawBars() {
        const bufferLength = this.analyser.frequencyBinCount;
        const availableWidth = this.canvas.width;
        const totalBars = Math.min(bufferLength, Math.floor(availableWidth / 2));
        this.barWidth = (availableWidth / totalBars) - this.barSpacing;
        const barHeightMultiplier = this.canvas.height / 255;

        for (let i = 0; i < totalBars; i++) {
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

    drawWave() {
        const bufferLength = this.analyser.frequencyBinCount;
        const waveform = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(waveform);

        this.canvasContext.lineWidth = 2;
        this.canvasContext.strokeStyle = this.barColors[2]; // Purple
        this.canvasContext.beginPath();

        const sliceWidth = this.canvas.width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = waveform[i] / 128.0;
            const y = v * this.canvas.height / 2;

            if (i === 0) {
                this.canvasContext.moveTo(x, y);
            } else {
                this.canvasContext.lineTo(x, y);
            }

            x += sliceWidth;
        }

        // Create a gradient effect
        const gradient = this.canvasContext.createLinearGradient(0, 0, this.canvas.width, 0);
        for (let i = 0; i < this.barColors.length; i++) {
            gradient.addColorStop(i / (this.barColors.length - 1), this.barColors[i]);
        }

        this.canvasContext.strokeStyle = gradient;
        this.canvasContext.stroke();
    }

    drawCircular() {
        const bufferLength = this.analyser.frequencyBinCount;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const maxRadius = Math.min(centerX, centerY) * 0.7;

        // Calculate average energy for glow effect
        let totalEnergy = 0;
        for (let i = 0; i < bufferLength; i++) {
            totalEnergy += this.dataArray[i];
        }
        const avgEnergy = totalEnergy / bufferLength / 255; // Normalize to 0-1

        // Draw base circle
        this.canvasContext.beginPath();
        this.canvasContext.arc(centerX, centerY, maxRadius * 0.3, 0, Math.PI * 2);
        this.canvasContext.strokeStyle = `rgba(100, 255, 218, ${0.2 + avgEnergy * 0.5})`;
        this.canvasContext.lineWidth = 2;
        this.canvasContext.stroke();

        // Draw middle circle
        this.canvasContext.beginPath();
        this.canvasContext.arc(centerX, centerY, maxRadius * 0.6, 0, Math.PI * 2);
        this.canvasContext.strokeStyle = `rgba(100, 255, 218, ${0.1 + avgEnergy * 0.3})`;
        this.canvasContext.lineWidth = 1;
        this.canvasContext.stroke();

        // Draw outer circle with glow based on energy
        this.canvasContext.beginPath();
        this.canvasContext.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
        this.canvasContext.strokeStyle = `rgba(100, 255, 218, ${0.1 + avgEnergy * 0.4})`;
        this.canvasContext.lineWidth = 2 + avgEnergy * 3;
        this.canvasContext.shadowBlur = 10 + avgEnergy * 20;
        this.canvasContext.shadowColor = 'rgba(100, 255, 218, 0.5)';
        this.canvasContext.stroke();
        this.canvasContext.shadowBlur = 0;

        // Draw spectrum around the circle
        const frequencyStep = Math.ceil(bufferLength / 64); // Use fewer data points for smoother visualization

        for (let i = 0; i < bufferLength; i += frequencyStep) {
            const amplitude = this.dataArray[i] / 255; // Normalize to 0-1
            if (amplitude < 0.05) continue; // Skip very low amplitudes for cleaner look

            const barHeight = amplitude * maxRadius * 0.7;
            const angle = (i * 2 * Math.PI) / bufferLength;

            // Calculate start and end points
            const innerRadius = maxRadius * 0.4;
            const x1 = centerX + Math.cos(angle) * innerRadius;
            const y1 = centerY + Math.sin(angle) * innerRadius;
            const x2 = centerX + Math.cos(angle) * (innerRadius + barHeight);
            const y2 = centerY + Math.sin(angle) * (innerRadius + barHeight);

            // Pick color based on frequency and amplitude
            const colorIndex = Math.floor(amplitude * this.barColors.length);
            const color = this.barColors[Math.min(colorIndex, this.barColors.length - 1)];

            // Draw line with glow effect
            this.canvasContext.strokeStyle = color;
            this.canvasContext.lineWidth = 2 + amplitude * 3;
            this.canvasContext.shadowBlur = 5 + amplitude * 10;
            this.canvasContext.shadowColor = color;
            this.canvasContext.beginPath();
            this.canvasContext.moveTo(x1, y1);
            this.canvasContext.lineTo(x2, y2);
            this.canvasContext.stroke();
        }

        // Reset shadow effect
        this.canvasContext.shadowBlur = 0;

        // Draw pulsing center based on bass frequencies
        const bassEnergy = this.dataArray.slice(0, 10).reduce((sum, val) => sum + val, 0) / (10 * 255);
        this.canvasContext.beginPath();
        this.canvasContext.arc(centerX, centerY, maxRadius * 0.1 * (1 + bassEnergy), 0, Math.PI * 2);
        this.canvasContext.fillStyle = `rgba(100, 255, 218, ${0.5 + bassEnergy * 0.5})`;
        this.canvasContext.fill();
    }

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
