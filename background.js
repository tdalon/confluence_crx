import {
    getSearchUrl,
    getObjectFromLocalStorage,
    getSingleSpaceKey,
    CopyLink,
} from "./shared.js";
import { getSnippets, getSnippet } from "./snippets.js";

// Commands
chrome.commands.onCommand.addListener(function (command) {
    switch (command) {
        case "copy_link":
            chrome.tabs.query(
                { active: true, currentWindow: true },
                async function (tabs) {
                    await CopyLink(tabs[0]);
                }
            );
            return;
        case "open_popup": // The command name defined in manifest.json
            chrome.windows.create({
                url: chrome.runtime.getURL("search.html#popup"), // Open the popup window
                type: "popup",
                width: 550, // Match the width of your popup
                height: 800, // Adjust height as needed
                //  top: 100, Optional: Position the popup
                // left: 100  Optional: Position the popup
            });
            return;
        case "open_search": // Open search in a new tab/ full window (not popup)
            chrome.tabs.create({ url: chrome.runtime.getURL("search.html") });
            return;

        case "toc_toggle":
            chrome.tabs.query(
                { active: true, currentWindow: true },
                async function (tabs) {
                    tocToggle(tabs[0].id);
                }
            );
            return;
        case "quick_insert_snippet":
            quickInsertSnippet();
            return;
        default:
            console.log(`Unknown command: ${command}`);
    } // end switch
}); // end command.addListener

function quickInsertSnippet() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            const activeTab = tabs[0];

            // Inject the snippet_selector.js script
            chrome.scripting
                .executeScript({
                    target: { tabId: activeTab.id },
                    files: ["snippet_selector.js"],
                })
                .then(() => {
                    // Send message to show the selector
                    chrome.tabs.sendMessage(activeTab.id, {
                        action: "showSnippetSelector",
                    });
                })
                .catch((err) => {
                    console.error("Error injecting snippet_selector.js:", err);
                });
        }
    });
}
function tocToggle(tabId) {
    // Send message to content script to toggle TOC
    chrome.tabs.sendMessage(tabId, { action: "toggleToc" }, (response) => {
        if (chrome.runtime.lastError) {
            console.log("TOC content script not loaded, injecting...");
            // If content script not loaded, inject it first
            chrome.scripting
                .executeScript({
                    target: { tabId: tabId },
                    files: ["toc-content.js"],
                })
                .then(() => {
                    chrome.scripting
                        .insertCSS({
                            target: { tabId: tabId },
                            files: ["toc-overlay.css"],
                        })
                        .then(() => {
                            // Try sending message again after injection
                            setTimeout(() => {
                                chrome.tabs.sendMessage(tabId, {
                                    action: "toggleToc",
                                });
                            }, 100);
                        });
                })
                .catch((error) => {
                    console.error("Error injecting TOC scripts:", error);
                });
        }
    });
}
function CrxHelp() {
    // Open CRX Help
    chrome.tabs.create({
        url: "https://github.com/tdalon/confluence_crx/blob/main/README.md",
    });
}

function CrxRn() {
    // Open Crx Release Notes
    chrome.tabs.create({
        url: "https://github.com/tdalon/confluence_crx/blob/main/Changelog.md",
    });
}

