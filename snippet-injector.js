// Snippet injector for Confluence pages

// Check if the script is already loaded to prevent duplicate listeners
if (window.snippetInjectorLoaded) {
    console.log("Snippet injector already loaded, not registering duplicate listeners");
} else {
    // Mark script as loaded
    window.snippetInjectorLoaded = true;
    
    console.log("Snippet injector content script loaded");
    
    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("snippet-injector.js Content script received message:", message);

        if (message.action === "insertSnippet" && message.snippetData) {
            insertSnippet(message.snippetData)
                .then((result) => {
                    if (result && result.canceled) {
                        // Handle canceled insertion gracefully
                        console.log("User canceled snippet insertion");
                        sendResponse({
                            success: false,
                            canceled: true,
                            error: null,
                        });
                    } else {
                        sendResponse({ success: true });
                    }
                })
                .catch((error) => {
                    console.error("Error inserting snippet:", error);
                    sendResponse({
                        success: false,
                        error: error.message,
                    });
                });

            return true; // Keep the message channel open for the async response
        }
    });
}

/**
 * Processes a snippet text to extract variables and prompt the user for values
 * @param {string} snippetText - The snippet text containing variables in $varname$ format
 * @returns {Promise<string>} - The processed snippet with variables replaced by user values
 */
async function processSnippetVariables(snippetText) {
    // Remove any existing variable dialogs
    const existingDialogs = document.querySelectorAll(
        ".confluence-crx-variable-dialog"
    );
    if (existingDialogs.length > 0) {
        console.log(
            `Removing ${existingDialogs.length} existing variable dialogs`
        );
        existingDialogs.forEach((dialog) => {
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
        });
    }

    const variables = extractVariables(snippetText);
    if (variables.length === 0) return snippetText;

    const values = await promptForVariables(variables);
    if (values === null) return null;

    let processedText = snippetText;

    variables.forEach((variable, index) => {
        const value = values[index] || "";
        processedText = processedText.replace(
            new RegExp("\\$" + variable + "\\$", "g"),
            value
        );
    });

    return processedText;
}

function extractVariables(text) {
    const variablePattern = /\$([a-zA-Z_][a-zA-Z0-9_]*)\$/g;
    const variables = [];
    let match;
    while ((match = variablePattern.exec(text)) !== null) {
        const variable = match[1];
        if (!variables.includes(variable)) {
            variables.push(variable);
        }
    }
    return variables;
}

async function promptForVariables(variables) {
    return new Promise((resolve) => {
        const dialog = createVariableDialog(variables, resolve);
        document.body.appendChild(dialog);
    });
}

