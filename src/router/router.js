/**
 * Client-side router for single-page application
 */
import { loadBlogs, loadData, getBaseUrl, normalizeFilename, calculateReadTime } from '../utils/data-loader.js';

// Client-side router
const router = {
    routes: {
        home: {
            path: '',
            handler: () => {
                // Show homepage layout (all sections)
                document.body.classList.remove('viewing-page');
                // Make all sections visible on homepage (about removed)
                document.getElementById('projects').style.display = 'block';
                document.getElementById('tools').style.display = 'block';
                document.getElementById('blogs').style.display = 'block';
                // Hide the dynamic content container
                document.getElementById('page-content').style.display = 'none';
                // Hide habit tracker section
                const habitSection = document.getElementById('habit-tracker-section');
                if (habitSection) habitSection.style.display = 'none';

                // Hide timer section
                const timerSection = document.getElementById('timer-section');
                if (timerSection) timerSection.style.display = 'none';
            }
        },
        blog: {
            path: 'blog',
            handler: (id) => {
                displayBlogPost(id);
            }
        },
        project: {
            path: 'project',
            handler: (id) => {
                displayProject(id);
            }
        },
        tool: {
            path: 'tool',
            handler: (id) => {
                displayTool(id);
            }
        },
        habit: {
            path: 'habit-tracker',
            handler: () => {
                displayHabitTracker();
            }
        },
        timer: {
            path: 'timer',
            handler: () => {
                displayTimer();
            }
        }
    },

    currentRoute: '',

    init() {
        // Store initial route
        this.currentRoute = window.location.hash;

        // Handle initial page load - this will ensure the hash route is handled even on first load
        this.handleRouting();

        // Listen for hash changes
        window.addEventListener('hashchange', () => {
            const previousRoute = this.currentRoute;
            this.currentRoute = window.location.hash;

            // Check if we're navigating away from timer page
            const leavingTimerPage = previousRoute === '#/timer' && this.currentRoute !== '#/timer';
            const enteringTimerPage = previousRoute !== '#/timer' && this.currentRoute === '#/timer';

            // Handle the routing
            this.handleRouting();

            // If entering timer page and we have a saved timer instance, restore timer UI
            if (enteringTimerPage && window.timerInstance) {
                console.log('Router: Returning to timer page, updating UI');
                // Update timer UI without stopping the timer
                restoreTimerUI();
            }
        });

        // If no hash on initial load, default to home
        if (!window.location.hash) {
            window.location.hash = '#/';
        }
    },

    handleRouting() {
        // Get the hash without the # character
        const hash = window.location.hash.substring(1) || '/';

        // Parse the route path and ID
        // Remove the leading slash and split by remaining slashes
        const [routePath, id] = hash.replace(/^\//, '').split('/');

        // Find the matching route or default to home
        const route = Object.values(this.routes).find(r => r.path === routePath) || this.routes.home;

        // Call the route handler with the ID if present
        route.handler(id);

        // Scroll to top when navigating to a new page
        window.scrollTo(0, 0);
    },

    navigateToHome() {
        window.location.hash = '#/';
    }
};

// Function to display a blog post
async function displayBlogPost(id) {
    // Clear any body classes first
    document.body.classList.remove('viewing-timer', 'viewing-habit-tracker');
    document.body.classList.add('viewing-page');

    // Hide all sections properly
    document.getElementById('projects').style.display = 'none';
    document.getElementById('tools').style.display = 'none';
    document.getElementById('blogs').style.display = 'none';
    document.getElementById('timer-section').style.display = 'none';
    document.getElementById('habit-tracker-section').style.display = 'none';
    document.getElementById('page-content').style.display = 'block';

    try {
        // Hide all sections explicitly (about removed)
        document.getElementById('projects').style.display = 'none';
        document.getElementById('tools').style.display = 'none';
        document.getElementById('blogs').style.display = 'none';
        document.getElementById('page-content').style.display = 'block';

        document.body.classList.add('viewing-page');
        const contentContainer = document.getElementById('dynamic-content');
        contentContainer.innerHTML = '<div class="loading">Loading content...</div>';

        const blogs = await loadBlogs();
        const blog = blogs.find(b => b.id === id || normalizeFilename(b.title) === id);

        if (!blog) {
            contentContainer.innerHTML = '<div class="no-results">Blog post not found.</div>';
            return;
        }

        let content = blog.htmlContent || `<p>${blog.content}</p>`;
        const readTime = calculateReadTime(blog.content);

        // Fix image paths in content for GitHub Pages
        const baseUrl = getBaseUrl();
        if (baseUrl !== '/' && content.includes('src=')) {
            // Replace relative image and link paths with baseUrl-prefixed ones
            // Don't replace absolute URLs that start with http/https
            content = content.replace(/(src|href)="(?!http|https|ftp|#)([^"]+)"/g,
                (match, attr, path) => `${attr}="${baseUrl}${path.startsWith('/') ? path.substring(1) : path}"`);
        }

        const categoryTags = blog.categories && blog.categories.length > 0
            ? blog.categories.map(cat => `<span class="tag">${cat}</span>`).join('')
            : '';

        contentContainer.innerHTML = `
                    <div class="content-header">
                        <h1>${blog.title}</h1>
                        <div class="content-meta">
                            ${blog.date ? `<span>Published: ${new Date(blog.date).toLocaleDateString()}</span> • ` : ''}
                            <span>${readTime} min read</span>
                        </div>
                        <div class="blog-categories">
                            ${categoryTags}
                        </div>
                    </div>
                    <div class="content-body">
                        ${content}
                    </div>
                `;
    } catch (error) {
        console.error('Error displaying blog post:', error);
        document.getElementById('dynamic-content').innerHTML =
            '<div class="no-results">Failed to load blog post. Please try again later.</div>';
    }
}

