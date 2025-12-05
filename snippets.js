import { getObjectFromLocalStorage } from "./shared.js";

// Constants for storage
const CHUNK_SIZE = 8000; // Slightly less than the 8KB limit to account for overhead
const SNIPPET_INDEX_KEY = "snippet_index";
const SNIPPET_CHUNK_PREFIX = "snippet_chunk_";

/**
 * Saves a snippet with a name to storage
 * @param {string} name - The name of the snippet
 * @param {object} data - The snippet data object
 */
export async function saveSnippet(name, data) {
    try {
        // Get the snippet index
        let index = await getSnippetIndex();

        // Prepare the snippet data
        const snippetJson = JSON.stringify(data);
        const needsChunking = snippetJson.length > CHUNK_SIZE;

        // Update the index entry for this snippet
        index[name] = {
            chunked: needsChunking,
            timestamp: Date.now(),
            size: snippetJson.length,
            format: data.format || "text",
            description: data.description || "",
        };

        // Save the index
        await chrome.storage.sync.set({ [SNIPPET_INDEX_KEY]: index });

        if (needsChunking) {
            // Save in chunks
            const chunks = [];
            for (let i = 0; i < snippetJson.length; i += CHUNK_SIZE) {
                chunks.push(snippetJson.substring(i, i + CHUNK_SIZE));
            }

            // Save each chunk with a unique key
            const chunkKey = `${SNIPPET_CHUNK_PREFIX}${name}`;
            for (let i = 0; i < chunks.length; i++) {
                await chrome.storage.sync.set({
                    [`${chunkKey}_${i}`]: chunks[i],
                });
            }

            // Save chunk count
            await chrome.storage.sync.set({
                [`${chunkKey}_count`]: chunks.length,
            });

            console.log(
                `Saved chunked snippet "${name}" in ${chunks.length} chunks`
            );
        } else {
            // Save directly if small enough
            await chrome.storage.sync.set({
                [`${SNIPPET_CHUNK_PREFIX}${name}`]: data,
            });

            console.log(`Saved snippet "${name}" directly`);
        }

        return true;
    } catch (error) {
        console.error("Error saving snippet:", error);
        return false;
    }
}

/**
 * Gets the snippet index from storage
 * @returns {Promise<Object>} - The snippet index
 */
async function getSnippetIndex() {
    try {
        const data = await chrome.storage.sync.get(SNIPPET_INDEX_KEY);
        return data[SNIPPET_INDEX_KEY] || {};
    } catch (error) {
        console.error("Error getting snippet index:", error);
        return {};
    }
}

/**
 * Gets all snippets from storage
 * @returns {Promise<Object>} - Object containing all snippets
 */
export async function getSnippets() {
    try {
        // Get the snippet index
        const index = await getSnippetIndex();
        const result = {};

        // Load each snippet
        for (const name in index) {
            const snippet = await getSnippet(name);
            if (snippet) {
                result[name] = snippet;
            }
        }

        return result;
    } catch (error) {
        console.error("Error getting all snippets:", error);
        return {};
    }
}

/**
 * Gets a single snippet by name
 * @param {string} name - The name of the snippet to retrieve
 * @returns {Promise<Object|null>} - The snippet object or null if not found
 */
export async function getSnippet(name) {
    try {
        const index = await getSnippetIndex();
        const snippetInfo = index[name];

        if (!snippetInfo) {
            return null;
        }

        const chunkKey = `${SNIPPET_CHUNK_PREFIX}${name}`;

        if (snippetInfo.chunked) {
            // Get chunk count
            const countData = await chrome.storage.sync.get(
                `${chunkKey}_count`
            );
            const chunkCount = countData[`${chunkKey}_count`];

            if (!chunkCount) {
                console.error(`Chunk count not found for snippet "${name}"`);
                return null;
            }

            // Get all chunks
            let jsonString = "";
            for (let i = 0; i < chunkCount; i++) {
                const chunkData = await chrome.storage.sync.get(
                    `${chunkKey}_${i}`
                );
                jsonString += chunkData[`${chunkKey}_${i}`] || "";
            }

            try {
                return JSON.parse(jsonString);
            } catch (parseError) {
                console.error(
                    `Error parsing chunked snippet "${name}":`,
                    parseError
                );
                return null;
            }
        } else {
            // Get directly if not chunked
            const data = await chrome.storage.sync.get(chunkKey);
            return data[chunkKey] || null;
        }
    } catch (error) {
        console.error(`Error getting snippet "${name}":`, error);
        return null;
    }
}