async function updateContextMenus() {
    // Retrieve the RootUrl from storage
    const rootUrl = await getObjectFromLocalStorage("rooturl");

    if (!rootUrl) {
        console.log("RootUrl is not set. Context menus will not be updated.");
        return;
    }

    // Remove all existing context menus
    chrome.contextMenus.removeAll();

    // Construct the documentUrlPatterns dynamically based on the RootUrl
    //"documentUrlPatterns": ["https://*.atlassian.net/wiki/*/edit-v2/*","https://*.atlassian.net/wiki/*/edit/*" ]
    const pageEditUrlPatterns = [
        `https://*.atlassian.net/wiki/*/edit-v2/*`, // Cloud
        `https://*.atlassian.net/wiki/*/edit/*`,
        `${rootUrl}/pages/resumedraft.action?*`, // server/DC
    ];

    const pageViewUrlPatterns = [
        `${rootUrl}/pages/*`,
        `${rootUrl}/display/*`,
        `${rootUrl}/spaces/*/pages/*`, // DC 9.x
    ];

    chrome.contextMenus.create({
        id: "copy_link",
        title: "Copy Link",
        //documentUrlPatterns: pageViewUrlPatterns,
        contexts: ["page", "frame", "action"],
    });

    chrome.contextMenus.create({
        id: "copy_breadcrumb_link",
        title: "Copy Breadcrumb",
        //documentUrlPatterns: pageViewUrlPatterns,
        contexts: ["page", "frame", "action"],
    });

    chrome.contextMenus.create({
        id: "toc_toggle",
        title: "Toggle Table of Contents",
        contexts: ["action"],
    });

    chrome.contextMenus.create({
        id: "toc_show_page",
        title: "Toggle Table of Contents",
        contexts: ["page", "frame"],
        documentUrlPatterns: pageViewUrlPatterns,
    });

    // Create context menus with the dynamically generated documentUrlPatterns
    chrome.contextMenus.create({
        title: "Numbered Headings: Add Numbers",
        id: "numheading_add",
        //documentUrlPatterns: pageEditUrlPatterns,
        contexts: ["editable"],
    });

    chrome.contextMenus.create({
        title: "Numbered Headings: Remove Numbers",
        id: "numheading_remove",
        //documentUrlPatterns: pageEditUrlPatterns,
        contexts: ["editable"],
    });

    // Create settings menus with accelerator keys
    /* chrome.contextMenus.create({
        id: "crx_options",
        title: "&Options",
        contexts: ["action"],
    }); */

    chrome.contextMenus.create({
        id: "crx_snippets",
        title: "&Snippets Manager",
        contexts: ["action"],
    });

    chrome.contextMenus.create({
        id: "crx_label_dict",
        title: "&Label Dictionary",
        contexts: ["action"],
    });

    // Create help menus
    chrome.contextMenus.create({
        id: "crx_help",
        title: "Help",
        contexts: ["action"],
    });

    chrome.contextMenus.create({
        id: "crx_rn",
        title: "Release Notes",
        contexts: ["action"],
    });

    chrome.contextMenus.create({
        id: "snippet-selector",
        title: "&Snippet Selector",
        contexts: ["editable"],
    });

    console.log("Context menus updated with RootUrl:", rootUrl);
} // end function updateContextMenus

// Call updateContextMenus when the extension starts
updateContextMenus();

// Listen for changes to the RootUrl and update context menus dynamically
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes.rooturl) {
        updateContextMenus();
    }
});

// Handle context menu clicks for snippets
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId.startsWith("snippet-")) {
        const snippetName = info.menuItemId.substring("snippet-".length);

        try {
            const snippetData = await getSnippet(snippetName);

            if (snippetData) {
                console.log(
                    "Sending snippet to content script:",
                    snippetName,
                    snippetData
                );

                // First, ensure the content script is injected
                chrome.scripting
                    .executeScript({
                        target: { tabId: tab.id },
                        files: ["snippet-injector.js"],
                    })
                    .then(() => {
                        // Then send the snippet data to the content script
                        chrome.tabs
                            .sendMessage(tab.id, {
                                action: "insertSnippet",
                                snippetData: snippetData,
                            })
                            .then((response) => {
                                if (response) {
                                    if (response.canceled) {
                                        console.log(
                                            "User canceled snippet insertion"
                                        );
                                        // No need to show an error notification
                                    } else if (!response.success) {
                                        console.error(
                                            "Error inserting snippet:",
                                            response.error
                                        );
                                        chrome.notifications.create({
                                            type: "basic",
                                            iconUrl: "images/icon-48.png",
                                            title: "Snippet Insertion Failed",
                                            message:
                                                response.error ||
                                                "Unknown error occurred",
                                            priority: 1,
                                        });
                                    }
                                }
                            })
                            .catch((error) => {
                                console.error(
                                    "Error sending message to content script:",
                                    error
                                );
                            });
                    })
                    .catch((error) => {
                        console.error("Error injecting content script:", error);
                    });
            }
        } catch (error) {
            console.error("Error retrieving snippet:", error);
        }
    }
});

