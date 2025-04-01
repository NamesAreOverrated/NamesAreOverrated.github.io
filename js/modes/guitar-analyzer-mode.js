/**
 * Guitar tuning mode - helps tune guitar strings
 */
class GuitarAnalyzerMode extends MusicAnalyzerMode {
    constructor(analyzer) {
        super(analyzer);
        this.stringNameElement = analyzer.container.querySelector('.string-name');
        this.frequencyValueElement = analyzer.container.querySelector('.frequency-value');
        this.targetFrequencyElement = analyzer.container.querySelector('.target-frequency');
        this.tunerNeedle = analyzer.container.querySelector('.tuner-needle');
        this.tuningDirectionElement = analyzer.container.querySelector('.tuning-direction');
        this.guitarStrings = analyzer.container.querySelectorAll('.guitar-strings .string');

        // Bind event handlers for guitar string selection
        this.guitarStrings.forEach(stringElement => {
            stringElement.addEventListener('click', this.onStringSelected.bind(this));
        });
    }

    initialize() {
        console.log("[GUITAR MODE] Initialized");
    }

    onStringSelected(event) {
        const stringElement = event.currentTarget;
        const stringName = stringElement.dataset.string;

        // Update UI to show the selected string
        this.guitarStrings.forEach(el => {
            el.classList.remove('active');
        });
        stringElement.classList.add('active');

        console.log(`[GUITAR MODE] Selected string: ${stringName}`);
        // Could implement a focused tuning mode that targets just this string
    }

    processData(data) {
        if (!data.notes || data.notes.length === 0) {
            this.stringNameElement.textContent = '--';
            this.tunerNeedle.style.transform = 'rotate(0deg)';
            this.tuningDirectionElement.textContent = ''; // Empty text
            this.frequencyValueElement.textContent = '0.0 Hz';
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

            // Update tuning needle (transform rotation based on cents deviation)
            const rotationDegrees = Math.min(45, Math.max(-45, stringInfo.centsDeviation / 2));
            this.tunerNeedle.style.transform = `rotate(${rotationDegrees}deg)`;

            // Set tuning direction element to empty text
            this.tuningDirectionElement.textContent = '';
            // Keep the class for styling purposes
            this.tuningDirectionElement.className = stringInfo.inTune ?
                'tuning-direction in-tune' : 'tuning-direction';

            // Highlight the matching string in the UI
            this.guitarStrings.forEach(stringElement => {
                stringElement.classList.remove('active', 'in-tune');
                if (stringElement.dataset.string === stringInfo.stringName) {
                    stringElement.classList.add('active');
                    if (stringInfo.inTune) {
                        stringElement.classList.add('in-tune');
                    }
                }
            });
        } else {
            // No recognizable string detected
            this.stringNameElement.textContent = 'No string detected';
            this.tuningDirectionElement.textContent = ''; // Empty text
            this.tuningDirectionElement.className = 'tuning-direction';
            this.tunerNeedle.style.transform = 'rotate(0deg)';

            // Reset string highlights
            this.guitarStrings.forEach(string => {
                string.classList.remove('active', 'in-tune');
            });
        }
    }
}

// Make the mode class available globally
window.GuitarAnalyzerMode = GuitarAnalyzerMode;