function createVariableDialog(variables, resolve) {
    const overlay = document.createElement("div");
    overlay.className = "confluence-crx-variable-dialog"; // Use a class instead of ID
    overlay.style.cssText =
        "position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;";
    const dialog = document.createElement("div");
    dialog.style.cssText =
        "background: white; padding: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; font-family: Arial, sans-serif;";
    const title = document.createElement("h3");
    title.textContent = "Enter Variable Values";
    title.style.cssText = "margin-top: 0; color: #172B4D; margin-bottom: 15px;";
    dialog.appendChild(title);
    const form = document.createElement("form");

    // Add form attribute to ensure proper form submission behavior
    form.setAttribute("method", "dialog");

    variables.forEach((variable, index) => {
        const fieldGroup = document.createElement("div");
        fieldGroup.style.cssText = "margin-bottom: 15px;";
        const label = document.createElement("label");
        label.textContent = `${variable}:`;
        label.style.cssText =
            "display: block; margin-bottom: 5px; font-weight: bold; color: #172B4D;";
        const input = document.createElement("input");
        input.type = "text";
        input.name = variable;
        input.style.cssText =
            "width: 100%; padding: 8px; border: 1px solid #DFE1E6; border-radius: 3px; box-sizing: border-box; font-size: 14px;";

        // Add keydown event handler for each input
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();

                // If this is the last input, submit the form
                if (index === variables.length - 1) {
                    submitForm();
                } else {
                    // Otherwise focus the next input
                    const nextInput = form.querySelector(
                        `input[name="${variables[index + 1]}"]`
                    );
                    if (nextInput) nextInput.focus();
                }
            }
        });

        fieldGroup.appendChild(label);
        fieldGroup.appendChild(input);
        form.appendChild(fieldGroup);
    });

    const buttonGroup = document.createElement("div");
    buttonGroup.style.cssText =
        "display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;";
    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Cancel";
    cancelButton.style.cssText =
        "padding: 8px 16px; background: #FFFFFF; color: #172B4D; border: 1px solid #DFE1E6; border-radius: 3px; cursor: pointer;";
    const insertButton = document.createElement("button");
    insertButton.type = "submit";
    insertButton.textContent = "Insert Snippet";
    insertButton.style.cssText =
        "padding: 8px 16px; background: #0052CC; color: white; border: none; border-radius: 3px; cursor: pointer;";
    buttonGroup.appendChild(cancelButton);
    buttonGroup.appendChild(insertButton);
    form.appendChild(buttonGroup);
    dialog.appendChild(form);
    overlay.appendChild(dialog);

    function cleanup() {
        console.log("Cleaning up variable dialog");
        document.removeEventListener("keydown", escHandler);

        // Ensure the overlay is removed from the DOM
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        } else {
            console.warn("Overlay already removed or not in DOM");
        }
    }

    function submitForm() {
        const values = [];
        variables.forEach((variable) => {
            const input = form.querySelector(`input[name="${variable}"]`);
            values.push(input ? input.value : "");
        });
        cleanup();
        resolve(values);
    }

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        submitForm();
    });

    cancelButton.addEventListener("click", () => {
        cleanup();
        resolve(null);
    });

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
            cleanup();
            resolve(null);
        }
    });

    // Use a named function for the escape handler so we can remove it properly
    function escHandler(e) {
        if (e.key === "Escape") {
            cleanup();
            resolve(null);
        }
    }

    document.addEventListener("keydown", escHandler);

    // Focus the first input field after the dialog is created
    setTimeout(() => {
        const firstInput = form.querySelector('input[type="text"]');
        if (firstInput) firstInput.focus();
    }, 50);

    return overlay;
}

// Function to insert text at cursor position
async function insertSnippet(snippetData) {
    console.log("Snippet injector running with data:", snippetData);

    if (!snippetData || !snippetData.text) {
        console.error("Invalid snippet data:", snippetData);
        return Promise.reject(new Error("Invalid snippet data"));
    }

    // Use the extracted function to determine if we're in the Confluence editor
    const isInEditor = detectConfluenceEditor();

    if (!isInEditor) {
        console.log("Not in Confluence editor, can't insert snippet");

        // Run debug to gather more information
        console.log("Running editor environment debug...");

        chrome.runtime.sendMessage({
            action: "showNotification",
            title: "Snippet Insertion Failed",
            message:
                "Please make sure you're in edit mode on a Confluence page.",
        });
        return Promise.reject(new Error("Not in Confluence editor"));
    }

    // Get current cursor position
    let savedRange = null;

    // Try to find the editor iframe - handle different Confluence versions
    const iframe =
        document.querySelector("iframe.editor-iframe") ||
        document.querySelector("iframe.wysiwygTextarea_ifr") ||
        document.querySelector('iframe[id="wysiwygTextarea_ifr"]');

    if (iframe) {
        const selection = iframe.contentWindow.getSelection();
        if (selection && selection.rangeCount > 0) {
            savedRange = selection.getRangeAt(0).cloneRange();
        }
    }

    // Process variables in the snippet
    const snippetText = await processSnippetVariables(snippetData.text);

    // If the processed snippet is empty (user canceled), resolve with a canceled status
    if (!snippetText) {
        console.log("Snippet insertion canceled by user");
        return Promise.resolve({ canceled: true, success: false });
    }

    // Restore cursor position
    if (savedRange && iframe) {
        iframe.contentWindow.focus();
        const selection = iframe.contentWindow.getSelection();
        selection.removeAllRanges();
        selection.addRange(savedRange);
    }

    // Return a Promise to maintain the expected interface
    return new Promise((resolve, reject) => {
        try {
            // Add timeout to ensure DOM is ready
            setTimeout(() => {
                const result = pasteContentAtCursor(
                    snippetText,
                    snippetData.format === "html"
                );
                if (result) {
                    console.log("Snippet successfully inserted");
                    resolve(true);
                } else {
                    reject(
                        new Error(
                            "Could not insert snippet - no suitable insertion point found"
                        )
                    );
                }
            }, 50); // Small delay to ensure DOM is ready
        } catch (error) {
            console.error("Error pasting at cursor:", error);
            reject(error);
        }
    });
}

