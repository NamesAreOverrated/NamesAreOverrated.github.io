/**
 * Music Score Model
 * Central model for managing music score data, playback state, and timing
 * Provides synchronization between different visualizations
 */
class MusicScoreModel {
    constructor() {
        // Score metadata
        this.title = '';
        this.composer = '';

        // Musical data
        this.notes = [];
        this.measures = [];
        this.timeSignatures = [];
        this.tempoChanges = [];

        // State
        this.isPlaying = false;
        this.currentPosition = 0;
        this.previousPosition = 0;
        this.bpm = 120;

        // Playback
        this.playbackStartTime = 0;
        this.pauseTime = 0;
        this.animationFrameId = null;

        // Event listeners
        this.eventListeners = {
            'play': [],
            'pause': [],
            'stop': [],
            'positionchange': [],
            'tempochange': [],
            'loaded': []
        };

        // Bind methods for playback
        this.updatePlayback = this.updatePlayback.bind(this);
    }

    /**
     * Set the score data from parsed MusicXML
     * @param {Object} data The parsed score data
     */
    setScoreData(data) {
        this.title = data.title || 'Untitled Score';
        this.composer = data.composer || '';

        // Store musical content
        this.notes = data.notes || [];
        this.measures = data.measures || [];
        this.timeSignatures = data.timeSignatures || [];
        this.tempoChanges = data.tempoChanges || [];

        // Set initial tempo
        if (this.tempoChanges.length > 0) {
            this.bpm = this.tempoChanges[0].tempo;
        }

        // Reset position
        this.currentPosition = 0;
        this.previousPosition = 0;

        // Trigger loaded event
        this.triggerEvent('loaded', { title: this.title });
    }

    /**
     * Start or resume playback
     */
    play() {
        if (this.isPlaying) return;

        this.isPlaying = true;

        // Use performance.now() for more accurate timing when available
        const now = performance && performance.now ? performance.now() : Date.now();

        // If paused, resume from pause time
        if (this.pauseTime > 0) {
            const pauseDuration = now - this.pauseTime;
            this.playbackStartTime += pauseDuration;
            this.pauseTime = 0;
        } else {
            // Starting fresh - convert currentPosition to milliseconds
            this.playbackStartTime = now - (this.currentPosition * 1000);
        }

        // Start animation loop
        this.animationFrameId = requestAnimationFrame(this.updatePlayback);

        // Trigger play event
        this.triggerEvent('play', { position: this.currentPosition });
    }

    /**
     * Pause playback
     */
    pause() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        this.pauseTime = Date.now();

