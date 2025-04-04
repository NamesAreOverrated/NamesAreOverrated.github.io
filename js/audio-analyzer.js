/**
 * Audio Analyzer - Core audio processing engine
 * Optimized for musical frequency detection including vocals and instruments
 */

class AudioAnalyzer {
    constructor() {
        // Core audio processing properties
        this.initialized = false;
        this.active = false;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.bufferLength = 0;
        this.sampleRate = 0;

        // Configuration for frequency analysis
        this.fftSize = 4096; // Higher FFT for better frequency resolution
        this.smoothingTimeConstant = 0.8;

        // Visualization properties
        this.canvas = null;
        this.canvasContext = null;
        this.animationFrame = null;
        this.visualizationTypes = ['bars', 'wave', 'circular', 'spectrum'];
        this.currentVisualization = 0;
        this.barColors = [
            '#ff006e', // Pink
            '#3a86ff', // Blue
            '#8338ec', // Purple
            '#ffbe0b', // Yellow
            '#fb5584'  // Rose
        ];

        // Real-time analysis settings
        this.isAnalyzing = false;
        this.analysisCallbacks = [];
        this.analysisInterval = null;
        this.analysisRate = 60; // ms between analyses

        // Musical data
        this.currentFrequencies = [];
        this.currentNotes = [];
        this.lastDetectedKey = null;
    }

    async init() {
        if (this.initialized) return true;

        try {
            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.sampleRate = this.audioContext.sampleRate;

            // Create analyser node with high FFT size for better frequency resolution
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;
            this.analyser.minDecibels = -85; // Increased sensitivity
            this.analyser.maxDecibels = -10;

            // Create data buffer
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Float32Array(this.bufferLength);

            console.log(`Audio analyzer initialized with sample rate ${this.sampleRate}Hz, FFT size ${this.fftSize}`);
            console.log(`Frequency resolution: ${this.sampleRate / this.fftSize}Hz per bin`);

            this.initialized = true;
            return true;
        } catch (error) {
            console.error('Failed to initialize audio analyzer:', error);
            return false;
        }
    }

