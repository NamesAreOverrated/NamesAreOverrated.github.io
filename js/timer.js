import TimerNotification from './timer-notification.js';

class Timer {
    constructor() {
        this.timeLeft = 0;
        this.isRunning = false;
        this.intervalId = null;
        this.notifications = new TimerNotification();
        this.currentPattern = null;
        this.patternPhase = 0;

        // Initialize patterns
        this.initializePatterns();
        this.loadPatterns();
        this.initializeEventListeners();
    }

    initializePatterns() {
        // Predefined patterns
        this.patterns = {
            pomodoro: {
                name: 'Pomodoro',
                phases: [
                    { duration: 25 * 60, message: 'Focus time! Get to work.', type: 'focus' },
                    { duration: 5 * 60, message: 'Take a short break.', type: 'break' }
                ],
                longBreak: { duration: 15 * 60, message: 'Take a long break - you earned it!', type: 'break' },
                cyclesBeforeLongBreak: 4,
                repeat: true
            },
            'breathing-478': {
                name: '4-7-8 Breathing',
                phases: [
                    { duration: 4, message: 'Inhale slowly through your nose', type: 'inhale' },
                    { duration: 7, message: 'Hold your breath', type: 'hold' },
                    { duration: 8, message: 'Exhale completely through your mouth', type: 'exhale' }
                ],
                repeat: true,
                visualization: 'breathing-circle'
            },
            'box': {
                name: 'Box Breathing',
                phases: [
                    { duration: 4, message: 'Inhale slowly', type: 'inhale' },
                    { duration: 4, message: 'Hold your breath', type: 'hold' },
                    { duration: 4, message: 'Exhale slowly', type: 'exhale' },
                    { duration: 4, message: 'Hold your breath', type: 'hold' }
                ],
                repeat: true,
                visualization: 'breathing-circle'
            }
        };
    }

    loadPatterns() {
        try {
            // Load saved custom patterns from localStorage
            const savedPatterns = JSON.parse(localStorage.getItem('customPatterns')) || {};
            this.patterns = { ...this.patterns, ...savedPatterns };
            this.renderCustomPatterns();
        } catch (error) {
            console.error('Error loading saved patterns:', error);
        }
    }

    renderCustomPatterns() {
        const customGrid = document.querySelector('.custom-grid');
        customGrid.innerHTML = '';

        // Get custom patterns and sort by latest first
        const customPatterns = Object.values(this.patterns)
            .filter(p => p.custom)
            .sort((a, b) => b.id.localeCompare(a.id));

        customPatterns.forEach(pattern => {
            const card = this.createPatternCard(pattern);
            customGrid.appendChild(card);
        });
    }

    savePattern(pattern) {
        try {
            const savedPatterns = JSON.parse(localStorage.getItem('customPatterns')) || {};
            savedPatterns[pattern.id] = pattern;
            localStorage.setItem('customPatterns', JSON.stringify(savedPatterns));
            this.patterns[pattern.id] = pattern;
            this.renderCustomPatterns();

            // Switch to custom patterns view and select the new pattern
            const customBtn = document.querySelector('.pattern-btn[data-pattern="custom"]');
            if (!customBtn.classList.contains('active')) {
                customBtn.click();
            }
            this.setPattern(pattern.id);
            this.hideEditor();
        } catch (error) {
            console.error('Error saving pattern:', error);
        }
    }

    deletePattern(patternId) {
        try {
            if (confirm('Are you sure you want to delete this pattern?')) {
                const savedPatterns = JSON.parse(localStorage.getItem('customPatterns')) || {};
                delete savedPatterns[patternId];
                localStorage.setItem('customPatterns', JSON.stringify(savedPatterns));
                delete this.patterns[patternId];

                // Reset if current pattern was deleted
                if (this.currentPattern === patternId) {
                    this.reset();
                    this.currentPattern = null;
                }

                this.renderCustomPatterns();
            }
        } catch (error) {
            console.error('Error deleting pattern:', error);
        }
    }

