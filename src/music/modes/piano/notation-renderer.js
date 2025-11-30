/**
 * Notation Renderer
 * Coordinator for musical notation rendering
 */
class NotationRenderer {
    constructor(scoreModel, container) {
        this.scoreModel = scoreModel;
        this.container = container;

        // Components
        this.viewManager = new NotationViewManager(scoreModel);
        this.vfAdapter = new VexFlowAdapter(container);
        this.chordOverlay = new ChordOverlay(container);

        // State
        this.positionIndicator = null;
        this._lastFullRender = 0;
        this.lastRecordedPosition = 0;

        // Bind methods
        this.renderNotation = this.renderNotation.bind(this);
        this.updatePositionIndicator = this.updatePositionIndicator.bind(this);

        this.setupScoreModelListeners();
    }

    setupScoreModelListeners() {
        this.scoreModel.addEventListener('play', () => {
            if (this.scoreModel.currentPosition < 0.1) {
                this.viewManager.reset();
                requestAnimationFrame(() => this.renderNotation(true));
            }
        });

        this.scoreModel.addEventListener('stop', () => {
            this.viewManager.reset();
            requestAnimationFrame(() => this.renderNotation(true));
        });

        this.scoreModel.addEventListener('positionchange', (data) => {
            if (Math.abs(this.lastRecordedPosition - data.position) > 1.0) {
                this.viewManager.pageRefreshNeeded = true;
            }
            this.lastRecordedPosition = data.position;
        });
    }

    /**
     * Main render loop
     */
    async renderNotation(forceRender = false) {
        if (!this.scoreModel.notes.length || !this.container) return;

        const isAtBeginning = this.scoreModel.currentPosition < 0.1;
        if (isAtBeginning && this._lastFullRender > 0) forceRender = true;

        try {
            await this.vfAdapter.loadVexFlow();

            const now = performance.now();
            const currentTime = this.scoreModel.currentPosition;
            const pageChanged = this.viewManager.update(currentTime);

            if (!forceRender && !pageChanged && this._lastFullRender && now - this._lastFullRender < 500) {
                this.updatePositionIndicator();
                return;
            }

            this._lastFullRender = now;
            this.vfAdapter.initContainer();

            const visibleIndices = this.viewManager.getVisibleMeasureIndices();
            if (!visibleIndices.length) {
                console.warn("No visible measures");
                return;
            }

            // Render VexFlow
            const measurePositions = this.vfAdapter.render(this.scoreModel, visibleIndices);

            // Render Chords
            const visibleNotes = this.vfAdapter.getNotesForMeasures(this.scoreModel, visibleIndices);
            this.chordOverlay.render(
                visibleNotes,
                this.viewManager.startTime,
                this.viewManager.endTime,
                measurePositions,
                this.vfAdapter.svgContainer
            );

            // Position Indicator
            this.createPositionIndicator();
            this.updatePositionIndicator(true);

        } catch (error) {
            console.error('Error rendering notation:', error);
            this.renderSimpleNotation();
        }
    }

    createPositionIndicator() {
        if (this.positionIndicator) this.positionIndicator.remove();
        this.positionIndicator = document.createElement('div');
        this.positionIndicator.className = 'notation-position-indicator';
        this.container.appendChild(this.positionIndicator);
    }

    updatePositionIndicator(forceUpdate = false) {
        if (!this.positionIndicator || (!this.scoreModel.isPlaying && !forceUpdate)) return;

        const currentTime = this.scoreModel.currentPosition;
        let indicatorPosition = null;

        for (const [idx, data] of this.vfAdapter.measurePositions.entries()) {
            if (currentTime >= data.startTime && currentTime <= data.endTime) {
                const progress = (currentTime - data.startTime) / (data.endTime - data.startTime);
                indicatorPosition = data.x + (data.width * progress);
                break;
            }
        }

        if (indicatorPosition !== null) {
            this.positionIndicator.style.left = `${indicatorPosition}px`;
            this.positionIndicator.style.display = 'block';
        } else {
            this.positionIndicator.style.display = 'none';
        }

        this.chordOverlay.updateHighlight(currentTime);
    }

    renderSimpleNotation() {
        if (!this.container || !this.scoreModel.notes.length) return;
        this.container.innerHTML = '';
        const simple = document.createElement('div');
        simple.className = 'simple-notation';

        const visibleNotes = this.scoreModel.notes.filter(n => {
            const dur = n.visualDuration || n.duration;
            return (n.start >= this.viewManager.startTime && n.start < this.viewManager.endTime) ||
                (n.start < this.viewManager.startTime && n.start + dur > this.viewManager.startTime);
        }).sort((a, b) => a.start - b.start);

        const list = document.createElement('ul');
        for (const n of visibleNotes) {
            const name = `${n.step}${n.alter === 1 ? '#' : n.alter === -1 ? 'b' : ''}${n.octave}`;
            const isPlaying = n.start <= this.scoreModel.currentPosition &&
                (n.start + (n.visualDuration || n.duration) > this.scoreModel.currentPosition);

            const item = document.createElement('li');
            if (isPlaying) item.className = 'playing-note';
            item.innerHTML = `<span>${name}</span>`;
            list.appendChild(item);
        }
        simple.appendChild(list);
        this.container.appendChild(simple);
    }

    cleanup() {
        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.vfAdapter.cleanup();
        this.chordOverlay.cleanup();
        if (this.positionIndicator) this.positionIndicator.remove();
        if (this.container) this.container.innerHTML = '';
        this.viewManager.reset();
    }
}

window.NotationRenderer = NotationRenderer;