// Function to display a project
async function displayProject(id) {
    // Clear any body classes first
    document.body.classList.remove('viewing-timer', 'viewing-habit-tracker');
    document.body.classList.add('viewing-page');

    // Hide all sections properly
    document.getElementById('projects').style.display = 'none';
    document.getElementById('tools').style.display = 'none';
    document.getElementById('blogs').style.display = 'none';
    document.getElementById('timer-section').style.display = 'none';
    document.getElementById('habit-tracker-section').style.display = 'none';
    document.getElementById('page-content').style.display = 'block';

    try {
        // Hide all sections explicitly (about removed)
        document.getElementById('projects').style.display = 'none';
        document.getElementById('tools').style.display = 'none';
        document.getElementById('blogs').style.display = 'none';
        document.getElementById('page-content').style.display = 'block';

        document.body.classList.add('viewing-page');
        const contentContainer = document.getElementById('dynamic-content');
        contentContainer.innerHTML = '<div class="loading">Loading content...</div>';

        const projects = await loadData('projects');
        const project = projects.find(p => normalizeFilename(p.title) === id);

        if (!project) {
            contentContainer.innerHTML = '<div class="no-results">Project not found.</div>';
            return;
        }

        const tagElements = project.tags && project.tags.length > 0
            ? project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')
            : '';

        // Fix image path for GitHub Pages
        const baseUrl = getBaseUrl();
        const imgSrc = project.image.startsWith('http')
            ? project.image
            : `${baseUrl}${project.image.startsWith('/') ? project.image.substring(1) : project.image}`;

        contentContainer.innerHTML = `
                    <div class="content-header">
                        <h1>${project.title}</h1>
                    </div>
                    <img src="${imgSrc}" alt="${project.title}" class="content-image">
                    <div class="content-body">
                        <p>${project.description}</p>
                        <div class="tags-container">
                            ${tagElements}
                        </div>
                        <p style="margin-top: 1.5rem;">
                            <a href="${project.link}" target="_blank" class="primary-link">View Live Project →</a>
                        </p>
                    </div>
                `;
    } catch (error) {
        console.error('Error displaying project:', error);
        document.getElementById('dynamic-content').innerHTML =
            '<div class="no-results">Failed to load project. Please try again later.</div>';
    }
}

