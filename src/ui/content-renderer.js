/**
 * UI content rendering functions
 */
import { normalizeFilename, calculateReadTime } from '../utils/data-loader.js';
import { initializeSection, filterBlogsByCategory, filterItemsByCategory } from './section-manager.js';

/**
 * Render projects to the DOM
 * @param {Array} projects - Array of project objects
 */
function renderProjects(projects) {
    const container = document.getElementById('projects-container');
    const categoryFiltersContainer = document.getElementById('project-category-filters');
    container.innerHTML = '';

    if (!projects || projects.length === 0) {
        container.innerHTML = '<div class="no-results">No projects found.</div>';
        return;
    }

    // Extract all unique tags/categories from projects
    const allCategories = new Set();
    projects.forEach(project => {
        if (project.tags && Array.isArray(project.tags)) {
            project.tags.forEach(tag => allCategories.add(tag));
        }
    });

    // Clear existing category filters and add the "All" button
    categoryFiltersContainer.innerHTML = '';
    const allFilterButton = document.createElement('button');
    allFilterButton.textContent = 'All';
    allFilterButton.className = 'category-filter active';
    allFilterButton.setAttribute('data-category', 'all');
    allFilterButton.addEventListener('click', function () {
        // Remove active class from all filters
        document.querySelectorAll('#project-category-filters .category-filter').forEach(btn => {
            btn.classList.remove('active');
        });
        // Add active class to this filter
        this.classList.add('active');
        // Show all projects
        filterItemsByCategory('all', projects, 'projects');
    });
    categoryFiltersContainer.appendChild(allFilterButton);

    // Add category filters
    if (allCategories.size > 0) {
        allCategories.forEach(category => {
            const filterButton = document.createElement('button');
            filterButton.textContent = category;
            filterButton.className = 'category-filter';
            filterButton.setAttribute('data-category', category);

            filterButton.addEventListener('click', function () {
                // Remove active class from all filters
                document.querySelectorAll('#project-category-filters .category-filter').forEach(btn => {
                    btn.classList.remove('active');
                });

                // Add active class to clicked filter
                this.classList.add('active');

                // Filter projects by category
                const selectedCategory = this.getAttribute('data-category');
                filterItemsByCategory(selectedCategory, projects, 'projects');
            });

            categoryFiltersContainer.appendChild(filterButton);
        });
    }

    projects.forEach(project => {
        const projectId = normalizeFilename(project.title);
        const projectCard = document.createElement('div');
        projectCard.className = 'project-card';
        projectCard.setAttribute('data-tags', project.tags.join(' '));

        projectCard.innerHTML = `
                    <div class="project-image">
                        <img src="${project.image}" alt="${project.title} Preview">
                    </div>
                    <div class="project-info">
                        <h3>${project.title}</h3>
                        <p>${project.description}</p>
                        <div>
                            ${project.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                        </div>
                        <p><a href="#/project/${projectId}">View Details →</a></p>
                    </div>
                `;
        container.appendChild(projectCard);
    });

    // Initialize pagination after rendering
    initializeSection('projects', 3);
}

/**
 * Render tools to the DOM
 * @param {Array} tools - Array of tool objects
 */
function renderTools(tools) {
    const container = document.getElementById('tools-container');
    const categoryFiltersContainer = document.getElementById('tool-category-filters');
    container.innerHTML = '';

    if (!tools || tools.length === 0) {
        container.innerHTML = '<div class="no-results">No tools found.</div>';
        return;
    }

    // Extract all unique tags/categories from tools
    const allCategories = new Set();
    tools.forEach(tool => {
        if (tool.tags && Array.isArray(tool.tags)) {
            tool.tags.forEach(tag => allCategories.add(tag));
        }
    });

    // Clear existing category filters and add the "All" button
    categoryFiltersContainer.innerHTML = '';
    const allFilterButton = document.createElement('button');
    allFilterButton.textContent = 'All';
    allFilterButton.className = 'category-filter active';
    allFilterButton.setAttribute('data-category', 'all');
    allFilterButton.addEventListener('click', function () {
        // Remove active class from all filters
        document.querySelectorAll('#tool-category-filters .category-filter').forEach(btn => {
            btn.classList.remove('active');
        });
        // Add active class to this filter
        this.classList.add('active');
        // Show all tools
        filterItemsByCategory('all', tools, 'tools');
    });
    categoryFiltersContainer.appendChild(allFilterButton);

    // Add category filters
    if (allCategories.size > 0) {
        allCategories.forEach(category => {
            const filterButton = document.createElement('button');
            filterButton.textContent = category;
            filterButton.className = 'category-filter';
            filterButton.setAttribute('data-category', category);

            filterButton.addEventListener('click', function () {
                // Remove active class from all filters
                document.querySelectorAll('#tool-category-filters .category-filter').forEach(btn => {
                    btn.classList.remove('active');
                });

                // Add active class to clicked filter
                this.classList.add('active');

                // Filter tools by category
                const selectedCategory = this.getAttribute('data-category');
                filterItemsByCategory(selectedCategory, tools, 'tools');
            });

            categoryFiltersContainer.appendChild(filterButton);
        });
    }

    tools.forEach(tool => {
        const toolId = normalizeFilename(tool.name);
        const toolCard = document.createElement('div');
        toolCard.className = 'tool-card';
        toolCard.setAttribute('data-tags', tool.tags.join(' '));

        toolCard.innerHTML = `
                    <h3>${tool.name}</h3>
                    <p>${tool.description}</p>
                    <div>
                        ${tool.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                    <p><a href="#/tool/${toolId}">View Details →</a></p>
                `;
        container.appendChild(toolCard);
    });

    // Initialize pagination after rendering
    initializeSection('tools', 6);
}