    async requestMicrophoneAccess() {
        if (!this.initialized) {
            await this.init();
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false // Better for music detection
                }
            });

            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            console.log('Microphone access granted with optimized audio settings');
            return true;
        } catch (error) {
            console.error('Microphone access denied:', error);
            return false;
        }
    }

    startAnalysis(callback) {
        if (!this.initialized || !this.microphone) return false;

        if (callback && typeof callback === 'function') {
            this.analysisCallbacks.push(callback);
        }

        if (!this.isAnalyzing) {
            this.isAnalyzing = true;

            // Clear previous interval if exists
            if (this.analysisInterval) {
                clearInterval(this.analysisInterval);
            }

            // Start regular analysis
            this.analysisInterval = setInterval(() => this.analyze(), this.analysisRate);
            console.log(`Started audio analysis at ${1000 / this.analysisRate}Hz rate`);

            // IMPORTANT: We no longer start visualization automatically when doing analysis
        }

        return true;
    }

    stopAnalysis() {
        this.isAnalyzing = false;

        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }

        this.analysisCallbacks = [];
        this.currentFrequencies = [];
        this.currentNotes = [];
        this.lastDetectedKey = null;

        // Notify that analysis has stopped
        console.log('Audio analysis stopped');

        // Dispatch an event that analysis has stopped in case any components need to know
        document.dispatchEvent(new CustomEvent('audio-analysis-stopped'));
    }

    analyze() {
        if (!this.isAnalyzing) return;

        // Get frequency data (using Float32Array for better precision)
        this.analyser.getFloatFrequencyData(this.dataArray);

        // Calculate frequency resolution
        const freqResolution = this.sampleRate / this.fftSize;

        // Find peaks (dominant frequencies)
        const frequencies = this.findDominantFrequencies();

        // Detect musical notes
        const notes = MusicTheory.detectNotes(frequencies);

        // Determine musical key if we have enough notes
        let key = null;
        if (notes.length > 0) {
            key = MusicTheory.analyzeMusicalKey(
                notes.map(note => ({ name: note.name, octave: note.octave, weight: note.magnitude }))
            );
        }

        // Store results
        this.currentFrequencies = frequencies;
        this.currentNotes = notes;
        if (key) {
            this.lastDetectedKey = key;
        }

        // Notify all callbacks with the analysis results
        const result = {
            timestamp: Date.now(),
            frequencies: frequencies,
            notes: notes,
            key: this.lastDetectedKey,
            isInstrument: this.isLikelyInstrument(frequencies, notes)
        };

        this.analysisCallbacks.forEach(callback => {
            try {
                callback(result);
            } catch (err) {
                console.error('Error in analysis callback:', err);
            }
        });
    }

    /**
     * Advanced peak finding algorithm optimized for musical tones
     * Implements multiple techniques for better note detection:
     * 1. Dynamic thresholding based on signal level
     * 2. Harmonic relationship analysis
     * 3. Peak interpolation for sub-bin accuracy
     */
    findDominantFrequencies() {
        const frequencies = [];
        const freqResolution = this.sampleRate / this.fftSize;

        // Noise floor calculation (dynamic threshold)
        let sum = 0;
        let count = 0;

        // Only consider the range relevant for music (20Hz to 5kHz)
        const minBin = Math.floor(20 / freqResolution);
        const maxBin = Math.min(Math.ceil(5000 / freqResolution), this.bufferLength);

        // Calculate average energy in the relevant frequency range
        for (let i = minBin; i < maxBin; i++) {
            sum += Math.pow(10, this.dataArray[i] / 20); // Convert dB to linear
            count++;
        }

        // Calculate noise floor (mean + adjustable threshold)
        const meanPower = sum / count;
        const dynamicThreshold = meanPower * 10; // 10x average is a good starting point

        // Find local maxima (peaks)
        for (let i = minBin + 1; i < maxBin - 1; i++) {
            const power = Math.pow(10, this.dataArray[i] / 20);

            // Skip if below threshold or not a local maximum
            if (power < dynamicThreshold ||
                power <= Math.pow(10, this.dataArray[i - 1] / 20) ||
                power <= Math.pow(10, this.dataArray[i + 1] / 20)) {
                continue;
            }

            // Implement quadratic interpolation for more precise frequency
            // This gives sub-bin precision by fitting a parabola to the peak and its neighbors
            const y1 = this.dataArray[i - 1];
            const y2 = this.dataArray[i];
            const y3 = this.dataArray[i + 1];

            // Calculate the vertex of the parabola using the formula: x = 0.5 * (y1 - y3) / (y1 - 2*y2 + y3)
            const offset = (y1 - y3) / (2 * (y1 - 2 * y2 + y3));

            // Calculate the interpolated frequency
            const frequency = (i + offset) * freqResolution;

            // Calculate magnitude (normalize to 0-255 for compatibility)
            const magnitude = Math.min(255, Math.max(0, (this.dataArray[i] + 100) * 2.55));

            frequencies.push({
                frequency,
                magnitude,
                bin: i
            });
        }

        // Sort by magnitude (highest first)
        frequencies.sort((a, b) => b.magnitude - a.magnitude);

        // Analyze harmonics to identify fundamental frequencies
        if (frequencies.length > 1) {
            this.analyzeHarmonics(frequencies);
        }

        // Return top frequencies (limit to 12 for performance)
        return frequencies.slice(0, 12);
    }

    /**
     * Analyzes harmonic relationships between detected frequencies
     * and boosts the score of frequencies that appear to be fundamental
     */
    analyzeHarmonics(frequencies) {
        // For each frequency, check if others might be its harmonics
        for (let i = 0; i < frequencies.length; i++) {
            const potential = frequencies[i].frequency;
            let harmonicCount = 0;
            let harmonicScore = 0;

            // Check each other frequency to see if it's a harmonic
            for (let j = 0; j < frequencies.length; j++) {
                if (i === j) continue;

                const candidate = frequencies[j].frequency;
                const ratio = candidate / potential;

                // Check integer multiples with some tolerance (1.5%-3% depending on frequency)
                // Lower frequencies need wider tolerance
                const tolerance = potential < 200 ? 0.03 : 0.015;

                for (let harmonic = 2; harmonic <= 10; harmonic++) {
                    if (Math.abs(ratio - harmonic) < tolerance * harmonic) {
                        harmonicCount++;
                        harmonicScore += frequencies[j].magnitude * (1 / harmonic); // Weight by harmonic number
                        break;
                    }
                }

                // Also check if this could be a harmonic of another fundamental
                for (let harmonic = 2; harmonic <= 5; harmonic++) {
                    if (Math.abs(potential / candidate - harmonic) < tolerance * harmonic) {
                        // This frequency could be a harmonic of another, reduce its score
                        frequencies[i].isHarmonic = true;
                        break;
                    }
                }
            }

            // If we found harmonics, mark this as a potential fundamental
            if (harmonicCount >= 1) {
                frequencies[i].isFundamental = true;
                frequencies[i].harmonicScore = harmonicScore;
                frequencies[i].harmonicCount = harmonicCount;

                // Increase the magnitude proportionally to the harmonic score
                // This helps ensure fundamentals rise to the top
                const boostFactor = 1 + (harmonicScore / 255) * 0.5; // Up to 50% boost
                frequencies[i].magnitude = Math.min(255, frequencies[i].magnitude * boostFactor);
            }
        }

        // Re-sort after boosting fundamental frequencies
        frequencies.sort((a, b) => b.magnitude - a.magnitude);
    }

    /**
     * Determines if the audio input is more likely an instrument than voice
     * based on spectral characteristics
     */
    isLikelyInstrument(frequencies, notes) {
        // Instruments tend to have:
        // 1. More stable frequencies
        // 2. Cleaner harmonic structure
        // 3. Higher energy in specific frequency bands

        // Check for strong harmonics with clear ratios
        if (frequencies.length >= 3) {
            const fundamentals = frequencies.filter(f => f.isFundamental);
            if (fundamentals.length > 0 && fundamentals[0].harmonicCount >= 3) {
                return true;
            }
        }

        // This is a simple heuristic - in practice, you would use more
        // sophisticated methods like spectral centroid analysis
        return false;
    }

    // ===== VISUALIZATION METHODS =====

    createCanvas() {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'audio-visualizer';
        this.canvas.width = window.innerWidth;
        this.canvas.height = 150;

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

        this.canvasContext = this.canvas.getContext('2d');
        document.body.appendChild(this.canvas);
    }

    start() {
        if (!this.initialized || this.active) return;

        if (!this.canvas) {
            this.createCanvas();
        }

        this.canvas.style.opacity = '0.7';
        this.active = true;
        this.draw();
    }

    stop() {
        if (!this.active) return;

        if (this.canvas) {
            this.canvas.style.opacity = '0';
        }

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        this.active = false;

        // Also stop any ongoing analysis when visualization is stopped
        if (this.isAnalyzing) {
            this.stopAnalysis();
        }

        // Dispatch an event that visualization has stopped
        document.dispatchEvent(new CustomEvent('audio-visualization-stopped'));
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

        // Get current frequency data for visualization (use Uint8Array for visualization)
        const visData = new Uint8Array(this.bufferLength);
        this.analyser.getByteFrequencyData(visData);

        // Clear canvas
        this.canvasContext.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw current visualization
        const type = this.visualizationTypes[this.currentVisualization];

        switch (type) {
            case 'bars':
                this.drawBars(visData);
                break;
            case 'wave':
                this.drawWave(visData);
                break;
            case 'circular':
                this.drawCircular(visData);
                break;
            case 'spectrum':
                this.drawSpectrum(visData);
                break;
            default:
                this.drawBars(visData);
        }

        // Schedule next frame
        this.animationFrame = requestAnimationFrame(() => this.draw());
    }

    // Visualization methods (existing from previous version)
    drawBars(visData) {
        // Similar to original implementation but with current notes highlighting
        const bufferLength = this.analyser.frequencyBinCount;
        const availableWidth = this.canvas.width;
        const totalBars = Math.min(bufferLength, Math.floor(availableWidth / 2));

        const barWidth = (availableWidth / totalBars) - 1;
        const barHeightMultiplier = this.canvas.height / 255;

        for (let i = 0; i < totalBars; i++) {
            const percent = i / totalBars;
            const dataIndex = Math.floor(percent * bufferLength);
            const barHeight = visData[dataIndex] * barHeightMultiplier;

            // Highlight bars that correspond to detected notes
            const frequency = dataIndex * (this.sampleRate / this.fftSize);
            const isNearNote = this.currentNotes.some(note =>
                Math.abs(note.frequency - frequency) < this.sampleRate / this.fftSize
            );

            // Choose color based on proximity to detected note
            let color;
            if (isNearNote) {
                color = '#FFFFFF'; // Highlight with white
            } else {
                const colorIndex = Math.floor((visData[dataIndex] / 255) * this.barColors.length);
                color = this.barColors[Math.min(colorIndex, this.barColors.length - 1)];
            }

            const x = i * (barWidth + 1);
            const y = this.canvas.height - barHeight;

            this.canvasContext.fillStyle = color;
            this.canvasContext.fillRect(x, y, barWidth, barHeight);
        }
    }

    drawWave(visData) {
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

        // If analyzing and have detected notes, add visual highlights
        if (this.isAnalyzing && this.currentNotes.length > 0) {
            // Draw note indicators
            this.currentNotes.slice(0, 3).forEach(note => {
                // Find a position along the wave for this note
                const notePosition = this.canvas.width * (0.2 + Math.random() * 0.6); // Random position to avoid overlap

                // Draw a circle at the note position
                this.canvasContext.beginPath();
                this.canvasContext.arc(notePosition, this.canvas.height / 2, note.magnitude / 10, 0, Math.PI * 2);

                // Use different colors for fundamental vs harmonic
                const fillColor = note.isFundamental ? 'rgba(255,255,0,0.7)' : 'rgba(255,255,255,0.5)';
                this.canvasContext.fillStyle = fillColor;
                this.canvasContext.fill();

                // Add note name
                this.canvasContext.font = '12px Arial';
                this.canvasContext.fillStyle = '#FFFFFF';
                this.canvasContext.textAlign = 'center';
                this.canvasContext.fillText(`${note.name}${note.octave}`, notePosition, this.canvas.height / 2 - 20);
            });
        }
    }

    drawCircular(visData) {
        const bufferLength = this.analyser.frequencyBinCount;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const maxRadius = Math.min(centerX, centerY) * 0.7;

        // Calculate average energy for glow effect
        let totalEnergy = 0;
        for (let i = 0; i < bufferLength; i++) {
            totalEnergy += visData[i];
        }
        const avgEnergy = totalEnergy / bufferLength / 255; // Normalize to 0-1

        // Create a variable color based on detected key if available
        let baseColor = 'rgba(100, 255, 218,'; // Default teal color
        if (this.lastDetectedKey) {
            // Generate a color based on the key name (simple hash)
            const keyNameSum = this.lastDetectedKey.name
                .split('')
                .reduce((sum, char) => sum + char.charCodeAt(0), 0);

            const hue = keyNameSum % 360;
            baseColor = `hsla(${hue}, 80%, 60%,`;
        }

        // Draw base circle
        this.canvasContext.beginPath();
        this.canvasContext.arc(centerX, centerY, maxRadius * 0.3, 0, Math.PI * 2);
        this.canvasContext.strokeStyle = `${baseColor}${0.2 + avgEnergy * 0.5})`;
        this.canvasContext.lineWidth = 2;
        this.canvasContext.stroke();

        // Draw middle circle
        this.canvasContext.beginPath();
        this.canvasContext.arc(centerX, centerY, maxRadius * 0.6, 0, Math.PI * 2);
        this.canvasContext.strokeStyle = `${baseColor}${0.1 + avgEnergy * 0.3})`;
        this.canvasContext.lineWidth = 1;
        this.canvasContext.stroke();

        // Draw outer circle with glow based on energy
        this.canvasContext.beginPath();
        this.canvasContext.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
        this.canvasContext.strokeStyle = `${baseColor}${0.1 + avgEnergy * 0.4})`;
        this.canvasContext.lineWidth = 2 + avgEnergy * 3;
        this.canvasContext.shadowBlur = 10 + avgEnergy * 20;
        this.canvasContext.shadowColor = `${baseColor}0.5)`;
        this.canvasContext.stroke();
        this.canvasContext.shadowBlur = 0;

        // Draw spectrum around the circle
        const frequencyStep = Math.ceil(bufferLength / 64); // Use fewer data points for smoother visualization

        for (let i = 0; i < bufferLength; i += frequencyStep) {
            const amplitude = visData[i] / 255; // Normalize to 0-1
            if (amplitude < 0.05) continue; // Skip very low amplitudes for cleaner look

            const barHeight = amplitude * maxRadius * 0.7;
            const angle = (i * 2 * Math.PI) / bufferLength;

            // Calculate start and end points
            const innerRadius = maxRadius * 0.4;
            const x1 = centerX + Math.cos(angle) * innerRadius;
            const y1 = centerY + Math.sin(angle) * innerRadius;
            const x2 = centerX + Math.cos(angle) * (innerRadius + barHeight);
            const y2 = centerY + Math.sin(angle) * (innerRadius + barHeight);

            // Check if this frequency corresponds to one of our detected notes
            const frequency = (i * this.sampleRate) / this.fftSize;
            const matchesNote = this.currentNotes.some(note =>
                Math.abs(note.frequency - frequency) < 10);

            // Use special color for frequencies that match detected notes
            const color = matchesNote ?
                '#FFFFFF' :
                this.barColors[Math.floor(amplitude * this.barColors.length) % this.barColors.length];

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

        // Draw center circle with detected key info
        const centerRadius = maxRadius * 0.15;
        this.canvasContext.beginPath();
        this.canvasContext.arc(centerX, centerY, centerRadius, 0, Math.PI * 2);
        this.canvasContext.fillStyle = `${baseColor}${0.6 + avgEnergy * 0.3})`;
        this.canvasContext.fill();

        // If we have a detected key, display it in the center
        if (this.lastDetectedKey) {
            this.canvasContext.font = `${Math.round(centerRadius * 0.7)}px Arial`;
            this.canvasContext.fillStyle = '#FFFFFF';
            this.canvasContext.textAlign = 'center';
            this.canvasContext.textBaseline = 'middle';

            // Format key name to fit better
            const keyText = this.lastDetectedKey.name
                .replace(' Major', '')
                .replace(' Minor', 'm');

            this.canvasContext.fillText(keyText, centerX, centerY);
        }
    }

    drawSpectrum(visData) {
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
            const value = visData[dataIndex];

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
            const value = visData[dataIndex];
            const height = (value / 255) * this.canvas.height;
            const y = this.canvas.height - height;

            if (i === 0) {
                this.canvasContext.moveTo(x, y);
            } else {
                this.canvasContext.lineTo(x, y);
            }
        }

        this.canvasContext.stroke();

        // Mark the frequencies of detected notes with vertical lines
        if (this.currentNotes.length > 0) {
            this.currentNotes.forEach(note => {
                const frequency = note.frequency;
                const x = (frequency / (this.sampleRate / 2)) * this.canvas.width;

                if (x >= 0 && x <= this.canvas.width) {
                    // Draw marker line
                    this.canvasContext.strokeStyle = note.isFundamental ?
                        'rgba(255, 255, 0, 0.8)' : 'rgba(255, 255, 255, 0.6)';
                    this.canvasContext.lineWidth = note.isFundamental ? 2 : 1;
                    this.canvasContext.beginPath();
                    this.canvasContext.moveTo(x, this.canvas.height);
                    this.canvasContext.lineTo(x, this.canvas.height - (note.magnitude / 255) * this.canvas.height * 1.2);
                    this.canvasContext.stroke();

                    // Add note name
                    if (note.isFundamental || note.magnitude > 150) {
                        this.canvasContext.fillStyle = '#FFFFFF';
                        this.canvasContext.font = '10px Arial';
                        this.canvasContext.textAlign = 'center';
                        this.canvasContext.fillText(`${note.name}${note.octave}`, x,
                            this.canvas.height - (note.magnitude / 255) * this.canvas.height * 1.2 - 10);
                    }
                }
            });
        }
    }



    handleResize() {
        if (this.canvas) {
            this.canvas.width = window.innerWidth;
        }
    }
}

// Create global instance
window.AudioAnalyzer = new AudioAnalyzer();