function pasteContentAtCursor(content, isHTML = false) {
    // Check if we're in the source editor
    const sourceEditor = document.querySelector(".source-editor textarea");
    const activeElement = document.activeElement;

    // If we're in the source editor, use direct insertion
    if (sourceEditor && sourceEditor === activeElement) {
        console.log("Detected source editor, inserting directly");

        // For source editor, always use plain text insertion
        const startPos = activeElement.selectionStart;
        const endPos = activeElement.selectionEnd;

        activeElement.value =
            activeElement.value.substring(0, startPos) +
            content +
            activeElement.value.substring(endPos);

        // Move cursor to end of inserted text
        activeElement.selectionStart = activeElement.selectionEnd =
            startPos + content.length;

        // Trigger input event to ensure Confluence updates
        const event = new Event("input", { bubbles: true });
        activeElement.dispatchEvent(event);

        return true;
    } else {
        // rich editor

        // First copy content to clipboard
        copyToClipboard(content, isHTML);

        // Short delay to ensure content is copied to clipboard
        setTimeout(() => {
            // Try to focus the editor area
            const editorTargets = [
                document.querySelector("#wysiwygTextarea_ifr")?.contentDocument
                    ?.body, // look by id DC 9.x
                document.querySelector(".ProseMirror"), // cloud editor
                document.querySelector('[data-testid="ak-editor-main-area"]'),
                document.querySelector(".ak-editor-content-area"), //
                document.querySelector(".wiki-content-editor"),
                // Try to find the iframe's document if available
                document.querySelector("#editor-iframe")?.contentDocument?.body, // look by id
                document.querySelector("iframe.editor-iframe")?.contentDocument
                    ?.body,
                document.querySelector("iframe.wysiwygTextarea_ifr")
                    ?.contentDocument?.body, // look by class
            ];

            // Find the first available editor target
            const editorTarget = editorTargets.find((target) => target);

            if (editorTarget) {
                console.log("Found editor target:", editorTarget);

                // Focus the editor
                editorTarget.focus();

                // Try to simulate paste command
                const pasteEvent = new ClipboardEvent("paste", {
                    bubbles: true,
                    cancelable: true,
                    clipboardData: new DataTransfer(),
                });

                // Set the clipboard data
                if (isHTML) {
                    pasteEvent.clipboardData.setData("text/html", content);
                } else {
                    pasteEvent.clipboardData.setData("text/plain", content);
                }

                // Dispatch the paste event
                editorTarget.dispatchEvent(pasteEvent);
            } else {
                console.error(
                    "Could not find editor target for simulated paste"
                );
                // Fall back to manual paste notification
                if (chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({
                        action: "showNotification",
                        title: "Snippet Insertion",
                        message:
                            "Could not find editor. Please paste manually (Ctrl+V).",
                    });
                }
            }
        }, 100);

        return true;
    }
}

