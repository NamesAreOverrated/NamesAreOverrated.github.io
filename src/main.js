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

    console.log('Initialization complete');
});

// Make router available globally for navigation functions
window.router = router;