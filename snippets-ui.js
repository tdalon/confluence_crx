import {
    saveSnippet,
    getSnippets,
    deleteSnippet,
    clearAllSnippets,
} from "./snippets.js";

let snippetNameInput,
    snippetDescriptionInput,
    snippetTextInput,
    addButton,
    clearButton,
    snippetsContainer,
    notification;
let isEditMode = false,
    originalSnippetName = "";

document.addEventListener("DOMContentLoaded", () => {
    snippetNameInput = document.getElementById("snippet-name");
    snippetDescriptionInput = document.getElementById("snippet-description");
    snippetTextInput = document.getElementById("snippet-text");
    addButton = document.getElementById("add-snippet");
    clearButton = document.getElementById("clear-form");
    snippetsContainer = document.getElementById("snippets-container");
    notification = document.getElementById("notification");

    // Add export/import buttons
    const exportBtn = document.getElementById("export-snippets");
    const importBtn = document.getElementById("import-snippets");
    const deleteAllBtn = document.getElementById("delete-all-snippets");

    if (exportBtn) exportBtn.addEventListener("click", handleExportSnippets);
    if (importBtn) importBtn.addEventListener("click", handleImportSnippets);
    if (deleteAllBtn)
        deleteAllBtn.addEventListener("click", handleDeleteAllSnippets);

    addButton.addEventListener("click", handleSaveSnippet);
    clearButton.addEventListener("click", clearForm);

    // Enable rich pasting functionality
    enableRichPasting();

    snippetTextInput.addEventListener("input", handleContentChange);

    loadSnippets();
    snippetNameInput.focus();
});

// Add export function
async function handleExportSnippets() {
    try {
        const snippets = await getSnippets();

        if (Object.keys(snippets).length === 0) {
            showNotification("No snippets to export.", "error");
            return;
        }

        // Create export data with metadata
        const exportData = {
            version: "1.0",
            exportDate: new Date().toISOString(),
            source: "Confluence CRX",
            snippets: snippets,
        };

        // Convert to JSON
        const jsonData = JSON.stringify(exportData, null, 2);

        // Create a blob and download link
        const blob = new Blob([jsonData], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        // Create filename with date
        const date = new Date().toISOString().split("T")[0];
        const filename = `confluence_crx_snippets_${date}.json`;

        // Create and trigger download
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();

        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);

        showNotification(
            `Exported ${Object.keys(snippets).length} snippets successfully!`,
            "success"
        );
    } catch (error) {
        console.error("Error exporting snippets:", error);
        showNotification("Failed to export snippets.", "error");
    }
}

// Add import function
async function handleImportSnippets() {
    try {
        // Create file input
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".json";

        fileInput.onchange = async (event) => {
            try {
                const file = event.target.files[0];
                if (!file) return;

                const reader = new FileReader();

                reader.onload = async (e) => {
                    try {
                        const content = e.target.result;
                        const importData = JSON.parse(content);

                        // Validate import data
                        if (
                            !importData.snippets ||
                            typeof importData.snippets !== "object"
                        ) {
                            showNotification(
                                "Invalid snippet file format.",
                                "error"
                            );
                            return;
                        }

                        const snippets = importData.snippets;
                        const snippetCount = Object.keys(snippets).length;

                        if (snippetCount === 0) {
                            showNotification(
                                "No snippets found in the import file.",
                                "error"
                            );
                            return;
                        }

                        // Check for conflicts with existing snippets
                        const existingSnippets = await getSnippets();
                        const conflicts = Object.keys(snippets).filter((name) =>
                            existingSnippets.hasOwnProperty(name)
                        );

                        let importAll = true;

                        if (conflicts.length > 0) {
                            const confirmMsg = `${conflicts.length} snippet(s) already exist with the same name. Do you want to overwrite them?`;
                            importAll = confirm(confirmMsg);
                        }

                        // Import snippets
                        let imported = 0;
                        let skipped = 0;

                        for (const name in snippets) {
                            if (
                                !existingSnippets.hasOwnProperty(name) ||
                                importAll
                            ) {
                                const snippetData = snippets[name];
                                await saveSnippet(name, snippetData);
                                imported++;
                            } else {
                                skipped++;
                            }
                        }

                        // Reload snippets in UI
                        loadSnippets();

                        // Show success message
                        const message = `Imported ${imported} snippet(s) successfully!${
                            skipped > 0 ? ` (${skipped} skipped)` : ""
                        }`;
                        showNotification(message, "success");
                    } catch (parseError) {
                        console.error("Error parsing import file:", parseError);
                        showNotification("Invalid JSON file format.", "error");
                    }
                };

                reader.onerror = () => {
                    showNotification("Error reading the file.", "error");
                };

                reader.readAsText(file);
            } catch (fileError) {
                console.error("Error handling file:", fileError);
                showNotification("Error processing the file.", "error");
            }
        };

        // Trigger file selection
        fileInput.click();
    } catch (error) {
        console.error("Error importing snippets:", error);
        showNotification("Failed to import snippets.", "error");
    }
}

