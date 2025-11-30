/**
 * Note Bar Renderer
 * Handles creation, positioning, and animation of falling note bars
 */
class NoteBarRenderer {
    constructor(container, keyboard) {
        this.container = container;
        this.keyboard = keyboard;
        this.noteBars = [];
        this.lookAheadTime = 4; // Seconds
    }

    /**
     * Update note bars based on current playback state
     * @param {Object} scoreModel The score model
     */
    update(scoreModel) {
        if (!this.container || !scoreModel.notes.length) return;

        // Reset on new playback (start)
        if (scoreModel.currentPosition < 0.1 && this.noteBars.length > 0) {
            this.clear();
        }

        const currentTime = scoreModel.currentPosition;
        const startTime = currentTime - 0.5;
        const endTime = currentTime + this.lookAheadTime;

        // Get visible notes
        const visibleNotes = scoreModel.getVisibleNotes(startTime, endTime);

        // Create missing bars
        this.createMissingBars(visibleNotes);

        // Update positions
        this.updatePositions(currentTime);

        // Cleanup invisible bars
        this.cleanup(startTime);
    }

    /**
     * Create bars for notes that don't have them yet
     * @param {Array} visibleNotes 
     */
    createMissingBars(visibleNotes) {
        if (!visibleNotes?.length) return;

        const fragment = document.createDocumentFragment();
        let newBars = 0;

        for (const note of visibleNotes) {
            const noteId = `${note.id}-${note.start.toFixed(6)}`;

            if (this.noteBars.some(bar => bar.noteId === noteId)) continue;

            const barElement = this.createBarElement(note, noteId);
            if (barElement) {
                fragment.appendChild(barElement.element);
                this.noteBars.push(barElement);
                newBars++;
            }
        }

        if (newBars > 0) {
            this.container.appendChild(fragment);

            // Fade in
            requestAnimationFrame(() => {
                const startIdx = this.noteBars.length - newBars;
                for (let i = startIdx; i < this.noteBars.length; i++) {
                    const bar = this.noteBars[i];
                    if (bar.element) {
                        bar.element.style.transition = 'opacity 0.2s ease-out';
                        bar.element.style.opacity = '0.7';
                    }
                }
            });
        }
    }

    /**
     * Create a single note bar element
     */
    createBarElement(note, noteId) {
        const keyPos = this.keyboard.getKeyPosition(note.noteNumber, this.container);
        if (!keyPos) return null;

        const noteBar = document.createElement('div');
        noteBar.className = 'note-bar';
        noteBar.style.opacity = '0';
        noteBar.style.transition = 'none';

        // Styles
        const isBlackKey = [1, 3, 6, 8, 10].includes(note.noteNumber % 12);
        if (isBlackKey) noteBar.classList.add('black-note');

        const isRightHand = note.staff === 1 || (note.staff === undefined && note.noteNumber >= 60);
        noteBar.classList.add(isRightHand ? 'right-hand' : 'left-hand');

        // Initial position calculation to prevent flicker
        const containerHeight = this.container.clientHeight;
        // We can't easily get currentTime here without passing it, but we can default to 0 or just set initial transform
        // The updatePositions loop will fix it immediately anyway.

        // Articulations
        const articulations = {
            staccato: note.staccato,
            accent: note.accent,
            tenuto: note.tenuto,
            fermata: note.fermata,
            tied: note.hasTie,
            'tied-continuation': note.isTiedFromPrevious
        };

        Object.entries(articulations).forEach(([className, condition]) => {
            if (condition) noteBar.classList.add(className);
        });

        // Data attributes
        noteBar.dataset.noteId = noteId;
        noteBar.dataset.duration = note.visualDuration || note.duration;
        noteBar.dataset.start = note.start;

        // Note name
        const noteNameElement = document.createElement('div');
        noteNameElement.className = 'note-name';
        noteNameElement.textContent = note.step + (note.alter === 1 ? '#' : note.alter === -1 ? 'b' : '');
        noteBar.appendChild(noteNameElement);

        return { noteId, element: noteBar, note, keyPos };
    }

