import TimerNotification from './timer-notification.js';

class Timer {
    constructor() {
        this.timeLeft = 0;
        this.isRunning = false;
        this.intervalId = null;
        this.notifications = new TimerNotification();
        this.currentPattern = null;
        this.patternPhase = 0;
        this.isCountUp = false;
        this.startTime = 0;
        this.elapsedTime = 0;
        this.isEditing = false;
        this.activeSegment = null;
        this.timeSegments = {
            hours: 0,
            minutes: 0,
            seconds: 0
        };

        // Initialize patterns
        this.initializePatterns();
        this.initializeEventListeners();

        // Initialize UI default state
        this.initializeDefaultUIState();
    }

    // Add this new method to initialize default UI state
    initializeDefaultUIState() {
        // Set default phase info message
        const phaseInfo = document.querySelector('.phase-info');
        if (phaseInfo) {
            phaseInfo.textContent = 'Select a pattern to begin';
        }

        // Make sure phase timeline is visible
        const phaseTimeline = document.querySelector('.phase-timeline');
        if (phaseTimeline) {
            phaseTimeline.style.display = 'block';
        }

        // Hide the breathing guide until a pattern is selected
        const breathingGuide = document.querySelector('.breathing-guide');
        if (breathingGuide) {
            breathingGuide.style.display = 'none';
        }
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

    initializeEventListeners() {
        // Pattern selection
        document.querySelector('.pattern-grid').addEventListener('click', (e) => {
            const card = e.target.closest('.pattern-card');
            if (!card) return;

            // Remove active class from all cards
            document.querySelectorAll('.pattern-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            this.setPattern(card.dataset.pattern);
        });

        // Tab navigation
        document.querySelectorAll('.pattern-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Toggle active class for tabs
                document.querySelectorAll('.pattern-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Show/hide relevant content
                if (btn.dataset.pattern === 'countdown') {
                    document.querySelector('.pattern-grid').style.display = 'none';
                    this.setupCustomTimer();
                    // Show the toggle when in custom timer mode
                    document.querySelector('.timer-mode-toggle').style.display = 'flex';
                } else {
                    document.querySelector('.pattern-grid').style.display = 'grid';
                    this.disableTimeEditing();

                    // Hide the toggle when not in custom timer mode
                    document.querySelector('.timer-mode-toggle').style.display = 'none';

                    // Reset phase info when switching to presets tab
                    this.resetPhaseInfo();
                }
            });
        });

        // Timer controls
        document.getElementById('start-timer').addEventListener('click', () => this.start());
        document.getElementById('pause-timer').addEventListener('click', () => this.pause());
        document.getElementById('reset-timer').addEventListener('click', () => this.reset());

        // Count direction toggle
        const countDirectionToggle = document.getElementById('count-direction-toggle');
        if (countDirectionToggle) {
            countDirectionToggle.addEventListener('change', (e) => {
                this.isCountUp = e.target.checked;
                document.querySelector('.toggle-label').textContent = this.isCountUp ? 'Count Up' : 'Count Down';

                // Reset the timer display to 00:00:00 when switching to Count Up
                if (this.isCountUp) {
                    this.timeLeft = 0;
                    this.elapsedTime = 0;
                    this.updateDisplay();
                    this.timeSegments = { hours: 0, minutes: 0, seconds: 0 };

                    // Update phase info
                    document.querySelector('.phase-info').textContent = 'Custom Count Up Timer';
                } else {
                    // Update phase info
                    document.querySelector('.phase-info').textContent = 'Custom Countdown Timer';
                }
            });
        }

        // Timer display click for editing
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.addEventListener('click', (e) => {
                if (this.currentPattern === 'custom' && !this.isRunning) {
                    this.enableTimeEditing();

                    // Determine which segment was clicked
                    const rect = timerDisplay.getBoundingClientRect();
                    const clickPosition = e.clientX - rect.left;
                    const segmentWidth = rect.width / 3;

                    if (clickPosition < segmentWidth) {
                        this.setActiveSegment('hours');
                    } else if (clickPosition < segmentWidth * 2) {
                        this.setActiveSegment('minutes');
                    } else {
                        this.setActiveSegment('seconds');
                    }

                    e.stopPropagation();
                }
            });

            // Handle key events for editing time
            timerDisplay.addEventListener('keydown', (e) => {
                if (!this.isEditing) return;

                e.preventDefault();

                const key = e.key;

                if (key >= '0' && key <= '9') {
                    this.updateSegmentValue(this.activeSegment, key);
                } else if (key === 'ArrowLeft') {
                    this.navigateSegment('prev');
                } else if (key === 'ArrowRight') {
                    this.navigateSegment('next');
                } else if (key === 'Tab') {
                    this.navigateSegment(e.shiftKey ? 'prev' : 'next');
                } else if (key === 'Enter') {
                    this.disableTimeEditing();
                } else if (key === 'Escape') {
                    this.disableTimeEditing();
                } else if (key === 'Backspace' || key === 'Delete') {
                    this.resetSegmentValue(this.activeSegment);
                }
            });
        }