// Add delete all function
async function handleDeleteAllSnippets() {
    try {
        const snippets = await getSnippets();
        const snippetCount = Object.keys(snippets).length;

        if (snippetCount === 0) {
            showNotification("No snippets to delete.", "error");
            return;
        }

        const confirmMessage = `Are you sure you want to delete ALL ${snippetCount} snippets? This cannot be undone.`;

        if (confirm(confirmMessage)) {
            const success = await clearAllSnippets();

            if (success) {
                showNotification(
                    `Successfully deleted all ${snippetCount} snippets.`,
                    "success"
                );
                loadSnippets();
                clearForm();
                exitEditMode();
            } else {
                showNotification("Failed to delete all snippets.", "error");
            }
        }
    } catch (error) {
        console.error("Error deleting all snippets:", error);
        showNotification("An error occurred while deleting snippets.", "error");
    }
}

function enableRichPasting() {
    snippetTextInput.addEventListener("paste", (event) => {
        const clipboardData = event.clipboardData || window.clipboardData;

        // Check if HTML content is available in clipboard
        if (clipboardData && clipboardData.types) {
            if (clipboardData.types.includes("text/html")) {
                const htmlData = clipboardData.getData("text/html");
                const textData = clipboardData.getData("text/plain");

                // Only process if we have HTML data and it appears to be rich content
                if (
                    htmlData &&
                    htmlData.trim() &&
                    isRichContent(htmlData, textData)
                ) {
                    event.preventDefault();

                    // Store the HTML content in the textarea
                    snippetTextInput.value = htmlData;
                    snippetTextInput.dataset.detectedFormat = "html";

                    // Update UI to reflect HTML content
                    updateFormatDisplay("html");
                    showHtmlPreview();

                    // Trigger input event to ensure any listeners are notified
                    const inputEvent = new Event("input", { bubbles: true });
                    snippetTextInput.dispatchEvent(inputEvent);

                    return;
                }
            }

            // Check if plain text content might actually be HTML
            // This handles the case when HTML is copied from a plain text editor
            const textData = clipboardData.getData("text/plain");
            if (textData && textData.trim()) {
                const trimmedText = textData.trim();
                // Check if it starts with <html> tag (case insensitive)
                if (isHtmlContent(trimmedText)) {
                    event.preventDefault();

                    // Store the text as HTML content
                    snippetTextInput.value = textData;
                    snippetTextInput.dataset.detectedFormat = "html";

                    // Update UI to reflect HTML content
                    updateFormatDisplay("html");
                    showHtmlPreview();

                    // Trigger input event
                    const inputEvent = new Event("input", { bubbles: true });
                    snippetTextInput.dispatchEvent(inputEvent);

                    return;
                }
            }

            // If we get here, it's not rich HTML content
            setTimeout(() => {
                updateFormatDisplay("text");
                hideHtmlPreview();
            }, 10);
        }
    });
}