    /**
     * Update positions of all note bars
     */
    updatePositions(currentTime) {
        if (!this.container || !this.noteBars.length) return;

        const containerHeight = this.container.clientHeight;
        const timeToPixelRatio = containerHeight / this.lookAheadTime;
        const MIN_NOTE_HEIGHT = 8;

        const updates = [];

        // We need to re-fetch key positions if window resized, but for now we assume keyPos in bar object is valid
        // OR we should re-calculate keyPos if we want to support resize properly.
        // The original code cached keyPositions per frame.

        // Let's re-fetch key positions to be safe on resize, or rely on a "resize" method to invalidate cache.
        // For now, let's just re-calculate keyPos.left/width from the stored keyPos.element if possible, 
        // but we didn't store the element in createBarElement's keyPos.

        // Actually, createBarElement stored `keyPos` which came from `getKeyPosition`.
        // `getKeyPosition` returns {left, width, element}.
        // So we can re-calculate left/width from element.

        const containerRect = this.container.getBoundingClientRect();

        for (const bar of this.noteBars) {
            if (!bar.element || !bar.keyPos.element) continue;

            // Re-calculate key position to handle resizes
            const keyRect = bar.keyPos.element.getBoundingClientRect();
            const left = keyRect.left - containerRect.left + (keyRect.width / 2);
            const width = keyRect.width;

            const note = bar.note;
            const noteStart = note.start;
            const noteDuration = note.visualDuration || note.duration;
            const noteEnd = noteStart + noteDuration;

            // Visibility
            const isPlaying = noteStart <= currentTime && noteEnd > currentTime;
            const isUpcoming = noteStart > currentTime && noteStart <= currentTime + this.lookAheadTime;
            const isPartiallyVisible = noteStart < currentTime && noteEnd > currentTime;
            const isPassed = noteEnd <= currentTime && noteEnd > currentTime - 0.5;
            const isVisible = isPlaying || isUpcoming || isPartiallyVisible || isPassed;

            if (!isVisible) {
                updates.push({ element: bar.element, display: 'none' });
                continue;
            }

            // Position
            const noteHeight = Math.max(MIN_NOTE_HEIGHT, noteDuration * timeToPixelRatio);
            let topPosition = 0;
            let opacity = 1;

            if (isPlaying || isPartiallyVisible) {
                const elapsedTime = currentTime - noteStart;
                const remainingDuration = Math.max(0, noteDuration - elapsedTime);
                topPosition = containerHeight - (remainingDuration * timeToPixelRatio);
            } else if (isUpcoming) {
                const timeToStart = noteStart - currentTime;
                topPosition = containerHeight - (timeToStart * timeToPixelRatio) - noteHeight;
            } else if (isPassed) {
                opacity = Math.max(0, 0.5 - (currentTime - noteEnd));
                topPosition = containerHeight;
            }

            const finalHeight = note.staccato ? noteHeight * 0.7 : noteHeight;

            updates.push({
                element: bar.element,
                display: 'block',
                x: left - (width / 2),
                y: topPosition,
                width: width,
                height: finalHeight,
                opacity: note.accent ? 0.95 : opacity,
                isPlaying
            });
        }

        // Batch DOM updates
        if (updates.length > 0) {
            requestAnimationFrame(() => {
                for (const data of updates) {
                    const el = data.element;
                    el.style.display = data.display;
                    if (data.display === 'block') {
                        el.style.transform = `translate3d(${data.x}px, ${data.y}px, 0)`;
                        el.style.width = `${data.width}px`;
                        el.style.height = `${data.height}px`;
                        el.style.opacity = data.opacity;
                        el.classList.toggle('playing', data.isPlaying);
                    }
                }
            });
        }
    }

    /**
     * Cleanup invisible bars
     */
    cleanup(threshold) {
        const removeList = [];
        for (let i = 0; i < this.noteBars.length; i++) {
            const bar = this.noteBars[i];
            const noteEnd = bar.note.start + (bar.note.visualDuration || bar.note.duration);

            if (noteEnd < threshold) {
                removeList.push(i);
                if (bar.element?.parentNode) {
                    bar.element.parentNode.removeChild(bar.element);
                }
            }
        }

        for (let i = removeList.length - 1; i >= 0; i--) {
            this.noteBars.splice(removeList[i], 1);
        }
    }

    /**
     * Clear all bars
     */
    clear() {
        this.noteBars.forEach(bar => {
            if (bar.element?.parentNode) {
                bar.element.parentNode.removeChild(bar.element);
            }
        });
        this.noteBars = [];
        if (this.container) this.container.innerHTML = '';
    }
}

window.NoteBarRenderer = NoteBarRenderer;