// Helper function to copy content to clipboard using modern Clipboard API
function copyToClipboard(content, isHTML) {
    if (navigator.clipboard && navigator.clipboard.write) {
        // Modern clipboard API
        const clipboardItems = [];

        if (isHTML) {
            clipboardItems.push(
                new ClipboardItem({
                    "text/html": new Blob([content], { type: "text/html" }),
                })
            );
        } else {
            clipboardItems.push(
                new ClipboardItem({
                    "text/plain": new Blob([content], {
                        type: "text/plain",
                    }),
                })
            );
        }

        navigator.clipboard
            .write(clipboardItems)
            .then(() => console.log("Content copied to clipboard successfully"))
            .catch((err) => {
                console.error("Failed to copy to clipboard:", err);
                if (chrome.runtime && chrome.runtime.sendMessage) {
                    chrome.runtime.sendMessage({
                        action: "showNotification",
                        title: "Error",
                        message:
                            "Failed to copy to clipboard. Please try again.",
                    });
                }
            });
    } else {
        console.error("Clipboard API not available");
        if (chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
                action: "showNotification",
                title: "Error",
                message:
                    "Your browser doesn't support clipboard operations. Please copy manually.",
            });
        }
    }
}

// Helper function to escape special characters in regex
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Export for testing
window.confluenceCrxSnippetInjector = {
    insertSnippet,
    processSnippetVariables,
    extractVariables,
};

function detectConfluenceEditor() {
    // Common editor selectors
    const editorSelectors = [
        ".confluence-editor",
        ".ak-editor-content-area",
        ".ProseMirror",
        ".source-editor",
        ".editor-container",
        ".wysiwyg-editor",
        ".wiki-content-editor",
        "[data-testid='ak-editor-main-area']",
        "[data-testid='editor-container']",
        ".fabric-editor-container",
        ".tinymce",
        "#wysiwygTextarea_ifr", // Older Confluence versions
    ];

    // Check for any matching selector
    for (const selector of editorSelectors) {
        if (document.querySelector(selector)) {
            console.log(`Confluence editor detected via selector: ${selector}`);
            return true;
        }
    }

    // Check for editor iframes
    const editorIframes = [
        "iframe.editor-iframe",
        "iframe.wysiwygTextarea_ifr",
        "iframe[id='wysiwygTextarea_ifr']",
        "iframe.wysiwyg-editor-iframe",
    ];

    for (const iframeSelector of editorIframes) {
        const iframe = document.querySelector(iframeSelector);
        if (iframe) {
            console.log(`Confluence editor iframe detected: ${iframeSelector}`);
            return true;
        }
    }

    // Check for contenteditable elements that might be part of the editor
    const editableElements = document.querySelectorAll(
        '[contenteditable="true"]'
    );
    for (const element of editableElements) {
        // Check if the editable element is within a likely editor container
        const parent = element.closest(
            ".editor-container, .confluence-editor, .ak-editor-content-area"
        );
        if (parent) {
            console.log(
                "Confluence editor detected via contenteditable element in editor container"
            );
            return true;
        }

        // Check if the element has editor-related classes
        if (
            element.classList.contains("editor") ||
            element.classList.contains("wiki-content") ||
            element.classList.contains("confluence-content")
        ) {
            console.log(
                "Confluence editor detected via contenteditable element with editor classes"
            );
            return true;
        }
    }

    // Check for URL patterns that indicate we're in an editor
    const urlPatterns = [
        /\/pages\/edit\//i,
        /\/pages\/resumedraft\.action/i,
        /\/pages\/createpage\.action/i,
        /\/pages\/editpage\.action/i,
        /\/pages\/create-blog\.action/i,
        /\/pages\/edit-v2\//i,
    ];

    for (const pattern of urlPatterns) {
        if (pattern.test(window.location.href)) {
            console.log(
                `Confluence editor detected via URL pattern: ${pattern}`
            );
            return true;
        }
    }

    // Debug information to help diagnose issues
    console.debug(
        "Editor detection failed. Current URL:",
        window.location.href
    );
    console.debug(
        "Available contenteditable elements:",
        editableElements.length
    );

    return false;
}