function handleContentChange() {
    const content = snippetTextInput.value;
    if (content.trim()) {
        if (isHtmlContent(content)) {
            updateFormatDisplay("html");
            showHtmlPreview();
        } else {
            updateFormatDisplay("text");
            hideHtmlPreview();
        }
    } else {
        updateFormatDisplay("text");
        hideHtmlPreview();
    }
}

function isRichContent(htmlData, textData) {
    if (!htmlData || !htmlData.trim()) return false;

    // Create a temporary element to analyze the HTML
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = htmlData;

    // Check for Confluence-specific elements and classes
    const confluenceElements = tempDiv.querySelectorAll(
        "[data-macro-name], " +
            "[data-node-type], " +
            "[data-layout], " +
            ".confluence-embedded-file, " +
            ".ak-editor-panel, " +
            ".content-wrapper"
    );

    if (confluenceElements.length > 0) {
        return true;
    }

    // Check for rich HTML elements
    const richElements = tempDiv.querySelectorAll(
        "p, div, span[style], strong, em, b, i, u, a, " +
            "table, tr, td, th, ul, ol, li, " +
            "h1, h2, h3, h4, h5, h6, br, img"
    );

    if (richElements.length > 0) {
        return true;
    }

    // Check for elements with style attributes
    const elementsWithStyles = tempDiv.querySelectorAll("[style]");
    if (elementsWithStyles.length > 0) {
        return true;
    }

    // Compare HTML text content with plain text to detect formatting
    const htmlAsText = tempDiv.textContent || tempDiv.innerText || "";
    if (textData && htmlAsText.trim() !== textData.trim()) {
        return true;
    }

    return false;
}