    initializeEventListeners() {
        // Pattern type selection
        document.querySelectorAll('.pattern-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.pattern-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Reset current pattern
                this.reset();
                this.currentPattern = null;

                // Show/hide relevant sections
                const isCustom = btn.dataset.pattern === 'custom';
                document.querySelector('.pattern-presets').parentElement.style.display = isCustom ? 'none' : 'block';
                document.getElementById('custom-patterns').style.display = isCustom ? 'block' : 'none';

                if (isCustom) {
                    this.clearEditor();
                }
            });
        });

        // Pattern selection
        document.querySelector('.pattern-grid').addEventListener('click', (e) => {
            const card = e.target.closest('.pattern-card');
            if (!card) return;

            // Remove active class from all cards
            document.querySelectorAll('.pattern-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            this.setPattern(card.dataset.pattern);
        });

        // Timer controls
        document.getElementById('start-timer').addEventListener('click', () => this.start());
        document.getElementById('pause-timer').addEventListener('click', () => this.pause());
        document.getElementById('reset-timer').addEventListener('click', () => this.reset());

        // Pattern editor controls
        document.getElementById('new-pattern').addEventListener('click', () => {
            this.showEditor();
            this.clearEditor();
        });

        // Add edit button to pattern cards
        document.querySelector('.pattern-grid').addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const card = e.target.closest('.pattern-card');
            if (!card || !this.patterns[card.dataset.pattern]?.custom) return;

            this.showEditor();
            this.loadPattern(card.dataset.pattern);
        });

        document.getElementById('add-phase').addEventListener('click', () => this.addPhase());
        document.getElementById('save-pattern').addEventListener('click', () => this.saveCurrentPattern());

        // Phase timeline interaction
        document.querySelector('.phase-indicators').addEventListener('click', (e) => {
            const indicator = e.target.closest('.phase-indicator');
            if (!indicator) return;

            const phaseIndex = parseInt(indicator.dataset.index);
            if (!this.isRunning) {
                this.jumpToPhase(phaseIndex);
            }
        });

        // New pattern button
        document.getElementById('new-pattern').addEventListener('click', () => {
            this.showEditor();
        });

        // Edit controls
        document.getElementById('save-changes').addEventListener('click', () => {
            this.saveEdits();
        });

        document.getElementById('cancel-edit').addEventListener('click', () => {
            this.hideEditor();
        });
    }

    clearEditor() {
        document.getElementById('pattern-name').value = '';
        document.getElementById('pattern-repeat').checked = true;
        document.getElementById('auto-start').checked = true;

        const phasesList = document.getElementById('phases-list');
        phasesList.innerHTML = '';

        // Add one empty phase by default
        this.addPhase();
    }

    addPhase() {
        const phasesList = document.getElementById('phases-list');
        const template = document.getElementById('phase-template');
        const phase = template.content.cloneNode(true);

        // Set phase number
        const phaseCount = phasesList.children.length + 1;
        phase.querySelector('.phase-number').textContent = `Phase ${phaseCount}`;

        // Add remove button handler
        phase.querySelector('.remove-phase').addEventListener('click', (e) => {
            e.target.closest('.phase').remove();
            this.updatePhaseNumbers();
        });

        phasesList.appendChild(phase);
    }

    updatePhaseNumbers() {
        const phasesList = document.getElementById('phases-list');
        Array.from(phasesList.children).forEach((phase, index) => {
            phase.querySelector('.phase-number').textContent = `Phase ${index + 1}`;
        });
    }

    saveCurrentPattern() {
        const name = document.getElementById('pattern-name').value;
        if (!name) {
            alert('Please enter a pattern name');
            return;
        }

        const phases = [];
        const phaseElements = document.getElementById('phases-list').children;
        Array.from(phaseElements).forEach(phaseElement => {
            const duration = parseInt(phaseElement.querySelector('.duration-input').value) || 0;
            const unit = parseInt(phaseElement.querySelector('.duration-unit').value) || 1;
            const message = phaseElement.querySelector('.phase-message').value;

            phases.push({
                duration: duration * unit,
                message: message || `Phase ${phases.length + 1}`,
                type: 'custom'
            });
        });

        if (phases.length === 0) {
            alert('Please add at least one phase');
            return;
        }

        const pattern = {
            id: `custom-${Date.now()}`,
            name,
            phases,
            repeat: document.getElementById('pattern-repeat').checked,
            autoStart: document.getElementById('auto-start').checked,
            custom: true
        };

        this.savePattern(pattern);
        this.setPattern(pattern.id);
    }

    loadPattern(patternId) {
        const pattern = this.patterns[patternId];
        if (!pattern) return;

        if (pattern.custom) {
            // Switch to custom pattern view if not already there
            const customButton = document.querySelector('.pattern-btn[data-pattern="custom"]');
            if (!customButton.classList.contains('active')) {
                customButton.click();
            }

            // Clear existing phases
            const phasesList = document.getElementById('phases-list');
            phasesList.innerHTML = '';

            // Load pattern data into editor
            document.getElementById('pattern-name').value = pattern.name;
            document.getElementById('pattern-repeat').checked = pattern.repeat;
            document.getElementById('auto-start').checked = pattern.autoStart !== false;

            // Add phases
            pattern.phases.forEach(phase => {
                this.addPhase();
                const phaseElement = phasesList.lastElementChild;

                // Handle unit selection and duration value
                const durationInput = phaseElement.querySelector('.duration-input');
                const durationUnit = phaseElement.querySelector('.duration-unit');
                if (phase.duration >= 60 && phase.duration % 60 === 0) {
                    durationUnit.value = '60';
                    durationInput.value = phase.duration / 60;
                } else {
                    durationUnit.value = '1';
                    durationInput.value = phase.duration;
                }

                phaseElement.querySelector('.phase-message').value = phase.message;
            });
        }

        this.setPattern(patternId);
    }

    setPattern(patternId) {
        this.reset();
        this.currentPattern = patternId;
        this.patternPhase = 0;

        const pattern = this.patterns[patternId];
        if (pattern) {
            this.timeLeft = pattern.phases[0].duration;
            this.updateDisplay();
            this.updatePhaseInfo(pattern.phases[0]);
            this.updateVisualization(pattern);
            this.renderPhaseTimeline(pattern);
        }
    }

    renderPhaseTimeline(pattern) {
        const container = document.querySelector('.phase-indicators');
        container.innerHTML = '';

        pattern.phases.forEach((phase, index) => {
            const indicator = document.createElement('div');
            indicator.className = `phase-indicator ${phase.type}`;
            indicator.dataset.index = index;
            indicator.dataset.duration = this.formatDuration(phase.duration);

            // Add phase number inside indicator
            const phaseNumber = document.createElement('span');
            phaseNumber.className = 'phase-number';
            phaseNumber.textContent = index + 1;
            indicator.appendChild(phaseNumber);

            if (index === this.patternPhase) {
                indicator.classList.add('active');
            }

            // Show edit button on hover for custom patterns
            if (pattern.custom) {
                const editBtn = document.createElement('button');
                editBtn.className = 'edit-phase-btn';
                editBtn.innerHTML = '✏️';
                editBtn.style.display = 'none';
                editBtn.onclick = (e) => {
                    e.stopPropagation();
                    this.editPhase(index);
                };
                indicator.appendChild(editBtn);

                indicator.addEventListener('mouseenter', () => {
                    editBtn.style.display = 'block';
                });
                indicator.addEventListener('mouseleave', () => {
                    editBtn.style.display = 'none';
                });
            }

            container.appendChild(indicator);

            // Add connecting line if not last phase
            if (index < pattern.phases.length - 1) {
                const line = document.createElement('div');
                line.className = 'phase-connector';
                container.appendChild(line);
            }
        });
    }

    editPhase(index) {
        const pattern = this.patterns[this.currentPattern];
        if (!pattern?.custom) return;

        const phase = pattern.phases[index];
        const indicator = document.querySelector(`.phase-indicator[data-index="${index}"]`);

        // Show edit interface
        indicator.classList.add('editable');
        this.showEditor();

        // Pre-fill phase data
        document.getElementById('phase-duration').value = phase.duration;
        document.getElementById('phase-message').value = phase.message;
        document.getElementById('phase-type').value = phase.type;
    }

    formatDuration(seconds) {
        if (seconds >= 60 && seconds % 60 === 0) {
            return `${seconds / 60}m`;
        }
        return `${seconds}s`;
    }

    jumpToPhase(index) {
        const pattern = this.patterns[this.currentPattern];
        if (!pattern || index >= pattern.phases.length) return;

        this.patternPhase = index;
        this.timeLeft = pattern.phases[index].duration;
        this.updateDisplay();
        this.updatePhaseInfo(pattern.phases[index]);
        this.updateVisualization(pattern);

        // Update active indicator
        document.querySelectorAll('.phase-indicator').forEach((indicator, i) => {
            indicator.classList.toggle('active', i === index);
        });
    }

    createPatternCard(pattern) {
        const card = document.createElement('div');
        card.className = 'pattern-card';
        card.dataset.pattern = pattern.id;

        card.innerHTML = `
            <h3>${pattern.name}</h3>
            <div class="pattern-preview">
                <div class="phase-dots">
                    ${pattern.phases.map(phase => `
                        <span class="dot ${phase.type}">${this.formatDuration(phase.duration)}</span>
                    `).join('')}
                </div>
            </div>
        `;

        return card;
    }

    showEditor() {
        document.querySelector('.edit-overlay').style.display = 'flex';
    }

    hideEditor() {
        document.querySelector('.edit-overlay').style.display = 'none';
    }

    saveEdits() {
        // Save edits will be implemented when we add the editing functionality
        this.hideEditor();
    }

    start() {
        if (!this.isRunning && this.timeLeft > 0) {
            this.isRunning = true;
            document.getElementById('start-timer').disabled = true;
            document.getElementById('pause-timer').disabled = false;

            this.intervalId = setInterval(() => {
                this.timeLeft--;
                this.updateDisplay();

                if (this.timeLeft <= 0) {
                    this.handlePhaseComplete();
                }
            }, 1000);
        }
    }

    pause() {
        if (this.isRunning) {
            this.isRunning = false;
            clearInterval(this.intervalId);
            document.getElementById('start-timer').disabled = false;
            document.getElementById('pause-timer').disabled = true;
        }
    }

    reset() {
        this.pause();
        this.patternPhase = 0;

        const pattern = this.patterns[this.currentPattern];
        if (pattern) {
            this.timeLeft = pattern.phases[0].duration;
            this.updateDisplay();
            this.updatePhaseInfo(pattern.phases[0]);
            this.updateVisualization(pattern);
        } else {
            this.timeLeft = 0;
            this.updateDisplay();
        }

        document.getElementById('start-timer').disabled = false;
        document.getElementById('pause-timer').disabled = true;
    }

    handlePhaseComplete() {
        this.pause();

        const pattern = this.patterns[this.currentPattern];
        if (!pattern) {
            this.notifications.notify({
                title: 'Timer Complete',
                body: 'Your timer has finished!'
            });
            return;
        }

        const currentPhase = pattern.phases[this.patternPhase];

        // Notify user of phase completion
        this.notifications.notify({
            title: pattern.name,
            body: currentPhase.message,
            pattern: this.currentPattern
        });

        // Progress to next phase
        const isLastPhase = this.patternPhase === pattern.phases.length - 1;
        if (isLastPhase && !pattern.repeat) {
            this.reset();
        } else {
            const indicators = document.querySelectorAll('.phase-indicator');
            indicators[this.patternPhase].classList.remove('active');

            this.patternPhase = (this.patternPhase + 1) % pattern.phases.length;
            this.timeLeft = pattern.phases[this.patternPhase].duration;

            // Update UI
            this.updatePhaseInfo(pattern.phases[this.patternPhase]);
            this.updateVisualization(pattern);
            indicators[this.patternPhase].classList.add('active');

            // Ensure active phase is visible in viewport
            indicators[this.patternPhase].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });

            // Auto-start next phase if enabled
            const shouldAutoStart = pattern.custom ? pattern.autoStart !== false : true;
            if (shouldAutoStart) {
                this.start();
            }
        }
    }

    updateDisplay() {
        const hours = Math.floor(this.timeLeft / 3600);
        const minutes = Math.floor((this.timeLeft % 3600) / 60);
        const seconds = this.timeLeft % 60;

        const display = document.querySelector('.timer-display .time');
        display.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    updatePhaseInfo(phase) {
        if (!phase) return;

        const phaseInfo = document.querySelector('.phase-info');
        phaseInfo.textContent = phase.message;
    }

    updateVisualization(pattern) {
        const guide = document.querySelector('.breathing-guide');
        const circle = guide.querySelector('.circle');
        const instruction = guide.querySelector('.instruction');

        if (!pattern || !pattern.visualization) {
            guide.style.display = 'none';
            return;
        }

        guide.style.display = 'block';
        const phase = pattern.phases[this.patternPhase];

        if (phase.type === 'inhale') {
            circle.style.animation = `breathe-in ${phase.duration}s cubic-bezier(0.4, 0, 0.2, 1) forwards`;
        } else if (phase.type === 'exhale') {
            circle.style.animation = `breathe-out ${phase.duration}s cubic-bezier(0.4, 0, 0.2, 1) forwards`;
        } else if (phase.type === 'hold') {
            circle.style.animation = `hold-breath ${phase.duration}s ease infinite`;
        } else {
            circle.style.animation = 'none';
        }

        instruction.textContent = phase.message;
    }
}

// Initialize timer when script is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.Timer = Timer; // Make Timer class globally available
});