        // Click outside to exit editing mode
        document.addEventListener('click', (e) => {
            if (this.isEditing && !e.target.closest('#timer-display')) {
                this.disableTimeEditing();
            }
        });

        // Phase timeline interaction
        document.querySelector('.phase-indicators').addEventListener('click', (e) => {
            const indicator = e.target.closest('.phase-indicator');
            if (!indicator) return;

            const phaseIndex = parseInt(indicator.dataset.index);
            if (!this.isRunning) {
                this.jumpToPhase(phaseIndex);
            }
        });

        // Edit controls
        document.getElementById('cancel-edit').addEventListener('click', () => {
            this.hideEditor();
        });
    }

    enableTimeEditing() {
        const timerDisplay = document.getElementById('timer-display');
        if (!timerDisplay) return;

        this.isEditing = true;
        timerDisplay.classList.add('editable', 'editing');
        timerDisplay.setAttribute('tabindex', '0');
        timerDisplay.focus();

        // Parse current time
        const timeText = timerDisplay.textContent;
        const [hours, minutes, seconds] = timeText.split(':').map(val => parseInt(val, 10));

        this.timeSegments = {
            hours: hours || 0,
            minutes: minutes || 0,
            seconds: seconds || 0
        };

        this.renderEditableTime();
    }

    disableTimeEditing() {
        const timerDisplay = document.getElementById('timer-display');
        if (!timerDisplay) return;

        this.isEditing = false;
        timerDisplay.classList.remove('editing');
        timerDisplay.removeAttribute('contenteditable');

        // Update the timer with the new time values
        if (this.currentPattern === 'custom') {
            const { hours, minutes, seconds } = this.timeSegments;
            this.timeLeft = hours * 3600 + minutes * 60 + seconds;
            this.startTime = this.timeLeft;
            this.updateDisplay();
        }
    }

    setActiveSegment(segment) {
        this.activeSegment = segment;
        this.renderEditableTime();
    }

    navigateSegment(direction) {
        const segments = ['hours', 'minutes', 'seconds'];
        const currentIndex = segments.indexOf(this.activeSegment);
        let newIndex;

        if (direction === 'next') {
            newIndex = (currentIndex + 1) % segments.length;
        } else {
            newIndex = (currentIndex - 1 + segments.length) % segments.length;
        }

        this.setActiveSegment(segments[newIndex]);
    }

    updateSegmentValue(segment, digit) {
        const value = parseInt(digit, 10);
        const currentValue = this.timeSegments[segment];

        let newValue;
        const maxValue = segment === 'hours' ? 99 : 59;

        // Shift and add the new digit
        newValue = (currentValue * 10 + value) % (maxValue + 1);
        this.timeSegments[segment] = newValue;

        this.renderEditableTime();
    }

    resetSegmentValue(segment) {
        this.timeSegments[segment] = 0;
        this.renderEditableTime();
    }

    renderEditableTime() {
        const timerDisplay = document.getElementById('timer-display');
        if (!timerDisplay) return;

        const { hours, minutes, seconds } = this.timeSegments;

        const hoursHtml = `<span class="time-segment ${this.activeSegment === 'hours' ? 'active' : ''}">${hours.toString().padStart(2, '0')}</span>`;
        const minutesHtml = `<span class="time-segment ${this.activeSegment === 'minutes' ? 'active' : ''}">${minutes.toString().padStart(2, '0')}</span>`;
        const secondsHtml = `<span class="time-segment ${this.activeSegment === 'seconds' ? 'active' : ''}">${seconds.toString().padStart(2, '0')}</span>`;

        timerDisplay.innerHTML = `${hoursHtml}<span class="time-segment-separator">:</span>${minutesHtml}<span class="time-segment-separator">:</span>${secondsHtml}`;
    }

    setupCustomTimer() {
        // Set up the timer display for custom countdown/up
        this.currentPattern = 'custom';

        // Initialize timeSegments before reset to avoid null reference issues
        this.timeSegments = {
            hours: 0,
            minutes: 0,
            seconds: 0
        };

        this.reset();

        // Get timer display and make it editable
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.classList.add('editable');
        }

        // Keep phase timeline visible but empty it
        const phaseTimeline = document.querySelector('.phase-timeline');
        if (phaseTimeline) {
            phaseTimeline.style.display = 'block';
            const phaseIndicators = document.querySelector('.phase-indicators');
            if (phaseIndicators) {
                // Simply clear the indicators without adding the empty-timeline message
                phaseIndicators.innerHTML = '';
            }
        }

        // Hide only the breathing guide for custom timer
        document.querySelector('.breathing-guide').style.display = 'none';

        // Update phase info based on toggle state and make it clickable
        const phaseInfo = document.querySelector('.phase-info');
        if (phaseInfo) {
            this.updateDirectionIndicator();
            phaseInfo.classList.add('clickable');

            // Add click handler if not already added
            if (!phaseInfo.hasClickHandler) {
                // Store the handler function so we can remove it later
                phaseInfo._clickHandler = () => {
                    if (this.currentPattern === 'custom' && !this.isRunning) {
                        // Toggle count direction
                        this.isCountUp = !this.isCountUp;

                        // Update the hidden checkbox (to maintain synchronization)
                        const toggle = document.getElementById('count-direction-toggle');
                        if (toggle) toggle.checked = this.isCountUp;

                        this.updateDirectionIndicator();

                        // Reset timer values for the new mode
                        if (this.isCountUp) {
                            this.timeLeft = 0;
                            this.elapsedTime = 0;
                        } else {
                            this.updateCustomTime();
                        }
                        this.updateDisplay();
                    }
                };

                phaseInfo.addEventListener('click', phaseInfo._clickHandler);
                phaseInfo.hasClickHandler = true;
            }
        }

        if (this.isCountUp) {
            this.timeLeft = 0;
            this.elapsedTime = 0;
        } else {
            this.timeLeft = 0; // Default to 0, user will set it by clicking on timer
        }
        this.updateDisplay();
    }

    updateCustomTime() {
        if (this.currentPattern !== 'custom') return;

        // Instead of trying to get values from non-existent input elements,
        // use the timeSegments object which is already maintained throughout the app
        const { hours, minutes, seconds } = this.timeSegments;

        // Set time left for countdown
        this.timeLeft = hours * 3600 + minutes * 60 + seconds;
        this.startTime = this.timeLeft; // Store for reset

        // Update display
        this.updateDisplay();
    }

    setPattern(patternId) {
        // Show timeline and hide custom timer elements
        document.querySelector('.phase-timeline').style.display = 'block';

        // Hide the toggle when using a preset pattern
        document.querySelector('.timer-mode-toggle').style.display = 'none';

        // Reset any custom timer state in phase info
        const phaseInfo = document.querySelector('.phase-info');
        if (phaseInfo) {
            phaseInfo.classList.remove('clickable');
        }

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

            // Show the breathing guide if this pattern has visualization
            const breathingGuide = document.querySelector('.breathing-guide');
            if (breathingGuide) {
                breathingGuide.style.display = pattern.visualization ? 'block' : 'none';
            }
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

            // Add progress fill element to each phase indicator
            const progressFill = document.createElement('div');
            progressFill.className = 'progress-fill';
            indicator.appendChild(progressFill);

            if (index === this.patternPhase) {
                indicator.classList.add('active');
            }

            container.appendChild(indicator);

            // Add connecting line if not last phase
            if (index < pattern.phases.length - 1) {
                const line = document.createElement('div');
                line.className = `phase-connector ${pattern.phases[index + 1].type}`;

                // Add progress fill element for connector
                const connectorFill = document.createElement('div');
                connectorFill.className = 'progress-fill';
                line.appendChild(connectorFill);

                container.appendChild(line);
            }
        });

        // Initialize progress for active phase
        this.updateProgress();
    }

    formatDuration(seconds) {
        if (seconds >= 60) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return remainingSeconds > 0 ?
                `${minutes}m ${remainingSeconds}s` :
                `${minutes}m`;
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

        // Reset progress and update for the new phase
        this.updateProgress();
    }

    hideEditor() {
        document.querySelector('.edit-overlay').style.display = 'none';
    }

    start() {
        if (this.isRunning) return;

        // If in editing mode, exit it
        if (this.isEditing) {
            this.disableTimeEditing();
        }

        if (this.currentPattern === 'custom' && this.timeLeft === 0 && !this.isCountUp) {
            // Don't start if countdown timer is at 0
            return;
        }

        this.isRunning = true;
        document.getElementById('start-timer').disabled = true;
        document.getElementById('pause-timer').disabled = false;

        // For count up timer, record start time if starting from 0
        if (this.currentPattern === 'custom' && this.elapsedTime === 0) {
            this.elapsedTime = 0;
        }

        this.intervalId = setInterval(() => {
            if (this.currentPattern === 'custom' && this.isCountUp) {
                // Count up logic
                this.elapsedTime++;
                this.timeLeft = this.elapsedTime;
                this.updateDisplay();
            } else {
                // Countdown logic (works for custom and phases)
                this.timeLeft--;
                this.updateDisplay();

                if (this.currentPattern !== 'custom') {
                    this.updateProgress();
                }

                if (this.timeLeft <= 0) {
                    if (this.currentPattern === 'custom') {
                        // Custom countdown finished
                        this.pause();
                        this.notifications.notify({
                            title: 'Custom Timer',
                            body: 'Your timer has finished!'
                        });
                    } else {
                        // Phase timer finished
                        this.handlePhaseComplete();
                    }
                }
            }
        }, 1000);
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

        if (this.currentPattern === 'custom') {
            // Reset custom timer
            if (this.isCountUp) {
                this.timeLeft = 0;
                this.elapsedTime = 0;
            } else {
                // Reset to existing time segments for countdown
                this.updateCustomTime();
            }
            this.updateDisplay();
            this.updateDirectionIndicator();
        } else {
            // Reset pattern timer
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

            // Reset progress fills
            document.querySelectorAll('.progress-fill').forEach(fill => {
                fill.style.width = '0%';
            });
            document.querySelectorAll('.phase-indicator .progress-fill').forEach(fill => {
                fill.style.height = '0%';
            });
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

            // Reset and start the progress for the new phase
            this.updateProgress();

            // Auto-start next phase
            this.start();
        }
    }

    updateDisplay() {
        const hours = Math.floor(this.timeLeft / 3600);
        const minutes = Math.floor((this.timeLeft % 3600) / 60);
        const seconds = this.timeLeft % 60;

        const display = document.querySelector('.timer-display .time');
        if (!this.isEditing) {
            display.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }

        // When in custom mode, also update the timeSegments object
        if (this.currentPattern === 'custom') {
            this.timeSegments.hours = hours;
            this.timeSegments.minutes = minutes;
            this.timeSegments.seconds = seconds;
        }
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

        // Remove this line that duplicates the phase info
        // instruction.textContent = phase.message;
    }

    // Updated method to update progress display
    updateProgress() {
        const pattern = this.patterns[this.currentPattern];
        if (!pattern) return;

        const phases = pattern.phases;
        const currentPhase = phases[this.patternPhase];
        const totalDuration = currentPhase.duration;
        const elapsedTime = totalDuration - this.timeLeft;
        const progressPercentage = Math.min((elapsedTime / totalDuration) * 100, 100);

        // Reset all progress fills in connectors (horizontal fill)
        document.querySelectorAll('.phase-connector .progress-fill').forEach(fill => {
            fill.style.width = '0%';
        });

        // Reset all progress fills in indicators (vertical fill)
        document.querySelectorAll('.phase-indicator .progress-fill').forEach(fill => {
            fill.style.height = '0%';
        });

        // Update the current phase's progress fill - vertical water-like fill
        const indicators = document.querySelectorAll('.phase-indicator');
        const currentIndicator = indicators[this.patternPhase];
        if (currentIndicator) {
            const progressFill = currentIndicator.querySelector('.progress-fill');
            if (progressFill) {
                progressFill.style.height = `${progressPercentage}%`;
            }
        }

        // Update progress for connector if not the last phase - horizontal fill
        if (this.patternPhase < phases.length - 1) {
            const connectors = document.querySelectorAll('.phase-connector');
            const currentConnector = connectors[this.patternPhase];
            if (currentConnector) {
                const progressFill = currentConnector.querySelector('.progress-fill');
                if (progressFill) {
                    progressFill.style.width = `${progressPercentage}%`;
                }
            }
        }
    }

    // New method to update the direction indicator in the phase info text
    updateDirectionIndicator() {
        const phaseInfo = document.querySelector('.phase-info');
        if (phaseInfo && this.currentPattern === 'custom') {
            if (this.isCountUp) {
                phaseInfo.innerHTML = '<span class="timer-direction up">⬆</span> Custom Count Up Timer';
            } else {
                phaseInfo.innerHTML = '<span class="timer-direction down">⬇</span> Custom Countdown Timer';
            }
        }
    }

    // Add a new method to reset phase info
    resetPhaseInfo() {
        const phaseInfo = document.querySelector('.phase-info');
        if (phaseInfo) {
            // Remove clickable class and event listener
            phaseInfo.classList.remove('clickable');
            phaseInfo.innerHTML = 'Select a pattern to begin';

            // Remove the click handler
            if (phaseInfo.hasClickHandler) {
                phaseInfo.removeEventListener('click', phaseInfo._clickHandler);
                phaseInfo.hasClickHandler = false;
                delete phaseInfo._clickHandler;
            }
        }
    }
}

// Initialize timer when script is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.Timer = Timer; // Make Timer class globally available

    // Hide the toggle by default on page load
    const toggleElement = document.querySelector('.timer-mode-toggle');
    if (toggleElement) {
        toggleElement.style.display = 'none';
    }

    // Add a forced initialization for routing cases
    if (window.location.hash === '#/timer') {
        setTimeout(() => {
            const timerInstance = new Timer();
            window.timerInstance = timerInstance;

            // Just initialize without adding empty-timeline message
            if (!document.querySelector('.pattern-card.active')) {
                const phaseIndicators = document.querySelector('.phase-indicators');
                if (phaseIndicators) {
                    // Simply clear the indicators
                    phaseIndicators.innerHTML = '';
                }
            }

            // Check if we need to show the countdown tab
            const countdownButton = document.querySelector('.pattern-btn[data-pattern="countdown"]');
            if (countdownButton && countdownButton.classList.contains('active')) {
                timerInstance.setupCustomTimer();
            }
        }, 100); // Short delay to ensure DOM is ready
    }
});