function isHtmlContent(content) {
    return content.match(/^<html>/i);
    const htmlTagPattern = /<[^>]+>/;
    const htmlEntityPattern = /&[a-zA-Z0-9#]+;/;
    const htmlStructurePattern =
        /<(p|div|span|strong|em|b|i|u|a|table|tr|td|th|ul|ol|li|h[1-6]|br)[^>]*>/i;
    return (
        htmlTagPattern.test(content) ||
        htmlEntityPattern.test(content) ||
        htmlStructurePattern.test(content)
    );
}

function updateFormatDisplay(format) {
    snippetTextInput.dataset.detectedFormat = format;
    if (format === "html") {
        snippetTextInput.placeholder =
            "Rich content detected. HTML formatting will be preserved.";
    } else {
        snippetTextInput.placeholder =
            "Enter your snippet content. Use $varname$ syntax for variables.";
    }
    updateFormatIndicator(format);
}

function updateFormatIndicator(format) {
    const existingIndicator = document.querySelector(".format-indicator");
    if (existingIndicator) existingIndicator.remove();
    const indicator = document.createElement("div");
    indicator.className = "format-indicator";
    indicator.style.cssText = `display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 12px; font-weight: bold; margin-left: 10px; ${
        format === "html"
            ? "background-color: #e3fcef; color: #006644;"
            : "background-color: #f4f5f7; color: #6b778c;"
    }`;
    indicator.textContent = format === "html" ? "HTML" : "TEXT";
    const label = document.querySelector('label[for="snippet-text"]');
    if (label) label.appendChild(indicator);
}

function showHtmlPreview() {
    let previewDiv = document.getElementById("html-preview");
    if (!previewDiv) {
        previewDiv = document.createElement("div");
        previewDiv.id = "html-preview";
        previewDiv.className = "html-preview";
        previewDiv.style.cssText =
            "margin-top: 10px; padding: 10px; border: 1px solid #dfe1e6; border-radius: 3px; background-color: #f8f9fa;";
        const previewLabel = document.createElement("label");
        previewLabel.textContent = "Content Structure:";
        previewLabel.style.fontWeight = "bold";
        previewLabel.style.display = "block";
        previewLabel.style.marginBottom = "5px";
        previewDiv.appendChild(previewLabel);
        const previewContent = document.createElement("div");
        previewContent.id = "preview-content";
        previewContent.style.cssText =
            "border: 1px solid #e1e5e9; background-color: white; padding: 8px; border-radius: 3px; min-height: 40px; font-family: monospace; font-size: 12px; color: #6b778c; white-space: pre-wrap;";
        previewDiv.appendChild(previewContent);
        snippetTextInput.parentNode.appendChild(previewDiv);
    }
    previewDiv.style.display = "block";
    updateHtmlPreview();
}

function hideHtmlPreview() {
    const previewDiv = document.getElementById("html-preview");
    if (previewDiv) previewDiv.style.display = "none";
}

function updateHtmlPreview() {
    const previewContent = document.getElementById("preview-content");
    if (previewContent) {
        const htmlContent = snippetTextInput.value;
        if (htmlContent.trim()) {
            const structureSummary = analyzeHtmlStructure(htmlContent);
            previewContent.textContent = structureSummary;
        } else {
            previewContent.innerHTML =
                '<em style="color: #6b778c;">Structure analysis will appear here...</em>';
        }
    }
}

function analyzeHtmlStructure(html) {
    const analysis = [];

    // Extract variables first (moved to top)
    const variables = html.match(/\$[a-zA-Z_][a-zA-Z0-9_]*\$/g);
    if (variables && variables.length > 0) {
        const uniqueVars = [...new Set(variables)];
        analysis.push(`🔧 Variables: ${uniqueVars.join(", ")}`);
        analysis.push("");
    }

    // Extract and display full table of contents (moved to top)
    const headings = extractHeadings(html);
    if (headings.length > 0) {
        analysis.push("📑 Table of Contents:");
        headings.forEach((heading) => {
            const indent = "  ".repeat(heading.level - 1);
            analysis.push(`${indent}• ${heading.text}`);
        });
        analysis.push("");
    }

    // Check for Confluence macros (moved to top)
    const macros = findConfluenceMacros(html);
    if (macros.length > 0) {
        analysis.push("🔌 Confluence Macros:");
        macros.forEach((macro) => {
            analysis.push(`  • ${macro}`);
        });
        analysis.push("");
    }

    return analysis.join("\n");
}

// Helper function to find Confluence macros
function findConfluenceMacros(input) {
    let element;

    if (typeof input === "string") {
        // If input is a string (HTML content), create a temporary element
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = input;
        element = tempDiv;
    } else if (input instanceof Element) {
        // If input is already a DOM element, use it directly
        element = input;
    } else {
        // Invalid input
        console.error("Invalid input to findConfluenceMacros:", input);
        return [];
    }
    const macros = [];
    const macroElements = element.querySelectorAll("[data-macro-name]");

    macroElements.forEach((macro) => {
        const macroName = macro.getAttribute("data-macro-name");
        if (macroName && !macros.includes(macroName)) {
            macros.push(macroName);
        }
    });

    return macros;
}

async function handleSaveSnippet() {
    const name = snippetNameInput.value.trim();
    const description = snippetDescriptionInput.value.trim();
    const text = snippetTextInput.value;
    const format = snippetTextInput.dataset.detectedFormat || "text";
    if (!name) {
        showNotification("Please enter a snippet name.", "error");
        snippetNameInput.focus();
        return;
    }
    if (!text) {
        showNotification("Please enter snippet content.", "error");
        snippetTextInput.focus();
        return;
    }
    const snippets = await getSnippets();
    const exists = snippets.hasOwnProperty(name);
    if (exists && (!isEditMode || name !== originalSnippetName)) {
        const confirmOverwrite = confirm(
            `A snippet named "${name}" already exists. Do you want to overwrite it?`
        );
        if (!confirmOverwrite) return;
    }
    const snippetData = {
        text: text,
        description: description,
        format: format,
    };
    const success = await saveSnippet(name, snippetData);
    if (success) {
        const message = isEditMode
            ? "Snippet updated successfully!"
            : "Snippet saved successfully!";
        showNotification(message, "success");
        clearForm();
        exitEditMode();
        loadSnippets();
    } else {
        showNotification("Failed to save snippet.", "error");
    }
}

async function loadSnippets() {
    const snippets = await getSnippets();
    const snippetNames = Object.keys(snippets);
    snippetsContainer.innerHTML = "";
    if (snippetNames.length === 0) {
        const noSnippetsMsg = document.createElement("p");
        noSnippetsMsg.id = "no-snippets";
        noSnippetsMsg.textContent = "No snippets saved yet.";
        noSnippetsMsg.style.color = "#6b778c";
        noSnippetsMsg.style.fontStyle = "italic";
        snippetsContainer.appendChild(noSnippetsMsg);
        return;
    }
    snippetNames.forEach((name) => {
        const snippetData = snippets[name];
        const text = snippetData.text;
        const description = snippetData.description || "";
        const format = snippetData.format || "text";
        addSnippetToUI(name, text, description, format);
    });
}

function addSnippetToUI(name, text, description = "", format = "text") {
    const snippetItem = document.createElement("div");
    snippetItem.className = "snippet-item";

    // Create header with title, description, and action buttons
    const snippetHeader = document.createElement("div");
    snippetHeader.className = "snippet-header";

    const snippetInfo = document.createElement("div");
    const snippetName = document.createElement("div");
    snippetName.className = "snippet-title";
    const formatBadge =
        format === "html" ? ' <span class="format-badge html">HTML</span>' : "";
    snippetName.innerHTML = name + formatBadge;
    snippetInfo.appendChild(snippetName);

    if (description) {
        const snippetDesc = document.createElement("div");
        snippetDesc.className = "snippet-description";
        snippetDesc.style.cssText =
            "font-size: 14px; color: #6b778c; margin-top: 2px;";
        snippetDesc.textContent = description;
        snippetInfo.appendChild(snippetDesc);
    }

    const snippetActions = document.createElement("div");
    snippetActions.className = "snippet-actions";

    const editButton = document.createElement("button");
    editButton.textContent = "Edit";
    editButton.className = "secondary";
    editButton.addEventListener("click", () =>
        enterEditMode(name, description, text, format)
    );

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.className = "danger";
    deleteButton.addEventListener("click", () => handleDeleteSnippet(name));

    snippetActions.appendChild(editButton);
    snippetActions.appendChild(deleteButton);

    snippetHeader.appendChild(snippetInfo);
    snippetHeader.appendChild(snippetActions);

    // Create content container
    const snippetContent = document.createElement("div");
    snippetContent.className = "snippet-content";

    // Create simplified preview content
    let previewContent = "";

    // Extract variables from the snippet
    const variables = text.match(/\$[a-zA-Z_][a-zA-Z0-9_]*\$/g);
    if (variables && variables.length > 0) {
        const uniqueVars = [...new Set(variables)].map((v) =>
            v.replace(/\$/g, "")
        );
        previewContent += `<div class="snippet-variables">Variables: `;
        uniqueVars.forEach((variable, index) => {
            previewContent += `<span class="variable">${variable}</span>${
                index < uniqueVars.length - 1 ? ", " : ""
            }`;
        });
        previewContent += `</div>`;
    }

    // For HTML content, extract and display headings as TOC
    if (format === "html") {
        const headings = extractHeadings(text);
        if (headings.length > 0) {
            previewContent += `<div class="snippet-toc"><strong>Table of Contents:</strong><br>`;
            headings.forEach((heading, index) => {
                if (index < 5) {
                    // Limit to 5 headings for preview
                    const indent = "&nbsp;".repeat((heading.level - 1) * 2);
                    previewContent += `${indent}• ${heading.text}<br>`;
                } else if (index === 5) {
                    previewContent += `<em>... and ${
                        headings.length - 5
                    } more headings</em>`;
                }
            });
            previewContent += `</div>`;
        }
    }

    // If we have preview content, use it; otherwise show a simple text preview
    if (previewContent) {
        snippetContent.innerHTML = previewContent;
    } else {
        // For plain text with no variables, just show a short preview
        const preview =
            text.length > 100 ? text.substring(0, 100) + "..." : text;
        snippetContent.textContent = preview;
    }

    // Add CSS for the preview elements
    const style = document.createElement("style");
    if (!document.getElementById("snippet-preview-styles")) {
        style.id = "snippet-preview-styles";
        style.textContent = `
            .snippet-variables {
                margin-bottom: 8px;
                color: #5e6c84;
                font-size: 12px;
            }
            .variable {
                display: inline-block;
                padding: 1px 5px;
                background-color: #deebff;
                color: #0747a6;
                border-radius: 3px;
                font-family: monospace;
                font-size: 11px;
                margin: 2px 0;
            }
            .snippet-toc {
                font-size: 12px;
                color: #5e6c84;
                margin-top: 8px;
                line-height: 1.4;
            }
        `;
        document.head.appendChild(style);
    }

    // Assemble the snippet item
    snippetItem.appendChild(snippetHeader);
    snippetItem.appendChild(snippetContent);
    snippetsContainer.appendChild(snippetItem);
}

function enterEditMode(name, description, text, format = "text") {
    isEditMode = true;
    originalSnippetName = name;
    snippetNameInput.value = name;
    snippetDescriptionInput.value = description || "";
    snippetTextInput.value = text;
    snippetTextInput.dataset.detectedFormat = format;
    updateFormatDisplay(format);
    if (format === "html") {
        showHtmlPreview();
    } else {
        hideHtmlPreview();
    }
    addButton.textContent = "Save Changes";
    addButton.className = "primary";
    addButton.style.backgroundColor = "#0052cc";
    snippetNameInput.focus();
}

function exitEditMode() {
    isEditMode = false;
    originalSnippetName = "";
    addButton.textContent = "Add Snippet";
    addButton.className = "primary";
    addButton.style.backgroundColor = "#0052cc";
}

async function handleDeleteSnippet(name) {
    const confirmDelete = confirm(
        `Are you sure you want to delete the snippet "${name}"?`
    );
    if (!confirmDelete) return;
    const success = await deleteSnippet(name);
    if (success) {
        showNotification("Snippet deleted successfully!", "success");
        loadSnippets();
        if (isEditMode && originalSnippetName === name) {
            clearForm();
        }
    } else {
        showNotification("Failed to delete snippet.", "error");
    }
}

function clearForm() {
    snippetNameInput.value = "";
    snippetDescriptionInput.value = "";
    snippetTextInput.value = "";
    snippetTextInput.dataset.detectedFormat = "text";
    updateFormatDisplay("text");
    hideHtmlPreview();
    snippetNameInput.focus();
    exitEditMode();
}

function showNotification(message, type = "success") {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = "block";
    setTimeout(() => {
        notification.style.display = "none";
    }, 3000);
}

// Add this helper function to check for elements with data attributes
function hasElementsWithDataAttributes(element) {
    const allElements = element.querySelectorAll("*");
    for (const el of allElements) {
        for (const attr of el.attributes) {
            if (attr.name.startsWith("data-")) {
                return true;
            }
        }
    }
    return false;
}

// Helper function to extract headings from HTML content
function extractHeadings(html) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;

    const headings = [];
    const headingElements = tempDiv.querySelectorAll("h1, h2, h3, h4, h5, h6");

    headingElements.forEach((heading) => {
        const level = parseInt(heading.tagName.substring(1));
        const text = heading.textContent.trim();
        headings.push({ level, text });
    });

    return headings;
}