        // Stop animation loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Trigger pause event
        this.triggerEvent('pause', { position: this.currentPosition });
    }

    /**
     * Stop playback and return to beginning
     */
    stop() {
        this.isPlaying = false;
        this.pauseTime = 0;

        // Stop animation loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Reset position
        this.previousPosition = this.currentPosition;
        this.currentPosition = 0;

        // Trigger stop event
        this.triggerEvent('stop', { position: 0 });
    }

    /**
     * Seek to a specific position in the score
     * @param {number} position Position in seconds
     */
    seekTo(position) {
        this.previousPosition = this.currentPosition;
        this.currentPosition = Math.max(0, position);

        // If playing, adjust the start time to maintain continuity
        if (this.isPlaying) {
            if (performance && performance.now) {
                this.playbackStartTime = performance.now() - (this.currentPosition * 1000);
            } else {
                this.playbackStartTime = Date.now() - (this.currentPosition * 1000);
            }
        }

        // Trigger position change event
        this.triggerEvent('positionchange', {
            position: this.currentPosition,
            previousPosition: this.previousPosition
        });
    }

    /**
     * Set the tempo (BPM)
     * @param {number} bpm Beats per minute
     */
    setTempo(bpm) {
        if (bpm === this.bpm) return;

        const oldBpm = this.bpm;
        this.bpm = Math.max(40, Math.min(240, bpm));

        // If we have notes, need to adjust timing
        if (this.isPlaying && this.notes.length > 0) {
            // When changing tempo during playback, we need to adjust the playbackStartTime
            // to ensure the current position stays at the same musical point
            const currentMusicalPosition = this.currentPosition;

            // Adjust playback start time to maintain musical position with new tempo
            if (performance && performance.now) {
                this.playbackStartTime = performance.now() - (currentMusicalPosition * 1000);
            } else {
                this.playbackStartTime = Date.now() - (currentMusicalPosition * 1000);
            }
        }

        // Trigger tempo change event
        this.triggerEvent('tempochange', {
            tempo: this.bpm,
            oldTempo: oldBpm
        });
    }

    /**
     * Update playback position based on elapsed time
     * @param {number} timestamp Animation frame timestamp
     */
    updatePlayback(timestamp) {
        if (!this.isPlaying) return;

        // Calculate current position from elapsed time - more precise calculation
        this.previousPosition = this.currentPosition;

        // Use high-resolution timing when available for smoother animation
        if (performance && performance.now) {
            const elapsedSeconds = (performance.now() - this.playbackStartTime) / 1000;
            this.currentPosition = elapsedSeconds;
        } else {
            this.currentPosition = (Date.now() - this.playbackStartTime) / 1000;
        }

        // Check for tempo changes at current position and make necessary adjustments
        this.updateTempoAtPosition();

        // Trigger position change event
        this.triggerEvent('positionchange', {
            position: this.currentPosition,
            previousPosition: this.previousPosition
        });

        // Check if we've reached the end of the score
        if (this.hasReachedEnd()) {
            this.stop();
            return;
        }

        // Continue animation loop with timing optimization
        if (window.requestAnimationFrame) {
            this.animationFrameId = requestAnimationFrame(this.updatePlayback);
        } else {
            // Fallback for browsers without requestAnimationFrame
            this.animationFrameId = setTimeout(() => this.updatePlayback(Date.now()), 16);
        }
    }

    /**
     * Check if playback has reached the end of the score
     * @returns {boolean} True if reached the end
     */
    hasReachedEnd() {
        if (!this.notes.length) return false;

        // Find the last note's end time
        const lastNote = [...this.notes].sort((a, b) => {
            const aEnd = a.start + (a.visualDuration || a.duration);
            const bEnd = b.start + (b.visualDuration || b.duration);
            return bEnd - aEnd;
        })[0];

        if (!lastNote) return false;

        const lastNoteEnd = lastNote.start + (lastNote.visualDuration || lastNote.duration);

        // Consider finished if 2 seconds past the last note
        return this.currentPosition > lastNoteEnd + 2;
    }

    /**
     * Update tempo based on tempo changes at current position
     */
    updateTempoAtPosition() {
        if (!this.tempoChanges || this.tempoChanges.length <= 1) return;

        // Find the latest tempo change that's before or at the current position
        let currentTempo = this.tempoChanges[0].tempo;
        let tempoChangeApplied = false;
        let tempoChangePosition = 0;

        for (let i = 1; i < this.tempoChanges.length; i++) {
            const tempoChange = this.tempoChanges[i];

            if (tempoChange.position <= this.currentPosition) {
                // We need to check if we just crossed this tempo change boundary
                if (this.previousPosition < tempoChange.position &&
                    this.currentPosition >= tempoChange.position) {
                    tempoChangeApplied = true;
                    tempoChangePosition = tempoChange.position;
                }

                currentTempo = tempoChange.tempo;
            } else {
                // We've gone past the current position
                break;
            }
        }

        // If tempo has changed, update and trigger event
        if (Math.abs(this.bpm - currentTempo) > 0.01 || tempoChangeApplied) {
            const oldTempo = this.bpm;
            this.bpm = currentTempo;

            // When crossing a tempo change boundary, we need to adjust playbackStartTime
            // to maintain musical position
            if (tempoChangeApplied) {
                // Calculate time elapsed since tempo change point
                const realTimeElapsed = this.currentPosition - tempoChangePosition;

                // Reset the playback start time to adjust for new tempo from this point forward
                if (performance && performance.now) {
                    this.playbackStartTime = performance.now() - (tempoChangePosition * 1000) -
                        (realTimeElapsed * 1000);
                } else {
                    this.playbackStartTime = Date.now() - (tempoChangePosition * 1000) -
                        (realTimeElapsed * 1000);
                }
            }

            this.triggerEvent('tempochange', {
                tempo: this.bpm,
                oldTempo: oldTempo,
                position: this.currentPosition
            });
        }
    }

    /**
     * Get notes visible in the current time window
     * @param {number} startTime Start of visible window in seconds
     * @param {number} endTime End of visible window in seconds
     * @returns {Array} Array of visible notes
     */
    getVisibleNotes(startTime, endTime) {
        return this.notes.filter(note => {
            const noteDuration = note.visualDuration || note.duration;
            const noteEnd = note.start + noteDuration;

            return (
                // Notes starting within window
                (note.start >= startTime && note.start <= endTime) ||

                // Notes currently playing (started before window but still active)
                (note.start < startTime && noteEnd > startTime) ||

                // Notes that begin before window but end within window
                (note.start < startTime && noteEnd > startTime && noteEnd <= endTime)
            );
        });
    }

    /**
     * Get notes that are currently playing at the current position
     * @returns {Array} Array of currently playing notes
     */
    getCurrentlyPlayingNotes() {
        const position = this.currentPosition;

        return this.notes.filter(note => {
            // Skip tied continuation notes
            if (note.isTiedFromPrevious) return false;

            const noteDuration = note.visualDuration || note.duration;
            return note.start <= position && note.start + noteDuration > position;
        });
    }

    /**
     * Get the current measure based on playback position
     * @returns {Object} Current measure data
     */
    getCurrentMeasure() {
        if (!this.measures.length) return null;

        for (let i = this.measures.length - 1; i >= 0; i--) {
            if (this.measures[i].startPosition <= this.currentPosition) {
                return this.measures[i];
            }
        }

        return this.measures[0];
    }

    /**
     * Add an event listener
     * @param {string} event Event name
     * @param {Function} callback Function to call when event is triggered
     */
    addEventListener(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }

        this.eventListeners[event].push(callback);
    }

    /**
     * Remove an event listener
     * @param {string} event Event name
     * @param {Function} callback Function to remove
     */
    removeEventListener(event, callback) {
        if (!this.eventListeners[event]) return;

        this.eventListeners[event] = this.eventListeners[event]
            .filter(listener => listener !== callback);
    }

    /**
     * Trigger an event
     * @param {string} event Event name
     * @param {Object} data Event data
     */
    triggerEvent(event, data) {
        if (!this.eventListeners[event]) return;

        for (const callback of this.eventListeners[event]) {
            callback(data);
        }
    }
}

// Make class available globally
window.MusicScoreModel = MusicScoreModel;