// Listen for changes to snippets and update context menus
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (
        namespace === "sync" &&
        (changes.snippet_index ||
            Object.keys(changes).some((key) =>
                key.startsWith("snippet_chunk_")
            ))
    ) {
        updateContextMenus();
    }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "showNotification") {
        chrome.notifications.create({
            type: "basic",
            iconUrl: "images/icon-48.png",
            title: message.title || "Confluence CRX",
            message: message.message || "",
            priority: 1,
        });
        sendResponse({ success: true });
    } else if (message.action === "insertSnippet" && message.snippetData) {
        // Get the active tab
        chrome.tabs.query(
            { active: true, currentWindow: true },
            function (tabs) {
                if (tabs.length > 0) {
                    const activeTab = tabs[0];

                    // Inject the snippet-injector.js script if needed
                    chrome.scripting
                        .executeScript({
                            target: { tabId: activeTab.id },
                            files: ["snippet-injector.js"],
                        })
                        .then(() => {
                            // Send the snippet data to the content script
                            chrome.tabs
                                .sendMessage(activeTab.id, {
                                    action: "insertSnippet",
                                    snippetData: message.snippetData,
                                })
                                .catch((error) => {
                                    console.error(
                                        "Error sending message to content script:",
                                        error
                                    );
                                });
                        })
                        .catch((error) => {
                            console.error(
                                "Error injecting snippet-injector.js:",
                                error
                            );
                        });
                }
            }
        );
    } else if (message.action === "openSnippetManager") {
        console.log("Opening snippet manager");
        chrome.tabs.create({ url: chrome.runtime.getURL("snippets.html") });
        sendResponse({ success: true });
       
    } else if (message.action === "getSnippets") {
        getSnippets()
            .then((snippets) => {
                sendResponse({ success: true, snippets: snippets });
            })
            .catch((error) => {
                console.error("Error retrieving snippets:", error);
                sendResponse({ success: false, error: error.message });
            });
    } else if (
        message.action === "insertSnippetFromSelector" &&
        message.snippetName
    ) {
        // Handle snippet insertion from the selector
        getSnippet(message.snippetName)
            .then((snippetData) => {
                if (snippetData) {
                    // Get the active tab
                    chrome.tabs.query(
                        { active: true, currentWindow: true },
                        function (tabs) {
                            if (tabs && tabs[0]) {
                                const activeTab = tabs[0];

                                // First, ensure the content script is injected
                                chrome.scripting
                                    .executeScript({
                                        target: { tabId: activeTab.id },
                                        files: ["snippet-injector.js"],
                                    })
                                    .then(() => {
                                        // Then send the snippet data to the content script
                                        chrome.tabs
                                            .sendMessage(activeTab.id, {
                                                action: "insertSnippet",
                                                snippetData: snippetData,
                                            })
                                            .catch((error) => {
                                                console.error(
                                                    "Error sending message to content script:",
                                                    error
                                                );
                                            });
                                    })
                                    .catch((error) => {
                                        console.error(
                                            "Error injecting content script:",
                                            error
                                        );
                                    });
                            }
                        }
                    );

                    sendResponse({ success: true });
                } else {
                    sendResponse({
                        success: false,
                        error: "Snippet not found",
                    });
                }
            })
            .catch((error) => {
                console.error("Error retrieving snippet:", error);
                sendResponse({ success: false, error: error.message });
            });
    }
    return true;
});

