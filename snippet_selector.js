/**
 * This content script creates an overlay UI for quickly selecting and inserting snippets
 */

// Use window object to store our loaded flag to ensure it persists between injections
if (typeof window.snippetSelectorLoaded === "undefined") {
    // Mark script as loaded
    window.snippetSelectorLoaded = true;

    // Global variables
    let snippetOverlay = null;
    let searchInput = null;
    let snippetList = null;
    let snippets = [];
    let filteredSnippets = [];
    let selectedIndex = 0;
    let formatFilter = null; // Will be 'html', 'text', or null (for all)
    let escapeKeyListener = null; // Store reference to event listener for proper cleanup

    // Detect if we're in the source editor
    function isSourceEditor() {
        // Check if we're in the source editor
        const sourceEditor = document.querySelector(".source-editor textarea");
        const activeElement = document.activeElement;

        return (sourceEditor && sourceEditor === activeElement) ||
            document.querySelector(".source-editor") !== null;
        
    }

    // Create and show the snippet selector overlay
    function showSnippetSelector() {
        // Request snippets from the background script instead of direct storage access
        chrome.runtime.sendMessage(
            { action: "getSnippets" },
            function (response) {
                if (!response || !response.success) {
                    console.error(
                        "Failed to get snippets:",
                        response?.error || "Unknown error"
                    );
                    chrome.runtime.sendMessage({
                        action: "showNotification",
                        title: "Error",
                        message: "Failed to load snippets. Please try again.",
                    });
                    return;
                }

                const snippetsData = response.snippets || {};

                // Convert object to array format expected by the UI
                snippets = Object.entries(snippetsData).map(([name, data]) => ({
                    title: name,
                    text: data.text,
                    description: data.description || "",
                    format: data.format || "text",
                }));

                // Check editor type EVERY time the selector is opened
                const is_SourceEditor = isSourceEditor();

                // Set format filter based on current editor type
                if (is_SourceEditor) {
                    formatFilter = "text"; // Source editor can only handle text
                } else {
                    formatFilter = "html"; // Rich editor default to showing html
                }

                // Apply initial filtering
                applyFilters();

                if (snippets.length === 0) {
                    // Show notification if no snippets are available
                    chrome.runtime.sendMessage({
                        action: "showNotification",
                        title: "No snippets available",
                        message:
                            "Please add snippets in the Snippet Manager first.",
                    });
                    return;
                }

                // If overlay exists, properly clean it up before creating a new one
                if (snippetOverlay) {
                    hideOverlay();
                }

                // Create a new overlay
                createOverlay(is_SourceEditor);
            }
        );
    }

    // Apply both search and format filters
    function applyFilters() {
        const searchQuery = searchInput
            ? searchInput.value.toLowerCase().trim()
            : "";

        // First filter by format if a format filter is active
        let formatFiltered = snippets;
        if (formatFilter) {
            formatFiltered = snippets.filter(
                (snippet) => snippet.format === formatFilter
            );
        }

        // Then apply search filter
        if (!searchQuery) {
            filteredSnippets = [...formatFiltered];
        } else {
            filteredSnippets = formatFiltered.filter(
                (snippet) =>
                    snippet.title.toLowerCase().includes(searchQuery) ||
                    (snippet.description &&
                        snippet.description.toLowerCase().includes(searchQuery))
            );
        }

        // Reset selection
        selectedIndex = 0;

        // Update the list
        updateSnippetList();
    }

    // Create the overlay UI
    function createOverlay(is_SourceEditor) {
        // Create overlay container
        snippetOverlay = document.createElement("div");
        snippetOverlay.id = "confluence-crx-snippet-selector";
        snippetOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(9, 30, 66, 0.7);
        z-index: 10000;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 10vh;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
        `;

        // Create selector container
        const selectorContainer = document.createElement("div");
        selectorContainer.style.cssText = `
        width: 500px;
        max-width: 90%;
        background-color: white;
        border-radius: 5px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        `;

        // Create header
        const header = document.createElement("div");
        header.style.cssText = `
        padding: 16px;
        border-bottom: 1px solid #DFE1E6;
        display: flex;
        justify-content: space-between;
        align-items: center;
        `;

        const title = document.createElement("h3");
        title.textContent = "Insert Snippet";
        title.style.cssText = `
        margin: 0;
        color: #172B4D;
        font-size: 16px;
        font-weight: 600;
        `;

        const closeButton = document.createElement("button");
        closeButton.innerHTML = "&times;";
        closeButton.style.cssText = `
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #6B778C;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        `;
        closeButton.addEventListener("mouseover", () => {
            closeButton.style.backgroundColor = "#F4F5F7";
        });
        closeButton.addEventListener("mouseout", () => {
            closeButton.style.backgroundColor = "transparent";
        });
        closeButton.addEventListener("click", hideOverlay);

        header.appendChild(title);
        header.appendChild(closeButton);

        // Create search input
        const searchContainer = document.createElement("div");
        searchContainer.style.cssText = `
        padding: 8px 16px;
        border-bottom: 1px solid #DFE1E6;
        `;

        searchInput = document.createElement("input");
        searchInput.type = "text";
        searchInput.placeholder = "Search snippets...";
        searchInput.style.cssText = `
        width: 100%;
        padding: 8px;
        border: 1px solid #DFE1E6;
        border-radius: 3px;
        font-size: 14px;
        box-sizing: border-box;
        `;
        searchInput.addEventListener("input", () => applyFilters());
        searchInput.addEventListener("keydown", handleKeyNavigation);

        searchContainer.appendChild(searchInput);

        // Create format filter buttons
        const filterContainer = document.createElement("div");
        filterContainer.style.cssText = `
        display: flex;
        padding: 8px 16px;
        border-bottom: 1px solid #DFE1E6;
        gap: 8px;
        `;

        // Only show format filter in rich editor mode
        if (!is_SourceEditor) {
            // Create "All" button
            const allButton = createFilterButton("All", null);

            // Create "HTML" button
            const htmlButton = createFilterButton("HTML", "html");

            // Create "Text" button
            const textButton = createFilterButton("Text", "text");

            filterContainer.appendChild(allButton);
            filterContainer.appendChild(htmlButton);
            filterContainer.appendChild(textButton);
        } else {
            // In source editor, show a notice that only text snippets are available
            const notice = document.createElement("div");
            notice.style.cssText = `
            font-size: 12px;
            color: #6B778C;
            padding: 4px 0;
            `;
            notice.textContent =
                "Source editor mode: Only text snippets are shown";
            filterContainer.appendChild(notice);
        }

        // Create snippet list container
        const listContainer = document.createElement("div");
        listContainer.style.cssText = `
        max-height: 300px;
        overflow-y: auto;
        padding: 8px 0;
        `;

        snippetList = document.createElement("ul");
        snippetList.style.cssText = `
        list-style: none;
        margin: 0;
        padding: 0;
        `;

        // Populate the list
        updateSnippetList();

        listContainer.appendChild(snippetList);

        // Create footer with keyboard shortcuts help
        const footer = document.createElement("div");
        footer.style.cssText = `
        padding: 8px 16px;
        border-top: 1px solid #DFE1E6;
        background-color: #F4F5F7;
        font-size: 12px;
        color: #6B778C;
        `;
        footer.innerHTML = `
        <span>↑↓: Navigate</span>
        <span style="margin-left: 10px;">Enter: Insert snippet</span>
        <span style="margin-left: 10px;">Esc: Cancel</span>
        `;

        // Assemble the components
        selectorContainer.appendChild(header);
        selectorContainer.appendChild(searchContainer);
        selectorContainer.appendChild(filterContainer);
        selectorContainer.appendChild(listContainer);
        selectorContainer.appendChild(footer);

        snippetOverlay.appendChild(selectorContainer);
        document.body.appendChild(snippetOverlay);

        // Focus the search input
        setTimeout(() => {
            searchInput.focus();
        }, 100);

        // Add event listener to close on Escape key
        escapeKeyListener = (e) => handleEscapeKey(e);
        document.addEventListener("keydown", escapeKeyListener);

        // Add event listener to close when clicking outside
        snippetOverlay.addEventListener("click", (e) => {
            if (e.target === snippetOverlay) {
                hideOverlay();
            }
        });

        // Update format filter buttons to reflect current state
        updateFormatFilterButtons();
    }

    // Create a filter button
    function createFilterButton(label, format) {
        const button = document.createElement("button");
        button.textContent = label;
        button.dataset.format = format;

        const isActive = formatFilter === format;

        button.style.cssText = `
        padding: 4px 12px;
        border-radius: 3px;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid ${isActive ? "#0052CC" : "#DFE1E6"};
        background-color: ${isActive ? "#E6EFFC" : "white"};
        color: ${isActive ? "#0052CC" : "#172B4D"};
        `;

        button.addEventListener("click", () => {
            formatFilter = format;
            updateFormatFilterButtons();
            applyFilters();
        });

        return button;
    }

    // Update format filter buttons to reflect current state
    function updateFormatFilterButtons() {
        if (snippetOverlay) {
            const buttons = snippetOverlay.querySelectorAll(
                "button[data-format]"
            );
            buttons.forEach((button) => {
                const isActive =
                    button.dataset.format === formatFilter ||
                    (button.dataset.format === "null" && formatFilter === null);

                button.style.border = isActive
                    ? "1px solid #0052CC"
                    : "1px solid #DFE1E6";
                button.style.backgroundColor = isActive ? "#E6EFFC" : "white";
                button.style.color = isActive ? "#0052CC" : "#172B4D";
            });
        }
    }

    // Update the snippet list UI
    function updateSnippetList() {
        if (!snippetList) return;

        // Clear the list
        snippetList.innerHTML = "";

        if (filteredSnippets.length === 0) {
            const emptyItem = document.createElement("li");
            emptyItem.style.cssText = `
            padding: 16px;
            text-align: center;
            color: #6B778C;
        `;
            emptyItem.textContent = "No matching snippets found";
            snippetList.appendChild(emptyItem);
            return;
        }

        // Add filtered snippets to the list
        filteredSnippets.forEach((snippet, index) => {
            const item = document.createElement("li");
            item.dataset.index = index;
            item.style.cssText = `
            padding: 8px 16px;
            cursor: pointer;
            border-left: 3px solid transparent;
            ${index === selectedIndex
                    ? "background-color: #E6EFFC; border-left-color: #0052CC;"
                    : ""
                }
        `;

            const titleElement = document.createElement("div");
            titleElement.style.cssText = `
            font-weight: 500;
            color: #172B4D;
            margin-bottom: 4px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;

            const titleText = document.createElement("span");
            titleText.textContent = snippet.title;
            titleElement.appendChild(titleText);

            // Add format badge
            const formatBadge = document.createElement("span");
            formatBadge.textContent =
                snippet.format === "html" ? "HTML" : "Text";
            formatBadge.style.cssText = `
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 3px;
            font-weight: normal;
            background-color: ${snippet.format === "html" ? "#E3FCEF" : "#F4F5F7"
                };
            color: ${snippet.format === "html" ? "#006644" : "#6B778C"};
            `;
            titleElement.appendChild(formatBadge);

            item.appendChild(titleElement);

            if (snippet.description) {
                const descElement = document.createElement("div");
                descElement.style.cssText = `
            font-size: 12px;
            color: #6B778C;
            `;
                descElement.textContent = snippet.description;
                item.appendChild(descElement);
            }

            // Add hover effect
            item.addEventListener("mouseover", () => {
                if (selectedIndex !== index) {
                    item.style.backgroundColor = "#F4F5F7";
                }
            });

            item.addEventListener("mouseout", () => {
                if (selectedIndex !== index) {
                    item.style.backgroundColor = "transparent";
                }
            });

            // Add click handler
            item.addEventListener("click", () => {
                selectedIndex = index;
                insertSelectedSnippet();
            });

            snippetList.appendChild(item);
        });
    }

    // Handle keyboard navigation
    function handleKeyNavigation(e) {
        if (filteredSnippets.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                selectedIndex = (selectedIndex + 1) % filteredSnippets.length;
                updateSnippetList();
                ensureSelectedVisible();
                break;

            case "ArrowUp":
                e.preventDefault();
                selectedIndex =
                    (selectedIndex - 1 + filteredSnippets.length) %
                    filteredSnippets.length;
                updateSnippetList();
                ensureSelectedVisible();
                break;

            case "Enter":
                e.preventDefault();
                insertSelectedSnippet();
                break;
        }
    }

    // Ensure the selected item is visible in the scrollable container
    function ensureSelectedVisible() {
        const selectedItem = snippetList.querySelector(
            `li[data-index="${selectedIndex}"]`
        );
        if (selectedItem) {
            selectedItem.scrollIntoView({ block: "nearest" });
        }
    }

    // Handle Escape key to close the overlay
    function handleEscapeKey(e) {
        if (
            e.key === "Escape" &&
            snippetOverlay &&
            snippetOverlay.style.display !== "none"
        ) {
            hideOverlay();
            e.preventDefault();
            e.stopPropagation();
        }
    }

    // Hide the overlay
    function hideOverlay() {
        if (snippetOverlay) {
            // Remove event listeners
            document.removeEventListener("keydown", escapeKeyListener);
            

            // Remove from DOM
            document.body.removeChild(snippetOverlay);
            snippetOverlay = null;
        }
    }

    // Insert the currently selected snippet
    function insertSelectedSnippet() {
        if (selectedIndex >= 0 && selectedIndex < filteredSnippets.length) {
            const snippet = filteredSnippets[selectedIndex];

            console.log("Inserting selected snippet:", snippet);

            // Send message to the background script to handle the insertion
            chrome.runtime.sendMessage({
                action: "insertSnippetFromSelector",
                snippetName: snippet.title,
            });

            hideOverlay();
        }
    }


    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "showSnippetSelector") {
            showSnippetSelector();
            sendResponse({ success: true });
        }
        return true;
    });


    // If the script has already been loaded, just show the selector
} else { //if (typeof window.showSnippetSelector !== "undefined") 
    // This part runs when the script is injected again but was already loaded
    showSnippetSelector();
}