// Function to display a tool
async function displayTool(id) {
    // Clear any body classes first
    document.body.classList.remove('viewing-timer', 'viewing-habit-tracker');
    document.body.classList.add('viewing-page');

    // Hide all sections properly
    document.getElementById('projects').style.display = 'none';
    document.getElementById('tools').style.display = 'none';
    document.getElementById('blogs').style.display = 'none';
    document.getElementById('timer-section').style.display = 'none';
    document.getElementById('habit-tracker-section').style.display = 'none';
    document.getElementById('page-content').style.display = 'block';

    try {
        // Hide all sections explicitly (about removed)
        document.getElementById('projects').style.display = 'none';
        document.getElementById('tools').style.display = 'none';
        document.getElementById('blogs').style.display = 'none';
        document.getElementById('page-content').style.display = 'block';

        document.body.classList.add('viewing-page');
        const contentContainer = document.getElementById('dynamic-content');
        contentContainer.innerHTML = '<div class="loading">Loading content...</div>';

        const tools = await loadData('tools');
        const tool = tools.find(t => normalizeFilename(t.name) === id);

        if (!tool) {
            contentContainer.innerHTML = '<div class="no-results">Tool not found.</div>';
            return;
        }

        const tagElements = tool.tags && tool.tags.length > 0
            ? tool.tags.map(tag => `<span class="tag">${tag}</span>`).join('')
            : '';

        contentContainer.innerHTML = `
                    <div class="content-header">
                        <h1>${tool.name}</h1>
                    </div>
                    <div class="content-body">
                        <p>${tool.description}</p>
                        <div class="tags-container">
                            ${tagElements}
                        </div>
                        <p style="margin-top: 1.5rem;">
                            <a href="${tool.link}" target="_blank" class="primary-link">View Repository →</a>
                        </p>
                    </div>
                `;
    } catch (error) {
        console.error('Error displaying tool:', error);
        document.getElementById('dynamic-content').innerHTML =
            '<div class="no-results">Failed to load tool. Please try again later.</div>';
    }
}

// New function to display the habit tracker
function displayHabitTracker() {
    console.log("Router: Displaying habit tracker");

    // Reset body classes
    document.body.classList.remove('viewing-timer', 'viewing-page');
    document.body.classList.add('viewing-habit-tracker');

    // Hide all sections properly and explicitly
    document.getElementById('projects').style.display = 'none';
    document.getElementById('tools').style.display = 'none';
    document.getElementById('blogs').style.display = 'none';
    document.getElementById('page-content').style.display = 'none';
    document.getElementById('timer-section').style.display = 'none';

    // Show habit tracker section
    const habitSection = document.getElementById('habit-tracker-section');
    if (habitSection) {
        habitSection.style.display = 'block';

        // Wait a brief moment to ensure DOM elements are ready before initializing or refreshing
        setTimeout(() => {
            // Initialize habit tracker if not already done
            if (typeof HabitTracker === 'function' && !window.habitTrackerInstance) {
                window.habitTrackerInstance = new HabitTracker();
                console.log('Habit tracker initialized from router');
            } else if (window.habitTrackerInstance) {
                // If already initialized, refresh the UI
                window.habitTrackerInstance.renderHabits();
                console.log('Habit tracker refreshed from router');
            } else {
                console.warn('Router: HabitTracker class not found. Waiting for script load.');
                // Try again after a longer delay if script might still be loading
                setTimeout(() => {
                    if (typeof HabitTracker === 'function') {
                        window.habitTrackerInstance = new HabitTracker();
                        console.log('Habit tracker initialized after delay from router');
                    } else {
                        console.error('Router: HabitTracker class not available after waiting. Check script loading.');
                    }
                }, 1000);
            }
        }, 100);
    } else {
        console.error('Router: Habit tracker section not found in the DOM');
    }
}

// Function to display the timer section
function displayTimer() {
    console.log("Router: Displaying timer");

    // Reset body classes
    document.body.classList.remove('viewing-habit-tracker', 'viewing-page');
    document.body.classList.add('viewing-timer');

    // Hide all main sections explicitly
    document.getElementById('projects').style.display = 'none';
    document.getElementById('tools').style.display = 'none';
    document.getElementById('blogs').style.display = 'none';
    document.getElementById('page-content').style.display = 'none';
    document.getElementById('habit-tracker-section').style.display = 'none';

    // Show timer section
    const timerSection = document.getElementById('timer-section');
    if (timerSection) {
        timerSection.style.display = 'block';

        // Check if we have phase information in a notification
        const timerNotification = document.getElementById('timer-return-notification');
        let notificationData = null;

        if (timerNotification) {
            // Extract data from notification
            notificationData = {
                pattern: timerNotification.dataset.pattern,
                phaseIndex: parseInt(timerNotification.dataset.phaseIndex),
                isLastPhase: timerNotification.dataset.isLastPhase === 'true'
            };

            // Remove the notification after getting its data
            timerNotification.classList.add('hiding');
            setTimeout(() => {
                if (timerNotification.parentNode) {
                    document.body.removeChild(timerNotification);
                }
            }, 300);
        }

        // Initialize timer if Timer class is available
        if (typeof Timer === 'function') {
            if (!window.timerInstance) {
                console.log('Timer initialized from router');
                window.timerInstance = new Timer();

                // If we have notification data and no timer instance yet
                if (notificationData && notificationData.pattern) {
                    // Set up the pattern that was active in notification
                    window.timerInstance.setPattern(notificationData.pattern);

                    // Jump to the correct phase if needed
                    if (!isNaN(notificationData.phaseIndex)) {
                        window.timerInstance.jumpToPhase(notificationData.phaseIndex);
                    }
                }
            } else {
                // Update the display if timer instance already exists
                console.log('Refreshing timer display');
                restoreTimerUI(notificationData);
            }
        } else {
            console.warn('Router: Timer class not found. Make sure timer.js is loaded correctly.');
        }
    } else {
        console.error('Router: Timer section not found in the DOM');
    }
}

