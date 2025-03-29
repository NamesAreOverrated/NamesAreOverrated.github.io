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
                redirectToHabitTracker();
            }
        }
    },

    init() {
        // Handle initial page load - this will ensure the hash route is handled even on first load
        this.handleRouting();

        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleRouting());

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

// Function to redirect to habit tracker page
function redirectToHabitTracker() {
    // Get base URL for GitHub Pages compatibility
    const baseUrl = getBaseUrl();
    // Redirect to the dedicated habit tracker page
    window.location.href = `${baseUrl}habit-tracker.html`;
}

export default router;
