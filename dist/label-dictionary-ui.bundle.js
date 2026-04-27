// Browser API polyfill for Firefox
console.log('🔍 Search script loading...');
if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
  globalThis.chrome = browser;
  console.log('🦊 Firefox - mapped browser to chrome');
}
(function () {
    'use strict';

    /**
     * Label Dictionary functionality for expanding shortened labels
     */


    /**
     * Gets the label dictionary from storage
     * @returns {Promise<Object>} - The label dictionary object { "fullLabel": ["shortcut1", "shortcut2"] }
     */
    async function getLabelDictionary() {
        try {
            const dict = (await getObjectFromLocalStorage("labelDictionary")) || {};

            // Validate structure - if invalid, reset
            for (const [fullLabel, shortcuts] of Object.entries(dict)) {
                if (!Array.isArray(shortcuts)) {
                    console.warn(
                        "Invalid dictionary structure detected, resetting..."
                    );
                    await clearAllLabels();
                    return {};
                }
            }

            return dict;
        } catch (error) {
            console.error("Error getting label dictionary, resetting:", error);
            await clearAllLabels();
            return {};
        }
    }

    /**
     * Saves the label dictionary to storage
     * @param {Object} labelDict - The label dictionary to save
     * @returns {Promise<boolean>} - Success indicator
     */
    async function saveLabelDictionary(labelDict) {
        try {
            return new Promise((resolve) => {
                chrome.storage.sync.set({ labelDictionary: labelDict }, () => {
                    resolve(true);
                });
            });
        } catch (error) {
            console.error("Error saving label dictionary:", error);
            return false;
        }
    }

    /**
     * Adds a new label shortcut to the dictionary
     * @param {string} shortcut - The short label (without #) - can be empty string
     * @param {string} fullLabel - The full label (without #)
     * @returns {Promise<boolean>} - Success indicator
     */
    async function addLabelShortcut(shortcut, fullLabel) {
        try {
            const labelDict = await getLabelDictionary();

            // Initialize array if label doesn't exist
            if (!labelDict[fullLabel]) {
                labelDict[fullLabel] = [];
            }

            // Add shortcut if provided and not already exists
            if (
                shortcut &&
                shortcut.trim() !== "" &&
                !labelDict[fullLabel].includes(shortcut.trim())
            ) {
                labelDict[fullLabel].push(shortcut.trim());
            }

            return await saveLabelDictionary(labelDict);
        } catch (error) {
            console.error("Error adding label shortcut:", error);
            return false;
        }
    }

    /**
     * Removes a label shortcut from the dictionary
     * @param {string} fullLabel - The full label to remove
     * @param {string} shortcut - Optional: specific shortcut to remove, if not provided removes entire label
     * @returns {Promise<boolean>} - Success indicator
     */
    async function removeLabelShortcut(fullLabel, shortcut = null) {
        try {
            const labelDict = await getLabelDictionary();

            if (shortcut) {
                // Remove specific shortcut
                if (labelDict[fullLabel] && Array.isArray(labelDict[fullLabel])) {
                    labelDict[fullLabel] = labelDict[fullLabel].filter(
                        (s) => s !== shortcut
                    );
                    // If no shortcuts left, keep the label with empty array
                }
            } else {
                // Remove entire label
                delete labelDict[fullLabel];
            }

            return await saveLabelDictionary(labelDict);
        } catch (error) {
            console.error("Error removing label shortcut:", error);
            return false;
        }
    }

    /**
     * Clears all labels from the dictionary
     * @returns {Promise<boolean>} - Success indicator
     */
    async function clearAllLabels() {
        try {
            return new Promise((resolve) => {
                chrome.storage.sync.set({ labelDictionary: {} }, () => {
                    console.log("Label dictionary cleared");
                    resolve(true);
                });
            });
        } catch (error) {
            console.error("Error clearing all labels:", error);
            return false;
        }
    }

    /**
     * Helper function to get object from local storage (if not already available)
     */
    async function getObjectFromLocalStorage(key) {
        return new Promise((resolve) => {
            chrome.storage.sync.get([key], (result) => {
                resolve(result[key]);
            });
        });
    }

    // Safe HTML setter to avoid innerHTML security warnings
    function setHTMLContent(element, htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        element.textContent = '';
        while (doc.body.firstChild) {
            element.appendChild(doc.body.firstChild);
        }
    }

    document.addEventListener("DOMContentLoaded", async function () {
        const shortcutInput = document.getElementById("shortcut-input");
        const fullLabelInput = document.getElementById("full-label-input");
        const addBtn = document.getElementById("add-label-btn");
        const labelsContainer = document.getElementById("labels-container");
        const emptyState = document.getElementById("empty-state");
        const notification = document.getElementById("notification");
        const helpBtn = document.getElementById("help");

        // Add Clear All button to the page
        const clearAllBtn = document.createElement("button");
        clearAllBtn.textContent = "Clear All Labels";
        clearAllBtn.className = "danger";
        clearAllBtn.style.marginLeft = "10px";
        clearAllBtn.addEventListener("click", async function () {
            if (
                confirm(
                    "Are you sure you want to delete ALL label shortcuts? You might want to export your snippets before."
                )
            ) {
                const success = await clearAllLabels();
                if (success) {
                    await loadLabels();
                    showNotification("All labels cleared successfully!", "success");
                } else {
                    showNotification("Failed to clear labels", "error");
                }
            }
        });

        // Add button to the header
        const header = document.querySelector("h2");
        if (header) {
            const buttonContainer = document.createElement("div");
            buttonContainer.style.display = "inline-block";
            buttonContainer.style.float = "right";
            buttonContainer.appendChild(clearAllBtn);
            header.appendChild(buttonContainer);
        }

        // Load existing labels with error handling
        try {
            await loadLabels();
        } catch (error) {
            console.error("Error loading labels:", error);
            showNotification(
                "Error loading labels. Dictionary has been reset.",
                "error"
            );
            await clearAllLabels();
            await loadLabels();
        }

        // Help button click
        helpBtn.addEventListener("click", function () {
            chrome.tabs.create({
                url: "https://github.com/tdalon/confluence_crx/blob/main/docs/LabelDict.md",
            });
        });

        // Add label button click
        addBtn.addEventListener("click", async function () {
            const shortcut = shortcutInput.value.trim().toLowerCase();
            const fullLabel = fullLabelInput.value.trim().toLowerCase();

            if (!fullLabel) {
                showNotification("Please provide the full label", "error");
                fullLabelInput.focus();
                return;
            }

            // Validate shortcut only if provided (can be empty)
            if (shortcut && !/^[a-z0-9]+$/.test(shortcut)) {
                showNotification(
                    "Shortcut must contain only letters and numbers",
                    "error"
                );
                shortcutInput.focus();
                return;
            }

            // Validate full label (no spaces, alphanumeric and hyphens only)
            if (!/^[a-z0-9-]+$/.test(fullLabel)) {
                showNotification(
                    "Full label must contain only letters, numbers, and hyphens",
                    "error"
                );
                fullLabelInput.focus();
                return;
            }

            const success = await addLabelShortcut(shortcut, fullLabel);
            if (success) {
                shortcutInput.value = "";
                fullLabelInput.value = "";
                fullLabelInput.focus(); // Focus on full label input for next entry
                await loadLabels();

                if (shortcut) {
                    showNotification(
                        `Added shortcut: #${shortcut} → #${fullLabel}`,
                        "success"
                    );
                } else {
                    showNotification(
                        `Added label: #${fullLabel} (no shortcut)`,
                        "success"
                    );
                }
            } else {
                showNotification("Failed to add label shortcut", "error");
            }
        });

        // Enter key support
        fullLabelInput.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                shortcutInput.focus();
            }
        });

        shortcutInput.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                addBtn.click();
            }
        });

        // Event delegation for label container
        labelsContainer.addEventListener("click", async function (e) {
            const target = e.target;

            // Handle remove label button
            if (target.classList.contains("remove-label-btn")) {
                const fullLabel = target.dataset.label;
                const success = await removeLabelShortcut(fullLabel);
                if (success) {
                    await loadLabels();
                    showNotification(`Removed label: #${fullLabel}`, "success");
                } else {
                    showNotification("Failed to remove label", "error");
                }
            }

            // Handle remove shortcut button
            if (target.classList.contains("remove-shortcut-btn")) {
                const fullLabel = target.dataset.label;
                const shortcut = target.dataset.shortcut;
                const success = await removeLabelShortcut(fullLabel, shortcut);
                if (success) {
                    await loadLabels();
                    showNotification(`Removed shortcut: #${shortcut}`, "success");
                } else {
                    showNotification("Failed to remove shortcut", "error");
                }
            }
        });

        async function loadLabels() {
            try {
                const labelDict = await getLabelDictionary();
                const labels = Object.entries(labelDict);

                if (labels.length === 0) {
                    emptyState.style.display = "block";
                    setHTMLContent(labelsContainer,
                        '<div class="empty-state" id="empty-state">No label shortcuts defined yet. Add one above to get started!</div>');
                    return;
                }

                emptyState.style.display = "none";

                const labelsHtml = labels
                    .map(([fullLabel, shortcuts]) => {
                        if (shortcuts.length === 0) {
                            // No shortcuts, just the full label
                            return `
                        <div class="label-item">
                            <div class="label-mapping">
                                <span class="label-full">#${fullLabel}</span>
                                <span style="color: #6b778c; font-style: italic; margin-left: 10px;">(no shortcuts)</span>
                            </div>
                            <button class="danger remove-label-btn" data-label="${fullLabel}">Remove</button>
                        </div>
                    `;
                        } else if (shortcuts.length === 1) {
                            // Single shortcut
                            return `
                        <div class="label-item">
                            <div class="label-mapping">
                                <span class="label-shortcut">#${shortcuts[0]}</span>
                                <span class="label-arrow">→</span>
                                <span class="label-full">#${fullLabel}</span>
                            </div>
                            <div class="label-actions">
                                <button class="secondary remove-shortcut-btn" data-label="${fullLabel}" data-shortcut="${shortcuts[0]}">Remove Shortcut</button>
                                <button class="danger remove-label-btn" data-label="${fullLabel}">Remove Label</button>
                            </div>
                        </div>
                    `;
                        } else {
                            // Multiple shortcuts
                            const shortcutsList = shortcuts
                                .map(
                                    (shortcut) =>
                                        `<span class="label-shortcut">#${shortcut}</span>`
                                )
                                .join(", ");

                            const shortcutButtons = shortcuts
                                .map(
                                    (shortcut) =>
                                        `<button class="secondary small remove-shortcut-btn" data-label="${fullLabel}" data-shortcut="${shortcut}">Remove #${shortcut}</button>`
                                )
                                .join(" ");

                            return `
                        <div class="label-item">
                            <div class="label-mapping">
                                <div>${shortcutsList}</div>
                                <span class="label-arrow">→</span>
                                <span class="label-full">#${fullLabel}</span>
                            </div>
                            <div class="label-actions">
                                ${shortcutButtons}
                                <button class="danger remove-label-btn" data-label="${fullLabel}">Remove Label</button>
                            </div>
                        </div>
                    `;
                        }
                    })
                    .join("");

                setHTMLContent(labelsContainer, labelsHtml);
            } catch (error) {
                console.error("Error in loadLabels:", error);
                throw error;
            }
        }

        function showNotification(message, type) {
            notification.textContent = message;
            notification.className = `notification ${type}`;
            notification.style.display = "block";

            setTimeout(() => {
                notification.style.display = "none";
            }, 3000);
        }
    });

})();
