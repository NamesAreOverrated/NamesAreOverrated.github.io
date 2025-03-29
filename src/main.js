import { initTypingEffect } from './typing-effect.js';
import { loadData, loadBlogs, getBaseUrl } from './utils/data-loader.js';
import router from './router/router.js';
import { renderProjects, renderTools, renderBlogs } from './ui/content-renderer.js';

// Log for debugging
console.log('Main script loading. Current base URL:', getBaseUrl());

// Initialize content on page load
document.addEventListener('DOMContentLoaded', async function () {
    // Set current year in footer
    document.getElementById("year").textContent = new Date().getFullYear();

    try {
        // Load data from JSON files
        console.log('Loading projects data...');
        const projects = await loadData('projects');
        renderProjects(projects);
    } catch (error) {
        console.error("Error loading projects:", error);
        document.getElementById('projects-container').innerHTML =
            '<div class="no-results">Failed to load projects. Please try again later.</div>';
    }

    try {
        console.log('Loading tools data...');
        const tools = await loadData('tools');
        renderTools(tools);
    } catch (error) {
        console.error("Error loading tools:", error);
        document.getElementById('tools-container').innerHTML =
            '<div class="no-results">Failed to load tools. Please try again later.</div>';
    }

    try {
        // Load blogs with better error handling
        console.log('Loading blogs data...');
        const blogs = await loadBlogs();
        renderBlogs(blogs);
    } catch (error) {
        console.error("Error loading blogs:", error);
        document.getElementById('blogs-container').innerHTML =
            '<div class="no-results">Failed to load blogs. Please try again later.</div>';
    }

    // Initialize the router
    router.init();

    // Start typing effect
    initTypingEffect();

    // Initialize habit tracker UI elements
    initializeHabitTrackerUI();

    console.log('Initialization complete');
});

// Set up custom event listeners for habit tracker UI elements
function initializeHabitTrackerUI() {
    // Add event listener for custom category selection
    const habitCategorySelect = document.getElementById('habit-category');
    if (habitCategorySelect) {
        habitCategorySelect.addEventListener('change', function () {
            const customCategoryContainer = document.getElementById('custom-category-container');
            if (customCategoryContainer) {
                if (this.value === 'custom') {
                    customCategoryContainer.style.display = 'block';
                } else {
                    customCategoryContainer.style.display = 'none';
                }
            }
        });
    }

    // Change goal unit based on selected goal type
    const goalTypeSelect = document.getElementById('goal-type');
    if (goalTypeSelect) {
        goalTypeSelect.addEventListener('change', function () {
            const goalUnit = document.getElementById('goal-unit');
            if (goalUnit) {
                const unit = this.value === 'streak' ? 'days' : 'times/week';
                goalUnit.textContent = unit;
            }

            // Adjust max value for frequency goal
            const goalValue = document.getElementById('goal-value');
            if (goalValue) {
                if (this.value === 'frequency') {
                    goalValue.max = 7;
                    if (parseInt(goalValue.value) > 7) goalValue.value = 7;
                } else {
                    goalValue.removeAttribute('max');
                }
            }
        });

        // Set initial state
        const unit = goalTypeSelect.value === 'streak' ? 'days' : 'times/week';
        const goalUnit = document.getElementById('goal-unit');
        if (goalUnit) {
            goalUnit.textContent = unit;
        }
    }
}

// Make router available globally for navigation functions
window.router = router;