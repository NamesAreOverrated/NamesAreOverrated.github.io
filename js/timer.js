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
        this.lastActiveTime = Date.now();
        this.phaseStartTime = null;

        // Initialize patterns
        this.initializePatterns();
        this.initializeEventListeners();

        // Initialize UI default state
        this.initializeDefaultUIState();

        // Handle visibility changes to adjust for background tabs
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
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

        // Disable start button until a valid pattern is selected
        const startButton = document.getElementById('start-timer');
        if (startButton) {
            startButton.disabled = true;
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
            },
            'calm-anxiety': {
                name: '5-2-7 Breathing',
                phases: [
                    { duration: 5, message: 'Breathe in slowly through your nose', type: 'inhale' },
                    { duration: 2, message: 'Pause briefly', type: 'hold' },
                    { duration: 7, message: 'Exhale slowly through your mouth', type: 'exhale' }
                ],
                repeat: true,
                visualization: 'breathing-circle'
            },
            'fun': {
                name: 'Just Have Fun',
                phases: [
                    { duration: 10 * 60, message: 'Time for something fun! No pressure, just enjoy.', type: 'break' }
                ],
                repeat: false
            },
            'meditation': {
                name: 'Quick Meditation',
                phases: [
                    { duration: 5 * 60, message: 'Find a comfortable position and focus on your breath', type: 'focus' }
                ],
                repeat: false,
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

        // Tab navigation - update to show confirmation dialog when needed
        document.querySelectorAll('.pattern-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Check if timer is running or paused and we need confirmation
                if ((this.isRunning || (this.timeLeft > 0 && this.currentPattern)) &&
                    !btn.classList.contains('active')) {

                    // Prevent the default tab switch
                    e.preventDefault();

                    // Show confirmation dialog
                    this.showTabChangeConfirmation(btn);
                    return;
                }

                // If no confirmation needed, proceed with tab change
                this.switchTimerTab(btn);
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
                    document.querySelector('.phase-info').textContent = 'Count Up Timer';
                } else {
                    // Update phase info
                    document.querySelector('.phase-info').textContent = 'Countdown Timer';
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

    // New method to handle tab switching with confirmation
    showTabChangeConfirmation(targetTab) {
        // Create confirmation overlay if it doesn't exist
        let confirmationOverlay = document.querySelector('.tab-change-confirmation');
        if (!confirmationOverlay) {
            confirmationOverlay = document.createElement('div');
            confirmationOverlay.className = 'tab-change-confirmation';
            confirmationOverlay.innerHTML = `
                <div class="confirmation-dialog">
                    <h3>Timer in Progress</h3>
                    <p>Changing tabs will reset your current timer. Are you sure you want to continue?</p>
                    <div class="confirmation-buttons">
                        <button id="cancel-tab-change" class="timer-btn">Cancel</button>
                        <button id="confirm-tab-change" class="timer-btn warning">Continue</button>
                    </div>
                </div>
            `;
            document.querySelector('.timer-container').appendChild(confirmationOverlay);

            // Add event listeners to the buttons
            document.getElementById('cancel-tab-change').addEventListener('click', () => {
                confirmationOverlay.classList.remove('active');
            });
        }

        // Store the target tab to switch to if confirmed
        confirmationOverlay.dataset.targetTab = targetTab.dataset.pattern;

        // Show the confirmation dialog
        confirmationOverlay.classList.add('active');

        // Add event listener for confirmation - use once to prevent multiple handlers
        const confirmBtn = document.getElementById('confirm-tab-change');
        const handleConfirm = () => {
            confirmationOverlay.classList.remove('active');
            this.switchTimerTab(targetTab);
            confirmBtn.removeEventListener('click', handleConfirm);
        };

        // Remove any existing listeners first
        confirmBtn.removeEventListener('click', handleConfirm);
        confirmBtn.addEventListener('click', handleConfirm);
    }

    // New method to actually perform the tab switch
    switchTimerTab(btn) {
        // Toggle active class for tabs
        document.querySelectorAll('.pattern-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Show/hide relevant content
        if (btn.dataset.pattern === 'countdown') {
            document.querySelector('.pattern-grid').style.display = 'none';

            // Reset timer state for custom timer
            this.currentPattern = null; // Reset to force a complete setup
            this.setupCustomTimer();

            // Show the toggle when in custom timer mode
            document.querySelector('.timer-mode-toggle').style.display = 'flex';
        } else {
            document.querySelector('.pattern-grid').style.display = 'grid';
            this.disableTimeEditing();

            // Reset pattern state when switching to presets tab
            this.currentPattern = null;
            this.patternPhase = 0;
            this.timeLeft = 0;
            this.reset();
            this.resetPhaseInfo();

            // Hide the toggle when not in custom timer mode
            document.querySelector('.timer-mode-toggle').style.display = 'none';
        }
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
            this.startTime = this.timeLeft; // Save the initial time for resets
            this.updateDisplay();

            // Update start button state based on new time
            document.getElementById('start-timer').disabled = (this.timeLeft === 0 && !this.isCountUp);
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

        // Store an initial startTime of 0
        this.startTime = 0;

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

                        // Update start button state - enable for countUp, disable for empty countdown
                        document.getElementById('start-timer').disabled = (!this.isCountUp && this.timeLeft === 0);
                    }
                };

                phaseInfo.addEventListener('click', phaseInfo._clickHandler);
                phaseInfo.hasClickHandler = true;
            }
        }

        if (this.isCountUp) {
            this.timeLeft = 0;
            this.elapsedTime = 0;
            // Enable start button for count up mode
            document.getElementById('start-timer').disabled = false;
        } else {
            this.timeLeft = 0; // Default to 0, user will set it by clicking on timer
            // Disable start button until user sets a time
            document.getElementById('start-timer').disabled = true;
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

        // Update start button state based on new time
        document.getElementById('start-timer').disabled = (this.timeLeft === 0);
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

            // Enable start button now that we have a valid pattern
            document.getElementById('start-timer').disabled = false;
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

            // Change: Show duration instead of phase number
            const phaseDuration = document.createElement('span');
            phaseDuration.className = 'phase-duration';
            phaseDuration.textContent = this.formatDuration(phase.duration);
            indicator.appendChild(phaseDuration);

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
        this.phaseStartTime = Date.now(); // Add this to reset phase timing
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

    handleVisibilityChange() {
        const isVisible = document.visibilityState === 'visible';
        console.log(`Visibility changed: ${isVisible ? 'visible' : 'hidden'}`);

        if (isVisible && this.isRunning && this.currentPattern && this.currentPattern !== 'custom') {
            console.log('Tab became visible, checking timer state');

            // Check if we need to update UI
            const pattern = this.patterns[this.currentPattern];
            if (pattern) {
                // Update visualizations
                this.updateVisualization(pattern);
                this.updatePhaseInfo(pattern.phases[this.patternPhase]);
                this.updateProgress();

                // Ensure active phase indicator is highlighted
                document.querySelectorAll('.phase-indicator').forEach((indicator, i) => {
                    indicator.classList.toggle('active', i === this.patternPhase);
                });

                // Make sure the active phase is visible
                const activeIndicator = document.querySelector('.phase-indicator.active');
                if (activeIndicator) {
                    activeIndicator.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'center'
                    });
                }
            }
        }
    }

    start() {
        if (this.isRunning) return;

        // If in editing mode, exit it
        if (this.isEditing) {
            this.disableTimeEditing();
        }

        // Validation checks
        if (!this.currentPattern) {
            console.warn('Cannot start timer: No pattern selected');
            return;
        }

        if (this.currentPattern === 'custom') {
            if (!this.isCountUp && this.timeLeft === 0) {
                console.warn('Cannot start timer: No time set for countdown timer');
                return;
            }
        } else {
            // For preset patterns, ensure timeLeft is valid
            if (this.timeLeft <= 0) {
                console.warn('Cannot start timer: Invalid time left value');
                return;
            }
        }

        this.isRunning = true;
        document.getElementById('start-timer').disabled = true;
        document.getElementById('pause-timer').disabled = false;
        this.lastActiveTime = Date.now();
        this.phaseStartTime = Date.now();

        // For count up timer, record start time if starting from 0
        if (this.currentPattern === 'custom' && this.isCountUp && this.elapsedTime === 0) {
            this.elapsedTime = 0;
        }

        // Update visualization with animations now that timer is running
        if (this.currentPattern !== 'custom') {
            const pattern = this.patterns[this.currentPattern];
            if (pattern && pattern.visualization) {
                this.updateVisualization(pattern);
            }
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
                            title: 'Timer',
                            body: 'Your timer has finished!'
                        });
                    } else {
                        // Phase timer finished - CRITICAL FIX
                        // Don't clear the interval first, let handlePhaseComplete decide
                        this.handlePhaseComplete();
                    }
                }
            }

            this.lastActiveTime = Date.now();
        }, 1000);
    }

    pause() {
        if (this.isRunning) {
            this.isRunning = false;
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            document.getElementById('start-timer').disabled = false;
            document.getElementById('pause-timer').disabled = true;

            // Update visualization to static state when paused
            if (this.currentPattern !== 'custom') {
                const pattern = this.patterns[this.currentPattern];
                if (pattern && pattern.visualization) {
                    this.updateVisualization(pattern);
                }
            }
        }
    }

    reset() {
        this.pause();

        if (this.currentPattern === 'custom') {
            // Reset custom timer
            if (this.isCountUp) {
                this.timeLeft = 0;
                this.elapsedTime = 0;
                // For count up, we can start from 0
                document.getElementById('start-timer').disabled = false;
            } else {
                // For countdown timer, restore to the initial time or saved time segments
                if (this.startTime > 0) {
                    // Restore to the originally set time
                    this.timeLeft = this.startTime;
                    document.getElementById('start-timer').disabled = false;
                } else {
                    // If no start time was set yet, use current time segments
                    this.updateCustomTime();
                    // Disable start button if the time is still 0
                    document.getElementById('start-timer').disabled = (this.timeLeft === 0);
                }
            }
            this.updateDisplay();
            this.updateDirectionIndicator();
        } else if (this.currentPattern) {
            // Reset pattern timer
            const previousPhase = this.patternPhase;
            this.patternPhase = 0;
            const pattern = this.patterns[this.currentPattern];
            if (pattern) {
                this.timeLeft = pattern.phases[0].duration;
                this.updateDisplay();
                this.updatePhaseInfo(pattern.phases[0]);
                this.updateVisualization(pattern);

                // Update the active indicator in the phase timeline
                const indicators = document.querySelectorAll('.phase-indicator');
                if (indicators.length > 0) {
                    // Remove active class from all indicators
                    indicators.forEach(indicator => indicator.classList.remove('active'));
                    // Add active class to first indicator
                    indicators[0].classList.add('active');

                    // Ensure it's visible
                    indicators[0].scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'center'
                    });
                }

                // Enable the start button as we have a valid preset pattern
                document.getElementById('start-timer').disabled = false;
            } else {
                this.timeLeft = 0;
                this.updateDisplay();
                // Disable start button if no valid pattern
                document.getElementById('start-timer').disabled = true;
            }

            // Reset progress fills
            document.querySelectorAll('.progress-fill').forEach(fill => {
                fill.style.width = '0%';
            });
            document.querySelectorAll('.phase-indicator .progress-fill').forEach(fill => {
                fill.style.height = '0%';
            });
        } else {
            // No pattern selected yet
            this.timeLeft = 0;
            this.updateDisplay();
            document.getElementById('start-timer').disabled = true;
        }

        document.getElementById('pause-timer').disabled = true;
    }

    handlePhaseComplete() {
        // Don't clear the interval yet - this is a key part of the fix
        // Only pause when we're actually done with all phases

        const pattern = this.patterns[this.currentPattern];
        if (!pattern) {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            this.notifications.notify({
                title: 'Timer Complete',
                body: 'Your timer has finished!'
            });
            this.isRunning = false;
            document.getElementById('start-timer').disabled = false;
            document.getElementById('pause-timer').disabled = true;
            return;
        }

        const currentPhase = pattern.phases[this.patternPhase];
        const isLastPhase = this.patternPhase === pattern.phases.length - 1;

        // Record the phase we're about to transition from and to
        const currentPhaseIndex = this.patternPhase;
        const nextPhaseIndex = isLastPhase && !pattern.repeat ? null : (this.patternPhase + 1) % pattern.phases.length;

        // Notify user of phase completion
        this.notifications.notify({
            title: pattern.name,
            body: currentPhase.message,
            pattern: this.currentPattern,
            phaseIndex: nextPhaseIndex !== null ? nextPhaseIndex : currentPhaseIndex,
            isLastPhase: isLastPhase && !pattern.repeat
        });

        // Progress to next phase
        if (isLastPhase && !pattern.repeat) {
            // Timer complete
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            this.isRunning = false;
            document.getElementById('start-timer').disabled = false;
            document.getElementById('pause-timer').disabled = true;
        } else {
            // Remove active class from current indicator
            const indicators = document.querySelectorAll('.phase-indicator');
            if (indicators.length > this.patternPhase) {
                indicators[this.patternPhase].classList.remove('active');
            }

            // Move to next phase
            this.patternPhase = (this.patternPhase + 1) % pattern.phases.length;
            this.timeLeft = pattern.phases[this.patternPhase].duration;
            this.phaseStartTime = Date.now();

            // Update UI if we're currently viewing the timer page
            if (window.location.hash === '#/timer') {
                this.updatePhaseInfo(pattern.phases[this.patternPhase]);
                this.updateVisualization(pattern);

                // Add active class to new indicator
                if (indicators.length > this.patternPhase) {
                    indicators[this.patternPhase].classList.add('active');

                    // Ensure active phase is visible in viewport
                    indicators[this.patternPhase].scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                        inline: 'center'
                    });
                }

                // Reset and show progress for the new phase
                this.updateProgress();
            }

            // IMPORTANT FIX: Don't try to call start() again or create new interval
            // Just continue with the existing interval by NOT clearing it above
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

        // Only apply animations if the timer is running
        if (this.isRunning) {
            if (phase.type === 'inhale') {
                circle.style.animation = `breathe-in ${phase.duration}s cubic-bezier(0.4, 0, 0.2, 1) forwards`;
            } else if (phase.type === 'exhale') {
                circle.style.animation = `breathe-out ${phase.duration}s cubic-bezier(0.4, 0, 0.2, 1) forwards`;
            } else if (phase.type === 'hold') {
                circle.style.animation = `hold-breath ${phase.duration}s ease infinite`;
            } else {
                circle.style.animation = 'none';
            }
        } else {
            // When timer is not running, show a static visualization based on phase type
            circle.style.animation = 'none';

            // Set static styles based on the phase type
            if (phase.type === 'inhale') {
                circle.style.transform = 'translate(-50%, -50%) scale(1)';
                circle.style.borderColor = 'var(--accent-color)';
            } else if (phase.type === 'exhale') {
                circle.style.transform = 'translate(-50%, -50%) scale(1.2)';
                circle.style.borderColor = 'var(--text-color)';
            } else if (phase.type === 'hold') {
                circle.style.transform = 'translate(-50%, -50%) scale(1.3)';
                circle.style.borderColor = 'var(--accent-color)';
            } else {
                circle.style.transform = 'translate(-50%, -50%) scale(1)';
                circle.style.borderColor = 'var(--accent-color)';
            }
        }
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
                phaseInfo.innerHTML = '<span class="timer-direction up">⬆</span> Count Up Timer';
            } else {
                phaseInfo.innerHTML = '<span class="timer-direction down">⬇</span> Countdown Timer';
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

// Update initialization to prevent unwanted Timer instances
document.addEventListener('DOMContentLoaded', () => {
    // Make Timer class globally available but don't initialize yet
    window.Timer = Timer;

    // Hide the toggle by default on page load
    const toggleElement = document.querySelector('.timer-mode-toggle');
    if (toggleElement) {
        toggleElement.style.display = 'none';
    }

    // Only initialize if we're on the timer page
    if (window.location.hash === '#/timer') {
        initializeTimer();
    }
});

// Function to initialize timer
function initializeTimer() {
    setTimeout(() => {
        if (!window.timerInstance) {
            console.log('Timer initialized');
            window.timerInstance = new Timer();

            // Check if we need to show the countdown tab
            const countdownButton = document.querySelector('.pattern-btn[data-pattern="countdown"]');
            if (countdownButton && countdownButton.classList.contains('active')) {
                window.timerInstance.setupCustomTimer();
            }
        }
    }, 100); // Short delay to ensure DOM is ready
}
