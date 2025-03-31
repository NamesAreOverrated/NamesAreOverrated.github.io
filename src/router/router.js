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

        // Listen for hash changes with improved timer cleanup
        window.addEventListener('hashchange', () => {
            const previousRoute = this.currentRoute;
            this.currentRoute = window.location.hash;

            // Check if we're navigating away from timer page
            const leavingTimerPage = previousRoute === '#/timer' && this.currentRoute !== '#/timer';

            // Handle the routing
            this.handleRouting();

            // If we were on timer page but now we're navigating elsewhere, clean up
            if (leavingTimerPage) {
                console.log('Router: Leaving timer page, cleaning up timer');
                cleanupTimer();
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
    document.body.classList.remove('viewing-timer', 'viewing-habit-tracker');
    document.body.classList.add('viewing-page');
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
    document.body.classList.remove('viewing-timer', 'viewing-habit-tracker');
    document.body.classList.add('viewing-page');
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
    document.body.classList.remove('viewing-timer', 'viewing-habit-tracker');
    document.body.classList.add('viewing-page');
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
    document.body.classList.remove('viewing-timer', 'viewing-page');
    document.body.classList.add('viewing-habit-tracker');
    console.log("Router: Displaying habit tracker");

    // Hide all sections explicitly (about removed)
    document.getElementById('projects').style.display = 'none';
    document.getElementById('tools').style.display = 'none';
    document.getElementById('blogs').style.display = 'none';
    document.getElementById('page-content').style.display = 'none';

    // Explicitly hide the timer section
    const timerSection = document.getElementById('timer-section');
    if (timerSection) timerSection.style.display = 'none';

    // Show habit tracker section
    const habitSection = document.getElementById('habit-tracker-section');
    if (habitSection) {
        habitSection.style.display = 'block';
        document.body.classList.add('viewing-habit-tracker');

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

    // Hide all main sections
    document.getElementById('projects').style.display = 'none';
    document.getElementById('tools').style.display = 'none';
    document.getElementById('blogs').style.display = 'none';
    document.getElementById('page-content').style.display = 'none';
    document.getElementById('habit-tracker-section').style.display = 'none';

    // Show timer section
    const timerSection = document.getElementById('timer-section');
    if (timerSection) {
        timerSection.style.display = 'block';
        document.body.classList.add('viewing-timer');
        document.body.classList.remove('viewing-habit-tracker', 'viewing-page');

        // Initialize timer if Timer class is available
        if (typeof Timer === 'function') {
            if (!window.timerInstance) {
                console.log('Timer initialized from router');
                window.timerInstance = new Timer();
            }
        } else {
            console.warn('Router: Timer class not found. Make sure timer.js is loaded correctly.');
        }
    } else {
        console.error('Router: Timer section not found in the DOM');
    }
}

// Add a new function to clean up the timer when navigating away
function cleanupTimer() {
    if (window.timerInstance) {
        console.log('Router: Cleaning up timer instance');

        // Pause the timer if it's running
        if (window.timerInstance.isRunning) {
            window.timerInstance.pause();
        }

        // Clear any intervals to ensure nothing runs in background
        if (window.timerInstance.intervalId) {
            clearInterval(window.timerInstance.intervalId);
            window.timerInstance.intervalId = null;
        }

        // Reset any phase info and event handlers
        const phaseInfo = document.querySelector('.phase-info');
        if (phaseInfo && phaseInfo.hasClickHandler) {
            phaseInfo.removeEventListener('click', phaseInfo._clickHandler);
            phaseInfo.hasClickHandler = false;
            delete phaseInfo._clickHandler;
            phaseInfo.classList.remove('clickable');
        }

        // Clean up any animations
        const circleElement = document.querySelector('.breathing-guide .circle');
        if (circleElement) {
            circleElement.style.animation = 'none';
        }

        // Delete the timer instance
        window.timerInstance = null;

        console.log('Router: Timer instance cleanup complete');
    }
}

export default router;
