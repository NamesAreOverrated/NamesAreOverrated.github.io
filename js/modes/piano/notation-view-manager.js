/**
 * Notation View Manager
 * Handles page view logic, visible time windows, and measure visibility
 */
class NotationViewManager {
    constructor(scoreModel) {
        this.scoreModel = scoreModel;

        // Configuration
        this.visibleTimeWindow = 8; // Seconds of music visible at once
        this.pageFlipThreshold = 0.75; // Flip page when reaching 75% of current page

        // State
        this.currentPageStartTime = 0;
        this.currentPageEndTime = 0;
        this.pageRefreshNeeded = true;
        this.startTime = 0;
        this.endTime = 0;
    }

    /**
     * Reset the view state
     */
    reset() {
        this.currentPageStartTime = 0;
        this.currentPageEndTime = 0;
        this.pageRefreshNeeded = true;
        this.startTime = 0;
        this.endTime = 0;
    }

    /**
     * Update the visible time window based on current position
     * @param {number} currentTime Current playback position
     * @returns {boolean} True if the page changed (refresh needed)
     */
    update(currentTime) {
        let needsRefresh = false;

        // Handle playback restart or seek to beginning
        if (currentTime < 0.1 && this.currentPageStartTime > 0) {
            this.reset();
            needsRefresh = true;
        }

        // Check if we need to flip to the next page
        if (this.currentPageEndTime > 0) {
            const pageTimeSpan = this.currentPageEndTime - this.currentPageStartTime;
            const thresholdPosition = this.currentPageStartTime + (pageTimeSpan * this.pageFlipThreshold);

            if (currentTime > thresholdPosition) {
                // We've reached the threshold to flip to next page
                this.pageRefreshNeeded = true;
                this.currentPageStartTime = currentTime;
            }
        }

        // Initialize or refresh page
        if (this.currentPageEndTime === 0 || this.pageRefreshNeeded) {
            this.startTime = Math.max(0, currentTime);
            this.endTime = this.startTime + this.visibleTimeWindow;
            this.currentPageStartTime = this.startTime;
            this.currentPageEndTime = this.endTime;
            this.pageRefreshNeeded = false;
            needsRefresh = true;
        } else {
            // Keep using the current page boundaries
            this.startTime = this.currentPageStartTime;
            this.endTime = this.currentPageEndTime;
        }

        return needsRefresh;
    }

    /**
     * Get the indices of measures visible in the current time window
     * @returns {Array} Array of measure indices
     */
    getVisibleMeasureIndices() {
        if (!this.scoreModel.measures?.length) return [];

        const visibleMeasures = [];

        for (let i = 0; i < this.scoreModel.measures.length; i++) {
            const measure = this.scoreModel.measures[i];
            const measureStart = measure.startPosition;
            const measureEnd = i < this.scoreModel.measures.length - 1
                ? this.scoreModel.measures[i + 1].startPosition
                : measureStart + measure.durationSeconds;

            // Include the measure if any part of it is visible
            if ((measureStart >= this.startTime && measureStart < this.endTime) ||
                (measureEnd > this.startTime && measureEnd <= this.endTime) ||
                (measureStart <= this.startTime && measureEnd >= this.endTime)) {
                visibleMeasures.push(i);
            }

            // Break early if we've gone past the end of our window
            if (measureStart > this.endTime) break;
        }

        return visibleMeasures;
    }
}

window.NotationViewManager = NotationViewManager;
