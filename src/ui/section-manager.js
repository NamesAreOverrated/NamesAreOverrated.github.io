/**
 * UI section management functions for pagination and filtering
 */

/**
 * Initialize a section with pagination and search functionality
 * @param {string} sectionType - Type of section (projects, tools, blogs)
 * @param {number} itemsPerPage - Number of items to display per page
 */
function initializeSection(sectionType, itemsPerPage) {
    const container = document.getElementById(`${sectionType}-container`);
    const searchInput = document.getElementById(`search-${sectionType}`);
    const items = document.querySelectorAll(`.${sectionType.slice(0, -1)}-card`);
    const prevButton = document.getElementById(`${sectionType}-prev-page`);
    const nextButton = document.getElementById(`${sectionType}-next-page`);
    const currentPageElem = document.getElementById(`${sectionType}-current-page`);
    const totalPagesElem = document.getElementById(`${sectionType}-total-pages`);

    let currentPage = 1;
    let filteredItems = Array.from(items);

    // Create no results element
    let noResultsElem = document.createElement('div');
    noResultsElem.className = 'no-results';
    noResultsElem.textContent = `No ${sectionType} match your search...`;

    // Initialize pagination
    updatePagination();

    // Make sure to display correct items on initial load
    displayItems();

    // Event listeners
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            const searchTerm = this.value.toLowerCase();

            // Filter items based on search
            filteredItems = Array.from(items).filter(item => {
                const title = item.querySelector('h3').textContent.toLowerCase();
                const description = item.querySelector('p').textContent.toLowerCase();
                const tags = item.getAttribute('data-tags')?.toLowerCase() || '';

                return title.includes(searchTerm) ||
                    description.includes(searchTerm) ||
                    tags.includes(searchTerm);
            });

            // Reset to first page when searching
            currentPage = 1;
            updatePagination();
            displayItems();
        });
    }

    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            updatePagination();
            displayItems();
        }
    });

    nextButton.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            updatePagination();
            displayItems();
        }
    });

    // Functions
    function updatePagination() {
        const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));

        currentPageElem.textContent = currentPage;
        totalPagesElem.textContent = totalPages;

        prevButton.disabled = (currentPage === 1);
        nextButton.disabled = (currentPage === totalPages || totalPages === 0);
    }

    function displayItems() {
        // Hide all items first
        items.forEach(item => item.style.display = 'none');

        // Show no results message if needed
        if (filteredItems.length === 0) {
            if (!document.querySelector(`.${sectionType}-container .no-results`)) {
                container.appendChild(noResultsElem);
            }
            return;
        } else {
            const existingNoResults = document.querySelector(`.${sectionType}-container .no-results`);
            if (existingNoResults) {
                container.removeChild(existingNoResults);
            }
        }

        // Calculate which items to show
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, filteredItems.length);

        // Display only the items for the current page
        for (let i = startIndex; i < endIndex; i++) {
            filteredItems[i].style.display = '';
        }
    }

    // Return methods that can be used externally
    return {
        updatePage: displayItems,
        resetPagination: () => {
            currentPage = 1;
            updatePagination();
            displayItems();
        },
        hide: () => {
            document.getElementById(`${sectionType}-pagination`).style.display = 'none';
        },
        show: () => {
            document.getElementById(`${sectionType}-pagination`).style.display = '';
        }
    };
}

/**
 * Filter blogs by category
 * @param {string} category - Category to filter by
 * @param {Array} allBlogs - All blog posts
 */
function filterBlogsByCategory(category, allBlogs) {
    const container = document.getElementById('blogs-container');
    const blogCards = document.querySelectorAll('.blog-card');

    if (category === 'all') {
        // Show all blogs
        blogCards.forEach(card => card.style.display = '');
        // Re-initialize pagination with all blogs
        initializeSection('blogs', 3);
        return;
    }

    // Hide all blogs first
    blogCards.forEach(card => {
        const categories = card.getAttribute('data-categories');
        if (categories && categories.includes(category)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });

    // Check if any blogs are visible
    let visibleBlogs = 0;
    blogCards.forEach(card => {
        if (card.style.display !== 'none') {
            visibleBlogs++;
        }
    });

    // Show "no results" if no blogs match the category
    let noResultsElem = container.querySelector('.no-results');
    if (visibleBlogs === 0) {
        if (!noResultsElem) {
            noResultsElem = document.createElement('div');
            noResultsElem.className = 'no-results';
            noResultsElem.textContent = `No blog posts found in category: ${category}`;
            container.appendChild(noResultsElem);
        } else {
            noResultsElem.textContent = `No blog posts found in category: ${category}`;
            noResultsElem.style.display = '';
        }
    } else if (noResultsElem) {
        noResultsElem.style.display = 'none';
    }

    // Hide pagination when filtering by category
    document.getElementById('blogs-pagination').style.display = 'none';
}

export { initializeSection, filterBlogsByCategory };
