(function() {
    'use strict';

    let tocOverlay = null;
    let headings = [];
    let currentMaxLevel = 6;
    let observer = null;

    // Dragging variables
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;

    // Check if we're on a Confluence page
    function isConfluencePage() {
        return document.querySelector('#main-content, .wiki-content, .page-content, [data-testid="page-content"]') !== null;
    }

    // Updated extractHeadings function to focus on heading IDs
    function extractHeadings() {
        const contentSelectors = [
            '#main-content',
            '.wiki-content', 
            '.page-content',
            '[data-testid="page-content"]',
            '.content-body'
        ];
        
        let contentArea = null;
        for (const selector of contentSelectors) {
            contentArea = document.querySelector(selector);
            if (contentArea) break;
        }
        
        if (!contentArea) {
            contentArea = document.body;
            console.warn('Confluence TOC: Could not find content area, using document.body instead');
        }

        const headingElements = contentArea.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings = [];

        headingElements.forEach((heading, index) => {
            const level = parseInt(heading.tagName.charAt(1));
            const text = heading.textContent.trim();
            
            if (text) {
                // First check if the heading already has an ID (Confluence's native pattern)
                let id = heading.id;
                
                // If no ID found, create one
                if (!id) {
                    id = `crx-heading-${index}`;
                    heading.id = id; // Add the ID to the heading
                }

                headings.push({
                    element: heading,
                    level: level,
                    text: text,
                    id: id
                });
            }
        });

        return headings;
    }

    // Make TOC draggable
    function makeTocDraggable() {
        const header = tocOverlay.querySelector('.crx-toc-header');
        
        header.addEventListener('mousedown', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);

        function dragStart(e) {
            // Don't drag when clicking on controls (select, close button)
            if (e.target.closest('.crx-toc-controls')) return;
            
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === header || header.contains(e.target)) {
                isDragging = true;
                header.classList.add('dragging');
                tocOverlay.classList.add('draggable');
                e.preventDefault(); // Prevent text selection
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                // Ensure TOC stays within viewport
                const rect = tocOverlay.getBoundingClientRect();
                const maxX = window.innerWidth - rect.width;
                const maxY = window.innerHeight - rect.height;
                
                currentX = Math.max(0, Math.min(currentX, maxX));
                currentY = Math.max(0, Math.min(currentY, maxY));

                // Apply transform and adjust positioning
                tocOverlay.style.transform = `translate(${currentX}px, ${currentY}px)`;
                
                // When dragging, reset alignment classes but keep position
                tocOverlay.classList.remove('crx-toc-left', 'crx-toc-right');
            }
        }

        function dragEnd() {
            if (isDragging) {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
                header.classList.remove('dragging');
                tocOverlay.classList.remove('draggable');
                
                // Save position to storage for this session only
                sessionStorage.setItem('tocPosition', JSON.stringify({ x: currentX, y: currentY }));
            }
        }

        // Check for session-specific position
        const savedPosition = sessionStorage.getItem('tocPosition');
        if (savedPosition) {
            try {
                const position = JSON.parse(savedPosition);
                currentX = position.x;
                currentY = position.y;
                xOffset = currentX;
                yOffset = currentY;
                
                tocOverlay.style.transform = `translate(${currentX}px, ${currentY}px)`;
                tocOverlay.style.right = 'auto';
                tocOverlay.style.left = 'auto';
                tocOverlay.classList.remove('crx-toc-left', 'crx-toc-right');
            } catch (e) {
                console.error('Error parsing saved TOC position:', e);
                
                // Fallback to global alignment
                chrome.storage.sync.get({ tocAlignment: 'right' }, (items) => {
                    applyTocAlignment(items.tocAlignment);
                });
            }
        } else {
            // Use global alignment setting
            chrome.storage.sync.get({ tocAlignment: 'right' }, (items) => {
                applyTocAlignment(items.tocAlignment);
            });
        }
    }

    // Create ToC Overlay
    function createTocOverlay() {
        if (tocOverlay) {
            return tocOverlay;
        }

        tocOverlay = document.createElement('div');
        tocOverlay.className = 'crx-toc-overlay';
        tocOverlay.innerHTML = `
            <div class="crx-toc-header">
                <h3 class="crx-toc-title">Table of Contents</h3>
                <div class="crx-toc-controls">
                    <div class="crx-toc-level-controls">
                        <button class="crx-toc-level-btn crx-toc-decrease" title="Decrease heading level (Shift+Click to collapse all)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 13H5v-2h14v2z"/>
                            </svg>
                        </button>
                        <span class="crx-toc-level-indicator">All</span>
                        <button class="crx-toc-level-btn crx-toc-increase" title="Increase heading level (Shift+Click to expand all)">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                            </svg>
                        </button>
                    </div>
                    <button class="crx-toc-close" title="Close Table of Contents">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="crx-toc-content"></div>
        `;

        document.body.appendChild(tocOverlay);

        // Load saved default level and alignment
        chrome.storage.sync.get({ 
            tocDefaultLevel: '6',
            tocAlignment: 'right'
        }, (items) => {
            currentMaxLevel = parseInt(items.tocDefaultLevel);
            updateLevelIndicator();
            
            // Apply alignment from global settings
            applyTocAlignment(items.tocAlignment);
        });

        // Event listeners
        const closeBtn = tocOverlay.querySelector('.crx-toc-close');
        const decreaseBtn = tocOverlay.querySelector('.crx-toc-decrease');
        const increaseBtn = tocOverlay.querySelector('.crx-toc-increase');

        closeBtn.addEventListener('click', hideToc);
        
        decreaseBtn.addEventListener('click', (e) => {
            if (e.shiftKey) {
                // Collapse all - set to level 1
                currentMaxLevel = 1;
            } else if (currentMaxLevel > 1) {
                // Normal click - decrease by 1
                currentMaxLevel--;
            }
            updateLevelIndicator();
            // Don't save to global settings, only update the current session
            updateTocContent();
        });
        
        increaseBtn.addEventListener('click', (e) => {
            if (e.shiftKey) {
                // Expand all - set to level 6
                currentMaxLevel = 6;
            } else if (currentMaxLevel < 6) {
                // Normal click - increase by 1
                currentMaxLevel++;
            }
            updateLevelIndicator();
            // Don't save to global settings, only update the current session
            updateTocContent();
        });

        // Prevent the overlay from closing when clicking inside it
        tocOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Make TOC draggable
        makeTocDraggable();

        return tocOverlay;
    } // eofun createTocOverlay
    
    // Apply TOC alignment (left or right)
    function applyTocAlignment(alignment) {
        if (!tocOverlay) return;
        
        // Reset any existing transform to avoid conflicts
        if (!isDragging) {
            tocOverlay.style.transform = '';
            xOffset = 0;
            yOffset = 0;
            currentX = 0;
            currentY = 0;
            initialX = 0;
            initialY = 0;
        }
        
        if (alignment === 'left') {
            tocOverlay.style.left = '20px';
            tocOverlay.style.right = 'auto';
            tocOverlay.classList.add('crx-toc-left');
            tocOverlay.classList.remove('crx-toc-right');
        } else {
            tocOverlay.style.right = '20px';
            tocOverlay.style.left = 'auto';
            tocOverlay.classList.add('crx-toc-right');
            tocOverlay.classList.remove('crx-toc-left');
        }
    }

    // Update the level indicator text
    function updateLevelIndicator() {
        const levelIndicator = tocOverlay.querySelector('.crx-toc-level-indicator');
        if (!levelIndicator) return;
        
        if (currentMaxLevel === 6) {
            levelIndicator.textContent = 'All';
        } else {
            levelIndicator.textContent = currentMaxLevel.toString();
        }
    }

    // Update TOC content with improved scrolling behavior
    function updateTocContent() {
        if (!tocOverlay) return;

        const content = tocOverlay.querySelector('.crx-toc-content');
        
        if (headings.length === 0) {
            content.innerHTML = '<div class="crx-toc-empty">No headings found on this page</div>';
            return;
        }

        const filteredHeadings = headings.filter(h => h.level <= currentMaxLevel);
        
        if (filteredHeadings.length === 0) {
            content.innerHTML = '<div class="crx-toc-empty">No headings found for selected level</div>';
            return;
        }

        // Create TOC items with simple anchor links
        content.innerHTML = filteredHeadings.map(heading => `
            <a href="#${heading.id}" class="crx-toc-item" data-level="${heading.level}">
                ${heading.text}
            </a>
        `).join('');

        // Add click handlers for smooth scrolling and highlighting
        content.querySelectorAll('.crx-toc-item').forEach((item, index) => {
            item.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default anchor behavior
                
                // Get the corresponding heading
                const heading = filteredHeadings[index].element;
                const headingId = filteredHeadings[index].id;
                
                // Update URL hash
                if (history.pushState) {
                    history.pushState(null, null, `#${headingId}`);
                } else {
                    location.hash = `#${headingId}`;
                }

                // Get heading position
                let headingRect = heading.getBoundingClientRect();
                
                // First do a preliminary scroll toward the heading
                let headingPosition = window.pageYOffset + headingRect.top;
                const headOffset = calcHeaderOffset();
                
                
                // Scroll to just above the heading to make navigation elements visible
                window.scrollTo({
                    top: Math.max(0, headingPosition -headOffset), 
                    behavior: 'auto' // Use auto for the initial positioning
                });
                
                // Short delay to allow navigation elements to settle
                setTimeout(() => {                   
                    // Detect fixed elements at the top of the page
                    const headOffset_2 = calcHeaderOffset();
                    if (Math.abs(headOffset_2 - headOffset) > 5) {
                         console.log(`Adjust offset because of hidden header element (edit toolbar): ${headOffset}px -> ${headOffset_2}px`);
                    
                        // Final smooth scroll to the heading with the correct offset
                        window.scrollTo({
                            top: Math.max(0, headingPosition - headOffset_2),
                            behavior: 'smooth' //auto
                        });
                    }
                    }, 100)
                
                // Update active item in TOC
                content.querySelectorAll('.crx-toc-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                // Focus the heading for accessibility
                setTimeout(() => {
                    heading.setAttribute('tabindex', '-1');
                    heading.focus({ preventScroll: true });
                }, 500);
                
                // Add highlight effect
                heading.classList.add('crx-toc-highlight');
                
                // Remove highlight after animation
                setTimeout(() => {
                    heading.classList.remove('crx-toc-highlight');
                    }, 2000);
                
            });
        });
    }

    function calcHeaderOffset() {
        // Detect fixed elements at the top of the page
        let headOffset = 0;
        
        // Common Confluence header elements
        const possibleHeaderElements = [
            'header',
            '#main-header', // for navigation bar
            //'.aui-header',
            //'#header',
            //'#confluence-header',
            //'.confluence-navigation'
        ];
        
        // Check each potential navigation element
        possibleHeaderElements.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                const rect = element.getBoundingClientRect();
                // Calculate the bottom edge position of this element
                const elementBottom = rect.top + rect.height;
                // Take the maximum value between current offset and this element's bottom edge
                headOffset = Math.max(headOffset, elementBottom);
                //console.log(`Found header element: ${selector}, bottom position: ${elementBottom}px`);
            }
        });
        
        // Add a small padding for visual comfort optional +16
        return headOffset +16;
    }

    // Show TOC
    function showToc() {
        if (!isConfluencePage()) {
            return;
        }

        extractHeadings();
        createTocOverlay();
        updateTocContent();
        tocOverlay.classList.add('visible');
        
        // Add a class to body to indicate TOC is active
        document.body.classList.add('crx-toc-active');
    }

    // Hide TOC
    function hideToc() {
        if (tocOverlay) {
            tocOverlay.classList.remove('visible');
            document.body.classList.remove('crx-toc-active');
        }
    }

    // Toggle TOC
    function toggleToc() {
        if (!tocOverlay || !tocOverlay.classList.contains('visible')) {
            showToc();
        } else {
            hideToc();
        }
    }

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'toggleToc') {
            toggleToc();
            sendResponse({ success: true });
        }
    });

    // Set up observer for dynamic content changes
    function setupContentObserver() {
        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const addedNodes = Array.from(mutation.addedNodes);
                    const removedNodes = Array.from(mutation.removedNodes);
                    
                    const hasHeadingChanges = [...addedNodes, ...removedNodes].some(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            return node.matches('h1, h2, h3, h4, h5, h6') || 
                                   node.querySelector('h1, h2, h3, h4, h5, h6');
                        }
                        return false;
                    });
                    
                    if (hasHeadingChanges) {
                        shouldUpdate = true;
                    }
                }
            });
            
            if (shouldUpdate && tocOverlay && tocOverlay.classList.contains('visible')) {
                setTimeout(() => {
                    extractHeadings();
                    updateTocContent();
                }, 100);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (isConfluencePage()) {
                setupContentObserver();
            }
        });
    } else {
        if (isConfluencePage()) {
            setupContentObserver();
        }
    }

    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape to close TOC
        if (e.key === 'Escape' && tocOverlay && tocOverlay.classList.contains('visible')) {
            hideToc();
            e.preventDefault();
            e.stopPropagation();
        }
    });

    
})();