/**
 * Render blogs to the DOM with category filters
 * @param {Array} blogs - Array of blog objects
 */
function renderBlogs(blogs) {
    const container = document.getElementById('blogs-container');
    const categoryFiltersContainer = document.getElementById('blog-category-filters');

    container.innerHTML = '';

    if (!blogs || blogs.length === 0) {
        container.innerHTML = '<div class="no-results">No blog posts found.</div>';
        return;
    }

    // Sort blogs by date (newest first) if they have dates
    if (blogs[0].date) {
        blogs.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Extract all unique categories from blogs
    const allCategories = new Set();
    blogs.forEach(blog => {
        if (blog.categories && Array.isArray(blog.categories)) {
            blog.categories.forEach(category => allCategories.add(category));
        }
    });

    // Clear existing category filters and add the "All" button
    categoryFiltersContainer.innerHTML = '';
    const allFilterButton = document.createElement('button');
    allFilterButton.textContent = 'All';
    allFilterButton.className = 'category-filter active';
    allFilterButton.setAttribute('data-category', 'all');
    allFilterButton.addEventListener('click', function () {
        // Remove active class from all filters
        document.querySelectorAll('#blog-category-filters .category-filter').forEach(btn => {
            btn.classList.remove('active');
        });
        // Add active class to this filter
        this.classList.add('active');
        // Show all blogs
        filterBlogsByCategory('all', blogs);
    });
    categoryFiltersContainer.appendChild(allFilterButton);

    // Add category filters
    if (allCategories.size > 0) {
        allCategories.forEach(category => {
            const filterButton = document.createElement('button');
            filterButton.textContent = category;
            filterButton.className = 'category-filter';
            filterButton.setAttribute('data-category', category);

            filterButton.addEventListener('click', function () {
                // Remove active class from all filters
                document.querySelectorAll('.category-filter').forEach(btn => {
                    btn.classList.remove('active');
                });

                // Add active class to clicked filter
                this.classList.add('active');

                // Filter blogs by category
                const selectedCategory = this.getAttribute('data-category');
                filterBlogsByCategory(selectedCategory, blogs);
            });

            categoryFiltersContainer.appendChild(filterButton);
        });
    }

    blogs.forEach(blog => {
        const blogCard = document.createElement('div');
        blogCard.className = 'blog-card';
        if (blog.featured) {
            blogCard.classList.add('featured');
        }

        // Calculate read time
        const readTime = calculateReadTime(blog.content || blog.description);

        // Set data attributes for filtering
        if (blog.categories && Array.isArray(blog.categories)) {
            blogCard.setAttribute('data-categories', blog.categories.join(' '));
        }

        let blogHTML = '';

        if (blog.featured) {
            blogHTML += '<div class="blog-featured-badge">Featured</div>';
        }

        blogHTML += `
                    <h3>${blog.title}</h3>
                    <div class="blog-date">
                        ${blog.date ? `<span>${new Date(blog.date).toLocaleDateString()}</span>` : ''}
                        <span class="blog-read-time">${readTime} min read</span>
                    </div>
                `;

        if (blog.categories && Array.isArray(blog.categories) && blog.categories.length > 0) {
            blogHTML += '<div class="blog-categories">';
            blog.categories.forEach(category => {
                blogHTML += `<span class="tag">${category}</span>`;
            });
            blogHTML += '</div>';
        }

        // Create blog ID if it doesn't exist
        const blogId = blog.id || normalizeFilename(blog.title);

        // Update the link to use our router
        blogHTML += `
                    <p>${blog.description}</p>
                    <p><a href="#/blog/${blogId}">Read More →</a></p>
                `;

        blogCard.innerHTML = blogHTML;
        container.appendChild(blogCard);
    });

    // Initialize pagination after rendering
    initializeSection('blogs', 3);
}

export { renderProjects, renderTools, renderBlogs };
