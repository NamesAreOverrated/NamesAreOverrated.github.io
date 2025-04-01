/**
 * Guitar tuning mode - helps tune guitar strings
 */
class GuitarAnalyzerMode extends MusicAnalyzerMode {
    constructor(analyzer) {
        super(analyzer);
        this.stringNameElement = analyzer.container.querySelector('.string-name');
        this.frequencyValueElement = analyzer.container.querySelector('.frequency-value');
        this.targetFrequencyElement = analyzer.container.querySelector('.target-frequency');
        this.tuningDirectionElement = analyzer.container.querySelector('.tuning-direction');
        this.guitarStrings = analyzer.container.querySelectorAll('.guitar-strings .string');

        // Bind event handlers for guitar string selection
        this.guitarStrings.forEach(stringElement => {
            stringElement.addEventListener('click', this.onStringSelected.bind(this));
        });

        // Create simplified frequency line visualization
        this.createFrequencyLineVisualization();

        // Hide the text direction element
        if (this.tuningDirectionElement) {
            this.tuningDirectionElement.style.display = 'none';
        }
    }

    initialize() {
        console.log("[GUITAR MODE] Initialized");
    }

    // Create a simplified frequency line visualization
    createFrequencyLineVisualization() {
        const tuner = this.analyzer.container.querySelector('.tuner');
        if (!tuner || tuner.querySelector('.frequency-visualization')) return;

        // Create the visualization container
        const vizContainer = document.createElement('div');
        vizContainer.className = 'frequency-visualization';
        vizContainer.innerHTML = `
            <div class="line-container">
                <div class="target-line"></div>
                <div class="current-line"></div>
            </div>
        `;

        tuner.appendChild(vizContainer);

        // Store references to line elements
        this.targetLine = vizContainer.querySelector('.target-line');
        this.currentLine = vizContainer.querySelector('.current-line');
    }

    onStringSelected(event) {
        const stringElement = event.currentTarget;
        const stringName = stringElement.dataset.string;

        // Update UI to show the selected string
        this.guitarStrings.forEach(el => el.classList.remove('active'));
        stringElement.classList.add('active');

        console.log(`[GUITAR MODE] Selected string: ${stringName}`);
    }

    // Update the simplified line visualization for horizontal lines
    updateLineVisualization(currentFreq, targetFreq, centsDeviation) {
        if (!this.targetLine || !this.currentLine) return;

        const container = this.analyzer.container.querySelector('.line-container');
        if (!container) return;

        // Map cents deviation (-50 to +50) to percentage position
        const maxDeviation = 50;
        const clampedDeviation = Math.max(-maxDeviation, Math.min(maxDeviation, centsDeviation));
        const middlePosition = 50;
        const maxDisplacement = 40;

        // Calculate position percentage (50% is center)
        const positionPercent = middlePosition + (clampedDeviation / maxDeviation) * maxDisplacement;

        // Position the lines
        this.currentLine.style.top = `${positionPercent}%`;
        this.targetLine.style.top = `${middlePosition}%`;

        // Add visual cues based on how close we are to the target
        const absCents = Math.abs(centsDeviation);

        // In tune?
        const inTune = absCents <= 5;
        this.targetLine.classList.toggle('in-tune', inTune);
        this.currentLine.classList.toggle('in-tune', inTune);

        if (!inTune) {
            // Direction classes
            const isTooLow = centsDeviation < 0;
            this.currentLine.classList.toggle('tune-up', isTooLow);
            this.currentLine.classList.toggle('tune-down', !isTooLow);

            // Intensity classes
            this.currentLine.classList.toggle('far-off', absCents > 30);
            this.currentLine.classList.toggle('close', absCents <= 15);
        }

        // Make sure the visualization is visible
        container.parentElement.style.display = 'block';
    }

    processData(data) {
        if (!data.notes || data.notes.length === 0) {
            this.stringNameElement.textContent = '--';
            this.frequencyValueElement.textContent = '0.0 Hz';

            // Hide line visualization when no data
            const vizContainer = this.analyzer.container.querySelector('.frequency-visualization');
            if (vizContainer) vizContainer.style.display = 'none';
            return;
        }

        // Get strongest note
        const strongestNote = [...data.notes].sort((a, b) => b.magnitude - a.magnitude)[0];
        const frequency = strongestNote.frequency;

        // Update frequency display
        this.frequencyValueElement.textContent = `${frequency.toFixed(2)} Hz`;

        // Use MusicTheory to analyze guitar string
        const stringInfo = MusicTheory.analyzeGuitarString(frequency);

        if (stringInfo) {
            // Update string name and tuning info
            this.stringNameElement.textContent = stringInfo.stringName;
            this.targetFrequencyElement.textContent = `Target: ${stringInfo.targetFrequency.toFixed(2)} Hz`;

            // Update the line visualization
            this.updateLineVisualization(
                frequency,
                stringInfo.targetFrequency,
                stringInfo.centsDeviation
            );

            // Highlight the matching string in the UI
            this.guitarStrings.forEach(stringElement => {
                stringElement.classList.remove('active', 'in-tune', 'tune-up', 'tune-down');
                if (stringElement.dataset.string === stringInfo.stringName) {
                    stringElement.classList.add('active');
                    if (stringInfo.inTune) {
                        stringElement.classList.add('in-tune');
                    } else {
                        // Negative cents means tune up
                        stringElement.classList.add(stringInfo.centsDeviation < 0 ? 'tune-up' : 'tune-down');
                    }
                }
            });
        } else {
            // No recognizable string detected
            this.stringNameElement.textContent = 'No string detected';

            // Hide visualization when no string detected
            const vizContainer = this.analyzer.container.querySelector('.frequency-visualization');
            if (vizContainer) vizContainer.style.display = 'none';

            // Reset string highlights
            this.guitarStrings.forEach(string => {
                string.classList.remove('active', 'in-tune', 'tune-up', 'tune-down');
            });
        }
    }
}

// Make the mode class available globally
window.GuitarAnalyzerMode = GuitarAnalyzerMode;