// Add Context Menu listener
chrome.contextMenus.onClicked.addListener(function (info, tab) {
    switch (info.menuItemId) {
        case "crx_help":
            CrxHelp();
            return;
        case "crx_rn":
            CrxRn();
            return;
        case "crx_options":
            if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                window.open(chrome.runtime.getURL("options.html"));
            }
            return;
        case "crx_snippets":
            chrome.tabs.create({
                url: chrome.runtime.getURL("snippets.html"),
            });
            return;
        case "crx_label_dict":
            chrome.tabs.create({
                url: chrome.runtime.getURL("label-dictionary.html"),
            });
            return;
        case "snippet-selector":
            quickInsertSnippet();
        case "toc_toggle":
        case "toc_show_page":
            tocToggle(tab.id);
            return;
        case "numheading_add":
            chrome.tabs.query(
                { active: true, currentWindow: true },
                function (tabs) {
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ["numheading_add.js"],
                    });
                }
            );
            return;
        case "numheading_remove":
            chrome.tabs.query(
                { active: true, currentWindow: true },
                function (tabs) {
                    chrome.scripting.executeScript({
                        target: { tabId: tabs[0].id },
                        files: ["numheading_remove.js"],
                    });
                }
            );
            return;
        case "copy_link":
            chrome.tabs.query(
                { active: true, currentWindow: true },
                async function (tabs) {
                    await CopyLink(tabs[0]);
                }
            );
            return;
        case "copy_breadcrumb_link":
            chrome.tabs.query(
                { active: true, currentWindow: true },
                async function (tabs) {
                    await CopyLink(tabs[0], "breadcrumb");
                }
            );
            return;
        default:
            return;
    } // end switch
});

// #START
chrome.omnibox.onInputEntered.addListener(async function (searchQuery) {
    // if user enters a keyword after the omnibox keyword, redirect search to different destination
    var splitText = searchQuery.split(" ");
    var firstWord = splitText[0];

    if (firstWord === "h" || firstWord === "-h") {
        CrxHelp();
        return;
    }

    if (firstWord == "-r" || firstWord === "r") {
        CrxRn();
        return;
    }

    // create a new page
    if (firstWord == "-c" || firstWord === "c") {
        var spaceKey = await getSingleSpaceKey(searchQuery);
        if (!spaceKey) {
            // fallback if defspace not set to settings
            return;
        }
        const rooturl = await getObjectFromLocalStorage("rooturl");
        const u = rooturl + "/pages/createpage.action?spaceKey=" + spaceKey;
        // Open the URL in new tab and exit the function
        chrome.tabs.update({ url: u });
        return;
    }

    // Quick Navigate to Space

    if (firstWord === "n" || firstWord === "-n") {
        var spaceKey = await getSingleSpaceKey(searchQuery);
        if (!spaceKey) {
            // fallback if defspace not set to settings
            return;
        }
        const rooturl = await getObjectFromLocalStorage("rooturl");
        let u;
        if (rooturl.includes(".atlassian.net")) {
            // cloud
            u = rooturl + "/spaces/" + spaceKey;
        } else {
            u = rooturl + "/display/" + spaceKey;
        }
        // Open the URL in new tab and exit the function
        chrome.tabs.update({ url: u });
        return;
    }

    //const searchQuery = encodeURIComponent(searchQuery);
    const advancedSearch = await getObjectFromLocalStorage("advancedsearch");

    if (advancedSearch && !searchQuery.match(/(\s|^)\-?o(\s|$)/)) {
        // not quick open
        const u = await getSearchUrl(searchQuery);
        // Open the URL in new tab and exit the function
        chrome.tabs.update({ url: u });
    } else {
        searchQuery = encodeURIComponent(searchQuery); // for conflict with #label
        chrome.tabs.update({
            url:
                chrome.runtime.getURL("search.html?q=" + searchQuery) +
                "#window",
        });
    }
}); // end omnibox.onInputEntered.addListener

String.prototype.replaceAll = function (search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, "g"), replacement);
};

// ----------------------------------------------------------------------------------------------------------
function closeCurrentTab() {
    // Close current tab and browser window if last tab
    // chrome.tabs.remove will not close the window on last tab closure -> needs to check if single tab opened
    chrome.tabs.query(
        {
            //active: true,
            currentWindow: true,
        },
        function (tabs) {
            if (tabs.length > 1) {
                chrome.tabs.query(
                    {
                        active: true,
                        currentWindow: true,
                    },
                    function (tabs) {
                        chrome.tabs.remove(tabs[0].id, function () {});
                    }
                );
            } else {
                chrome.windows.getCurrent(function (win) {
                    chrome.windows.remove(win.id, function () {});
                });
            }
        }
    );
} // eofun
