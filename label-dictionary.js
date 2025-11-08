/**
 * Label Dictionary functionality for expanding shortened labels
 */

/**
 * Expands label shortcuts in a search query using a two-tier matching system
 *
 * Dictionary structure: { "full-label": ["shortcut1", "shortcut2", ...] }
 *
 * Matching Logic:
 * 1. First tries exact match in shortcuts
 * 2. If no exact match and shortcut is 1-2 characters, finds first label whose shortcut is starting with those characters
 * 3. If no match found, finds first label whose full label text is starting with those characters
 * 4. If no match found, leaves the original label as is
 *
 * @param {string} searchQuery - The original search query
 * @returns {Promise<string>} - The search query with expanded labels
 *
 * @example
 * // Dictionary: {"sharepointonline": ["spo", "sp"], "knowledgebase": ["kb"], "documentation": []}
 *
 * // Exact matches:
 * expandLabels("#spo test") → "#sharepointonline test"
 * expandLabels("#kb docs") → "#knowledgebase docs"
 *
 * // Partial matches (1-2 chars):
 * expandLabels("#s test") → "#sharepointonline test" (first shortcut starting with 's')
 *
 * // Multiple shortcuts for same label:
 * expandLabels("#sp test") → "#sharepointonline test"
 * expandLabels("#spo test") → "#sharepointonline test"
 */
export async function expandLabels(searchQuery) {
    try {
        const labelDict =
            (await getObjectFromLocalStorage("labelDictionary")) || {};

        if (Object.keys(labelDict).length === 0) {
            return searchQuery;
        }

        // Validate dictionary structure - if invalid, reset and return original query
        for (const [fullLabel, shortcuts] of Object.entries(labelDict)) {
            if (!Array.isArray(shortcuts)) {
                console.warn(
                    "Invalid dictionary structure detected, resetting..."
                );
                await clearAllLabels();
                return searchQuery;
            }
        }

        // Create reverse lookup: shortcut -> fullLabel
        const shortcutToLabel = {};
        Object.entries(labelDict).forEach(([fullLabel, shortcuts]) => {
            shortcuts.forEach((shortcut) => {
                shortcutToLabel[shortcut] = fullLabel;
            });
        });

        let expandedQuery = searchQuery;

        // Find all #shortcut patterns in the query
        const labelPattern = /#(\w+)/g;
        let match;

        // We need to process matches from right to left to avoid index shifting
        const matches = [];
        while ((match = labelPattern.exec(searchQuery)) !== null) {
            matches.push({
                shortLabel: match[1],
                fullMatch: match[0],
                startIndex: match.index,
                endIndex: match.index + match[0].length,
            });
        }

        // Process matches from right to left to avoid index shifting issues
        for (let i = matches.length - 1; i >= 0; i--) {
            const { shortLabel, fullMatch, startIndex, endIndex } = matches[i];

            let expandedLabel = null;

            // First: Look for exact match in shortcuts
            if (shortcutToLabel[shortLabel]) {
                expandedLabel = `#${shortcutToLabel[shortLabel]}`;
            }
            // Second: If no exact match and shortLabel is 1-2 characters, look for partial matches
            else if (shortLabel.length <= 2) {
                // First try to find a shortcut that starts with the shortLabel
                const matchingShortcut = Object.keys(shortcutToLabel).find(
                    (shortcut) =>
                        shortcut
                            .toLowerCase()
                            .startsWith(shortLabel.toLowerCase())
                );

                if (matchingShortcut) {
                    expandedLabel = `#${shortcutToLabel[matchingShortcut]}`;
                } else {
                    // If no shortcut match, try to find a full label that starts with the shortLabel
                    const matchingFullLabel = Object.keys(labelDict).find(
                        (fullLabel) =>
                            fullLabel
                                .toLowerCase()
                                .startsWith(shortLabel.toLowerCase())
                    );

                    if (matchingFullLabel) {
                        expandedLabel = `#${matchingFullLabel}`;
                    }
                }
            }

            // Replace the specific occurrence using string slicing to avoid replacing wrong instances
            if (expandedLabel) {
                expandedQuery =
                    expandedQuery.slice(0, startIndex) +
                    expandedLabel +
                    expandedQuery.slice(endIndex);
            }
        }

        return expandedQuery;
    } catch (error) {
        console.error(
            "Error expanding label shortcuts, resetting dictionary:",
            error
        );
        await clearAllLabels();
        return searchQuery;
    }
}

/**
 * Gets the label dictionary from storage
 * @returns {Promise<Object>} - The label dictionary object { "fullLabel": ["shortcut1", "shortcut2"] }
 */
export async function getLabelDictionary() {
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
export async function saveLabelDictionary(labelDict) {
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
export async function addLabelShortcut(shortcut, fullLabel) {
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
export async function removeLabelShortcut(fullLabel, shortcut = null) {
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
export async function clearAllLabels() {
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