/**
 * Deletes a snippet by name
 * @param {string} name - The name of the snippet to delete
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export async function deleteSnippet(name) {
    try {
        // Get the snippet index
        const index = await getSnippetIndex();

        if (!index[name]) {
            return false;
        }

        const isChunked = index[name].chunked;
        const chunkKey = `${SNIPPET_CHUNK_PREFIX}${name}`;

        // Remove from index
        delete index[name];
        await chrome.storage.sync.set({ [SNIPPET_INDEX_KEY]: index });

        if (isChunked) {
            // Get chunk count
            const countData = await chrome.storage.sync.get(
                `${chunkKey}_count`
            );
            const chunkCount = countData[`${chunkKey}_count`];

            if (chunkCount) {
                // Remove all chunks
                const keysToRemove = [];
                for (let i = 0; i < chunkCount; i++) {
                    keysToRemove.push(`${chunkKey}_${i}`);
                }
                keysToRemove.push(`${chunkKey}_count`);

                await chrome.storage.sync.remove(keysToRemove);
            }
        } else {
            // Remove direct snippet
            await chrome.storage.sync.remove(chunkKey);
        }

        return true;
    } catch (error) {
        console.error(`Error deleting snippet "${name}":`, error);
        return false;
    }
}

/**
 * Clears all snippets from storage
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
export async function clearAllSnippets() {
    try {
        // Get all keys in storage
        const data = await chrome.storage.sync.get(null);
        const keysToRemove = Object.keys(data).filter(
            (key) =>
                key === SNIPPET_INDEX_KEY ||
                key.startsWith(SNIPPET_CHUNK_PREFIX)
        );

        // Remove all snippet-related keys
        if (keysToRemove.length > 0) {
            await chrome.storage.sync.remove(keysToRemove);
        }

        console.log("All snippets have been cleared from storage");
        return true;
    } catch (error) {
        console.error("Error clearing snippets:", error);
        return false;
    }
}

/**
 * Gets storage usage information
 * @returns {Promise<Object>} - Storage usage information
 */
export async function getStorageUsage() {
    try {
        const index = await getSnippetIndex();
        const snippetCount = Object.keys(index).length;

        // Get all storage data to calculate size
        const data = await chrome.storage.sync.get(null);
        const totalBytes = JSON.stringify(data).length;

        // Get quota information
        const quota = await new Promise((resolve) => {
            chrome.storage.sync.getBytesInUse(null, (bytesInUse) => {
                resolve({
                    bytesInUse,
                    // Chrome sync storage quota is 102,400 bytes (100KB)
                    bytesTotal: 102400,
                });
            });
        });

        return {
            snippetCount,
            totalBytes,
            bytesInUse: quota.bytesInUse,
            bytesTotal: quota.bytesTotal,
            percentUsed: Math.round(
                (quota.bytesInUse / quota.bytesTotal) * 100
            ),
        };
    } catch (error) {
        console.error("Error getting storage usage:", error);
        return {
            snippetCount: 0,
            totalBytes: 0,
            bytesInUse: 0,
            bytesTotal: 102400,
            percentUsed: 0,
        };
    }
}

// Add this debug function to help diagnose insertion issues
export function debugInsertionEnvironment() {
    console.log("Active element:", document.activeElement);
    console.log(
        "Is contentEditable:",
        document.activeElement.isContentEditable
    );
    console.log("Confluence editor elements found:", {
        sourceEditor: !!document.querySelector(".source-editor"),
        akEditor: !!document.querySelector(".ak-editor-content-area"),
        wikiEditor: !!document.querySelector(".wiki-content-editor"),
        proseMirror: !!document.querySelector(".ProseMirror"),
        mainArea: !!document.querySelector(
            '[data-testid="ak-editor-main-area"]'
        ),
    });

    // Check if we're in an iframe
    try {
        console.log("In iframe:", window !== window.top);
    } catch (e) {
        console.log("In iframe: true (cross-origin)");
    }
}
