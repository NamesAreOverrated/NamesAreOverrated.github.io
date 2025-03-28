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
 * Filter items by category
 * @param {string} category - Category to filter by
 * @param {Array} allItems - All items of the specific type
 * @param {string} itemType - Type of items (projects, tools, blogs)
 */
function filterItemsByCategory(category, allItems, itemType) {
    const container = document.getElementById(`${itemType}-container`);
    const itemSelector = itemType === 'blogs' ? '.blog-card' :
        itemType === 'projects' ? '.project-card' : '.tool-card';
    const itemCards = document.querySelectorAll(itemSelector);

    if (category === 'all') {
        // Show all items
        itemCards.forEach(card => card.style.display = '');
        // Re-initialize pagination with all items
        initializeSection(itemType, itemType === 'tools' ? 6 : 3);
        return;
    }

    // Hide all items first
    itemCards.forEach(card => {
        const tags = card.getAttribute('data-tags');
        const categories = card.getAttribute('data-categories'); // For blogs

        if ((tags && tags.includes(category)) ||
            (categories && categories.includes(category))) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });

    // Check if any items are visible
    let visibleItems = 0;
    itemCards.forEach(card => {
        if (card.style.display !== 'none') {
            visibleItems++;
        }
    });

    // Show "no results" if no items match the category
    let noResultsElem = container.querySelector('.no-results');
    if (visibleItems === 0) {
        if (!noResultsElem) {
            noResultsElem = document.createElement('div');
            noResultsElem.className = 'no-results';
            noResultsElem.textContent = `No ${itemType} found in category: ${category}`;
            container.appendChild(noResultsElem);
        } else {
            noResultsElem.textContent = `No ${itemType} found in category: ${category}`;
            noResultsElem.style.display = '';
        }
    } else if (noResultsElem) {
        noResultsElem.style.display = 'none';
    }

    // Hide pagination when filtering by category
    document.getElementById(`${itemType}-pagination`).style.display = 'none';
}

/**
 * Filter blogs by category
 * @param {string} category - Category to filter by
 * @param {Array} allBlogs - All blog posts
 */
function filterBlogsByCategory(category, allBlogs) {
    filterItemsByCategory(category, allBlogs, 'blogs');
}

export { initializeSection, filterBlogsByCategory, filterItemsByCategory };