// Function to restore just the timer UI without stopping the timer
function restoreTimerUI(notificationData) {
    if (!window.timerInstance) return;

    console.log('Router: Restoring timer UI with data:', notificationData);

    // If we're returning from a notification with phase information,
    // make sure we update to the correct phase
    if (notificationData &&
        notificationData.pattern === window.timerInstance.currentPattern &&
        !isNaN(notificationData.phaseIndex)) {

        console.log(`Updating timer to phase ${notificationData.phaseIndex} from notification`);

        // Force UI update for the specified phase
        const pattern = window.timerInstance.patterns[window.timerInstance.currentPattern];

        if (pattern) {
            // If timer is running but isn't on the correct phase, update it
            if (window.timerInstance.patternPhase !== notificationData.phaseIndex) {
                // Update phase index without stopping the timer
                window.timerInstance.patternPhase = notificationData.phaseIndex;

                // Only update timeLeft if not running to avoid timer jumps
                if (!window.timerInstance.isRunning) {
                    window.timerInstance.timeLeft = pattern.phases[notificationData.phaseIndex].duration;
                }

                // Update timer visualizations
                window.timerInstance.updateVisualization(pattern);
                window.timerInstance.updatePhaseInfo(pattern.phases[notificationData.phaseIndex]);
            }
        }
    }

    // Make sure disabled state of buttons is correct
    const startButton = document.getElementById('start-timer');
    const pauseButton = document.getElementById('pause-timer');

    // Running state check
    if (window.timerInstance.isRunning) {
        startButton.disabled = true;
        pauseButton.disabled = false;
    } else {
        // For non-running timers, we need more specific validation
        pauseButton.disabled = true;

        // Start button validation - should be disabled if:
        // 1. No pattern is selected
        // 2. Custom countdown timer with time = 0
        if (!window.timerInstance.currentPattern) {
            startButton.disabled = true;
        } else if (window.timerInstance.currentPattern === 'custom' &&
            !window.timerInstance.isCountUp &&
            window.timerInstance.timeLeft === 0) {
            startButton.disabled = true;
        } else {
            startButton.disabled = false;
        }
    }

    // Update the time display
    window.timerInstance.updateDisplay();

    // Restore visualization state if applicable
    if (window.timerInstance.currentPattern && window.timerInstance.currentPattern !== 'custom') {
        const pattern = window.timerInstance.patterns[window.timerInstance.currentPattern];
        if (pattern) {
            // Highlight the correct pattern card
            document.querySelectorAll('.pattern-card').forEach(card => {
                card.classList.toggle('active', card.dataset.pattern === window.timerInstance.currentPattern);
            });

            // Ensure correct phase is highlighted in timeline
            const indicators = document.querySelectorAll('.phase-indicator');
            indicators.forEach((indicator, i) => {
                indicator.classList.toggle('active', i === window.timerInstance.patternPhase);
            });

            // Update progress display
            window.timerInstance.updateProgress();

            // Restart visual elements like breathing circle if they were running
            if (window.timerInstance.isRunning) {
                window.timerInstance.updateVisualization(pattern);
            }

            // Scroll active phase into view
            const activeIndicator = document.querySelector('.phase-indicator.active');
            if (activeIndicator) {
                activeIndicator.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'center'
                });
            }
        }
    } else if (window.timerInstance.currentPattern === 'custom') {
        // Ensure correct tab is active
        document.querySelectorAll('.pattern-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.pattern === 'countdown');
        });

        // Ensure timer mode toggle is visible and in correct state
        document.querySelector('.timer-mode-toggle').style.display = 'flex';

        // Update direction toggle state
        const toggle = document.getElementById('count-direction-toggle');
        if (toggle) toggle.checked = window.timerInstance.isCountUp;

        // Display label
        const toggleLabel = document.querySelector('.toggle-label');
        if (toggleLabel) toggleLabel.textContent = window.timerInstance.isCountUp ? 'Count Up' : 'Count Down';
    }
}

export default router;
