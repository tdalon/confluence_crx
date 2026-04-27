// Browser API polyfill for Firefox
console.log('🔧 Confluence Extension Background Script Loading...');
if (typeof browser !== 'undefined' && typeof chrome === 'undefined') {
  console.log('🦊 Firefox detected - mapping browser to chrome');
  globalThis.chrome = browser;
} else {
  console.log('🌐 Chrome/Chromium detected');
}
(function () {
    'use strict';

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
    async function expandLabels(searchQuery) {
        try {
            const labelDict =
                (await getObjectFromLocalStorage$1("labelDictionary")) || {};

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

            // Find all #shortcut patterns in the query (including unicode characters like - or ü)
            const labelPattern = /#([^\s#]+)/g;
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
    async function getObjectFromLocalStorage$1(key) {
        return new Promise((resolve) => {
            chrome.storage.sync.get([key], (result) => {
                resolve(result[key]);
            });
        });
    }

    // ... existing code


    function showHint(message, timeout = 2000) {
        // Create the hint div
        const hintNode = document.createElement("div");
        hintNode.textContent = message;
        Object.assign(hintNode.style, {
            position: "fixed",
            top: "20px",
            right: "20px",
            zIndex: 10000,
            background: "#444",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: "5px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            fontFamily: "sans-serif",
            opacity: "0",
            transition: "opacity 0.3s",
        });

        document.body.appendChild(hintNode);

        // Animate in
        setTimeout(() => {
            hintNode.style.opacity = "1";
        }, 50);

        // Auto-remove after timeout
        setTimeout(() => {
            hintNode.style.opacity = "0";
            setTimeout(() => hintNode.remove(), 300);
        }, timeout);
    }

    async function getRootUrl() {
        let rooturl = await getObjectFromLocalStorage("rooturl");

        // fix rooturl
        // remove trailing slash if present
        rooturl = rooturl.replace(/\/$/, "");
        // append .atlassian.net if only subdomain is provided (without .)
        if (!rooturl.includes(".")) {
            rooturl += ".atlassian.net";
        }

        // ensure rooturl starts with http or https
        if (!rooturl.match(/^http/)) {
            rooturl = `https://${rooturl}`;
        }

        // append /wiki if url ends with atlassian.net
        if (!rooturl.match(/\.atlassian\.net$/)) {
            rooturl += "/wiki";
        }
        return rooturl;
    }

    async function CopyLink(tab, format = null) {
        let url = tab.url;
        const rootUrl = extractRootUrl(url); // Extract the root URL
        const CrxRootUrl = await getObjectFromLocalStorage("rooturl");
        let IsConfluenceUrl =
            CrxRootUrl === rootUrl || rootUrl.includes("atlassian.net/wiki/");
        let hintText;
        if (!IsConfluenceUrl) {
            console.log("Link is not a Confluence link");
            hintText = "Nice link was copied to the clipboard!";
        } else {
            hintText = "Nice Confluence Page link was copied to the clipboard!";
        }
        let pageId;
        if (rootUrl.includes("atlassian.net")) {
            // cloud version: remove edit portion
            url = url.replace(/\/edit\//, "");
            url = url.replace(/\/edit-v2\//, "");
        } 
        if (IsConfluenceUrl) {
            pageId = await getPageIdFromUrl(url);
            console.log("Page ID:", pageId);
            if (pageId) {
                url = `${rootUrl}/pages/viewpage.action?pageId=${pageId}`; // Construct the full link
            } else {
                console.log("Page ID not found for URL:", url);
                hintText =
                    "Link copied to clipboard but failed to find Page ID for the Confluence link!";
            }
        }

        //const pageTitle = await getPageTitleFromPageId(pageId,tab.url);
        let text = tab.title;
        // For Confluence links strip second part in title about Confluence instance
        // Use regex to extract the substring before the second '-'
        if (hintText.includes("Confluence")) {
            var linkFormat =
                format || (await getObjectFromLocalStorage("linkFormat"));
            if (linkFormat === "?") {
                // ask user by question dlg to select between full, middle, short or breadcrumb display mode
                linkFormat = await selectlinkFormat(tab);
                if (linkFormat === null) {
                    console.log("User cancelled the question dialog.");
                    return;
                }
            }

            let lastDashIndex;
            switch (linkFormat) {
                case "short":
                    lastDashIndex = text.lastIndexOf(" - ");
                    if (lastDashIndex !== -1) {
                        text = text.substring(0, lastDashIndex);
                    }
                case "middle":
                    lastDashIndex = text.lastIndexOf(" - ");
                    if (lastDashIndex !== -1) {
                        text = text.substring(0, lastDashIndex);
                    }
                case "full":
                    break;
                case "breadcrumb":
                    // Get the startBreadcrumb parameter from storage
                    const startBreadcrumb = await getObjectFromLocalStorage(
                        "startBreadcrumb"
                    );
                    // Convert to integer
                    const sliceIdx = parseInt(startBreadcrumb, 10);
                    // Pass the sliceIdx parameter to getHtmlBreadcrumb
                    const htmlBreadcrumb = await getHtmlBreadcrumb(
                        pageId,
                        url,
                        sliceIdx
                    );

                    //console.log("Breadcrumb:", htmlBreadcrumb);

                    // Copy to clipboard
                    Clip(tab, htmlBreadcrumb, htmlBreadcrumb);

                    hintText = "Nice Breadcrumb link was copied to the clipboard!";
                    chrome.scripting.executeScript({
                        target: { tabId: tab.id },
                        func: showHint,
                        args: [hintText],
                    });
                    return;

                default:
                    console.log("Invalid linkFormat value:", linkFormat);
                    break;
            } // end switch linkFormat
        }

        // Copy the link using clipboard API
        Clip(tab, `<a href="${url}">${text}</a>`, `${text}: ${url}`);
        
        // Show Hint
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: showHint,
            args: [hintText],
        });
    }

    async function getPageIdFromUrl(url) {
        // returns null if could not be found

        // Cloud version
        if (url.includes(".atlassian.net")) {
            const regex =
                /\.atlassian\.net\/wiki\/spaces\/([^/]*)\/pages\/(?:edit\/|edit-v2\/|)([^/]*)/;
            const match = url.match(regex);

            // If a match is found, return the second capture group (page ID)
            if (match) {
                return match[2]; // Return the page ID
            }
        }

        // server version

        // edit mode
        let pageIdMatch;
        pageIdMatch = url.match(/pages\/resumedraft.action\?draftId=(\d+)/); // Regular expression to match pages/resumedraft.action?draftId=<>number
        if (pageIdMatch) {
            return pageIdMatch[1]; // Return the extracted number
        }
        // Link by pageId
        pageIdMatch = url.match(/pageId=(\d+)/); // Regular expression to match ?pageId=<number>
        if (pageIdMatch) {
            return pageIdMatch[1]; // Return the extracted number
        }
        // Link by page name
        const responseText = await fetch(url).then((res) => res.text()); // Fetch the HTML as text
        // Use a regular expression to match the <meta name="ajs-page-id" content="..."> tag
        const metaTagMatch = responseText.match(
            /<meta name="ajs-page-id" content="([^"]*)">/
        );

        if (metaTagMatch) {
            const pageId = metaTagMatch[1]; // Extract the value of the content attribute
           // console.log("Page ID extracted from HTML: " + pageId); // Alert the extracted page ID
            return pageId; // Return the extracted page ID
        }
    } // eofun getPageIdFromUrl

    async function getSpaceKey(searchQuery) {

        // Overwrite by options
        // Option -g used
        if (searchQuery.match(/(\s|^)\-?g(\s|$)/)) {
            return (null);
        }

        // Option -l for space key from last current opened Confluence page
        if (searchQuery.match(/(\s|^)\-?l(\s|$)/)) {
            // last used space
            return (await getLastAccessedSpaceKey()); // returns null if not found
        }

        // Option -s for space key from settings ; end or before next keyword
        if (searchQuery.match(/(\s|^)\-?s(\s+\-|$)/)) {
            return (await getObjectFromLocalStorage("spacekey"));
        }

        // Option -s for space key followed by word
        const match = searchQuery.match(/(\s|^)\-?s\s+([^\s\-]+)/);
        if (match) {
            return match[2];
        }

        // Default values
        const defspace = await getObjectFromLocalStorage("defspace");

        if (defspace === "g") {
            return null;
        } else if (defspace === "l") {
            return (await getLastAccessedSpaceKey()); // returns null if not found
        } else if (defspace === "s") {
            return (await getObjectFromLocalStorage("spacekey"));
        }
    } // eofun getSpaceKey

    async function getSingleSpaceKey(searchQuery) {
        // return null if space key not found and display an error notification
        var spaceKey = await getSpaceKey(searchQuery);
        if (spaceKey === null) {
            // fallback if defspace not set to settings
            spaceKey = await getObjectFromLocalStorage("spacekey");
        }
        if (spaceKey === null) {
            // Display error message using chrome.notifications
            chrome.notifications.create({
                type: "basic",
                iconUrl: "images/error-48.png", // Replace with the path to your error icon
                title: "Error:Confluence CRX: Space Key Not Found",
                message:
                    "Unable to determine the space key. Please check your input or configuration or if a confluence page is opened.",
            });
            return;
        }
        return (spaceKey = spaceKey.split(",")[0]); // in case of multiple spacekeys, take the first one
    } // eofun getSingleSpaceKey

    async function getSearchUrl(searchQuery) {
        // Calls: Query2Cql

        const rooturl = await getObjectFromLocalStorage("rooturl");
        const type = await getObjectFromLocalStorage("type");

        const spacekey = await getSpaceKey(searchQuery);
        // remove -l option if present in searchQuery
        searchQuery = searchQuery.replace(/(\s|^)\-?l(\s|$)/, "");

        let cql = await Query2Cql(searchQuery, spacekey, type);

        let searchUrl = rooturl + "/dosearchsite.action?cql=" + cql;

        return searchUrl;
    }


    async function Query2Cql(searchStr, spacekey, type) {

    // See Documentation: https://developer.atlassian.com/cloud/confluence/cql-fields/ for cql fields supported
        console.log(
            "spacekey=" + spacekey + ", type=" + type + ", searchStr=" + searchStr
        );

        const originalSearchStr = searchStr;
        // Expand label shortcuts before processing
        searchStr = await expandLabels(searchStr);
        // Only update the search input if it exists and the query was actually expanded
        // Check if document is available (not in service worker context)
        if (originalSearchStr !== searchStr && typeof document !== 'undefined') {
            const searchInput = document.getElementById("confluenceSearchQuery");
            if (searchInput) {
                searchInput.value = searchStr;
            }
        }

        // parse labels with prefix #
        const patt = /#[^ ]*/g;
        const arrMatch = searchStr.match(patt);
        let CQLLabels = "";
        if (arrMatch !== null) {
            for (let i = 0; i < arrMatch.length; i++) {
                let tag = arrMatch[i];
                tag = tag.slice(1); // remove trailing #
                tag = tag.replace("&", "%26");
                CQLLabels = CQLLabels + ' AND label="' + tag + '"';
            } // end for tag array
            searchStr = searchStr.replace(patt, "");
        }
        searchStr = searchStr.trim();

        let CQL;
        switch (type) {
            case "all":
                break;
            case "page":
                CQL = "type=" + type;
                break;
            case "blogpost":
                CQL = "type=" + type;
                break;
            case "page&blogpost":
                // CQL = '(type=page OR type=blogpost)';
                CQL = "type in (page,blogpost)";
                break;
            default:
                console.log(`Sorry, we are out of type for ${type}.`);
        }

        // Clean-up options for space from query (Space is processed before in getSpaceKey(queryStr))
        // 1. Clean-up Option -g for global search
        searchStr = searchStr.replace(/(\s|^)\-?g(\s+|$)/, "");
        // 2. Clean-up Option -l for last current opened Confluence page
        searchStr = searchStr.replace(/(\s|^)\-?l(\s+|$)/, "");
        // 3. Clean-up Option -s for space key from settings or followed word
        searchStr = searchStr.replace(/(\s|^)\-?s(\s+([^\s\-]*)|$)/, "");
        
        

        // sort options
        const orderByModifiedDesc = searchStr.match(/(\s|^)\-?om(\s|$)/);
        if (orderByModifiedDesc) {
            searchStr = searchStr.replace(/(\s|^)\-?om(\s|$)/, "");
        }
          const orderByModifiedAsc = searchStr.match(/(\s|^)\-?!om(\s|$)/);
        if (orderByModifiedAsc) {
            searchStr = searchStr.replace(/(\s|^)\-?!om(\s|$)/, "");
        }
        const orderByCreatedDesc = searchStr.match(/(\s|^)\-?oc(\s|$)/);
        if (orderByCreatedDesc) {
            searchStr = searchStr.replace(/(\s|^)\-?oc(\s|$)/, " ");
        }
        const orderByCreatedAsc = searchStr.match(/(\s|^)\-?!oc(\s|$)/);
        if (orderByCreatedAsc) {
            searchStr = searchStr.replace(/(\s|^)\-?!oc(\s|$)/, " ");
        }

        // User filters
        // Created by me
        const createdByMe = searchStr.match(/(\s|^)\-?cbm(\s|$)/);  
        const notCreatedByMe = searchStr.match(/(\s|^)\-?!cbm(\s|$)/);
        searchStr = searchStr.replace(/(\s|^)\-?!?cbm(\s|$)/, " "); 
        // Watched by me
        const watchedByMe = searchStr.match(/(\s|^)\-?w(\s|$)/); 
        const notWatchedByMe = searchStr.match(/(\s|^)\-?!w(\s|$)/);
        searchStr = searchStr.replace(/(\s|^)\-?!?w(\s|$)/, " "); 
        // Mentioned
         const mentioned = searchStr.match(/(\s|^)\-?m(\s|$)/);  
        const notMentioned = searchStr.match(/(\s|^)\-?!m(\s|$)/);
        searchStr = searchStr.replace(/(\s|^)\-?!?m(\s|$)/, " "); 
        // Favorite
        const favourite = searchStr.match(/(\s|^)\-?f(\s|$)/);
        const notFavourite = searchStr.match(/(\s|^)\-?!f(\s|$)/);
        searchStr = searchStr.replace(/(\s|^)\-?!?f(\s|$)/, " "); 
        
        
         
       // Clean-up Option -bm or bm for contributor=me filter
        const contributedByMe = searchStr.match(/(\s|^)\-?bm(\s|$)/);
        const notContributedByMe = searchStr.match(/(\s|^)\-?\!bm(\s|$)/);
        searchStr = searchStr.replace(/(\s|^)\-?!?bm(\s|$)/, " ").trim();

        if (searchStr) {
            CQL = CQL + ' AND siteSearch ~ "' + searchStr + '"';
        }

        // Add creator=currentUser filter if cbm option was used
        if (createdByMe) {
            CQL = CQL + " AND creator=currentUser()";
        } else if (notCreatedByMe) {
            CQL = CQL + " AND NOT creator=currentUser()";
        } 
         // mentioned
        if (mentioned) {
            CQL = CQL + " AND mention=currentUser()";
        } else if (notMentioned) {
            CQL = CQL + " AND NOT mention=currentUser()";
        } 
        // fav
        if (favourite) {
            CQL = CQL + " AND favourite=currentUser()";
        } else if (notFavourite) {
            CQL = CQL + " AND NOT favourite=currentUser()";
        } 
        // Add contributor filter - contributor does not support currentUser(). call getCurrentUser() function
        if (contributedByMe || notContributedByMe) {
            const username = await getCurrentUser();
           // console.log("currentUser:", username);
            if (username && username !== "anonymous") {
                if (contributedByMe) {
                    CQL = CQL + ` AND contributor="${username}"`;
                } else if (notContributedByMe) {
                    CQL = CQL + ` AND NOT contributor="${username}"`;
                }
            }
        } 
         // watcher
        if (watchedByMe) {
            CQL = CQL + " AND watcher=currentUser()";
        } else if (notWatchedByMe) {
            CQL = CQL + " AND NOT watcher=currentUser()";
        } 
        
       
        if (spacekey) {
            let spaceCQL;
            const key_array = spacekey.split(",");
            if (key_array.length === 1) {
                // only one space key
                spaceCQL = "space=" + key_array[0].trim();
            } else {
                // more than one space key
                for (let i = 0; i < key_array.length; i++) {
                    if (i == 0) {
                        spaceCQL = "space in (" + key_array[i].trim();
                    } else {
                        spaceCQL = spaceCQL + "," + key_array[i].trim();
                    }
                }
                spaceCQL = spaceCQL + ")";
            }
            CQL = CQL + " AND " + spaceCQL;
        }
        
        if (CQLLabels) {
            CQL = CQL + CQLLabels;
        }
        
        // Add sorting clause at the end of the CQL query
        if (orderByModifiedDesc) {
            CQL = CQL + " ORDER BY lastmodified DESC";
        } else if (orderByCreatedDesc) {
            CQL = CQL + " ORDER BY created DESC";
        } else if (orderByCreatedAsc) {
            CQL = CQL + " ORDER BY created ASC";
        } else if (orderByModifiedAsc) {
            CQL = CQL + " ORDER BY lastmodified ASC";
        }
        
        return CQL;
    } // eofun Query2Cql

    async function getCurrentUser(rootUrl) {
        // If no rootUrl is passed, retrieve it dynamically
        if (!rootUrl) {
            rootUrl = await getObjectFromLocalStorage('rooturl');
        }
     // Send a secondary request to /rest/api/user/current to check if log in issue
            const userInfo = await fetch(rootUrl + '/rest/api/user/current');
            const user = await userInfo.json();
            
            // Log user information for debugging
            if (user.type === "anonymous" ) {
                // Show a notification for authentication issues
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'images/error-48.png',
                    title: 'Confluence CRX: User is anonymous.',
                    message: 'User "anonymous" will be ignored as filter.',
                    priority: 2
                });
                return "anonymous";
            }

            return user.username
    } // eofun getCurrentUser

    async function getLastAccessedSpaceKey() {
        const rootUrl = await getObjectFromLocalStorage("rooturl");
        return new Promise((resolve, reject) => {
            // Query all tabs
            chrome.tabs.query({}, async (tabs) => {
                // Filter tabs to find Confluence tabs
                const confluenceTabs = tabs.filter(
                    (tab) => tab.url && tab.url.startsWith(rootUrl)
                );
                if (confluenceTabs.length === 0) {
                    return resolve(null); // No Confluence tabs found
                }

                // Sort tabs by last accessed time (descending order)
                confluenceTabs.sort((a, b) => b.lastAccessed - a.lastAccessed);

                // Get the most recently accessed Confluence tab
                const lastSelectedTab = confluenceTabs[0];
                const url = new URL(lastSelectedTab.url);
                //alert('Last selected URL: ' + url.href);

                try {
                    // Extract the space key from the URL
                    const spaceKey = await getSpaceKeyFromUrl(url.href);
                    resolve(spaceKey); // Return the space key
                } catch (error) {
                    console.error(
                        "Error getting last selected Confluence space key:",
                        error
                    );
                    reject(error);
                }
            });
        });
    } // eofun getLastAcccessedSpaceKey

    /**
     * Retrieves the space name from a given Confluence URL.
     *
     * This function handles two cases:
     * 1. **URL contains `display/spacename`**: Extracts the space name directly from the URL path.
     *    Example: `https://confluence.example.com/display/SPACEKEY/page-title`
     *    Result: `SPACEKEY`
     *
     * 2. **URL contains `pageId`**: Queries the Confluence REST API to retrieve the space name.
     *    Example: `https://confluence.example.com/pages/viewpage.action?pageId=12345`
     *    Result: Space name retrieved via the API.
     *
     *
     * @param {string} url - The URL of the Confluence page.
     * @returns {Promise<string|null>} - The space name if found, or `null` if not retrievable.
     *
     * @throws {Error} - Throws an error if the URL does not belong to the Confluence instance or if the API call fails.
     */
    async function getSpaceKeyFromUrl(url) {
        const rootUrl = await getObjectFromLocalStorage("rooturl");

        try {
            // Check if the URL starts with the root URL
            if (!url.startsWith(rootUrl)) {
                throw new Error(
                    `URL does not belong to the Confluence instance: ${url}`
                );
            }

            const parsedUrl = new URL(url);

            // Case 1: URL contains `display/spacename`
            if (parsedUrl.pathname.includes("/display/")) {
                const pathSegments = parsedUrl.pathname.split("/");
                const spaceNameIndex = pathSegments.indexOf("display") + 1;
                if (spaceNameIndex > 0 && spaceNameIndex < pathSegments.length) {
                    return pathSegments[spaceNameIndex]; // Return the space name
                }
            }

            // Case 2: URL of type /pages/viewpage.action?spaceKey=***&title=
            let spaceKeyMatch = url.match(/[?&]spaceKey=([^&]+)/);
            if (spaceKeyMatch) {
                const spaceKey = spaceKeyMatch[1];
                //console.log("Space key extracted from URL parameter:", spaceKey);
                return spaceKey;
            }

            // Case 3: URL of type /spaces/spaceKey/pages/
            spaceKeyMatch = url.match(/\/spaces\/([^\/]*)\/pages\//);
            if (spaceKeyMatch) {
                const spaceKey = spaceKeyMatch[1];
                //console.log("Space key extracted from URL parameter:", spaceKey);
                return spaceKey;
            }

            // Case 4: URL contains `pageId`
            const pageIdMatch = url.match(/pageId=(\d+)/);
            if (pageIdMatch) {
                const pageId = pageIdMatch[1];
                const apiUrl = `${rootUrl}/rest/api/content/${pageId}`; // Construct the API URL

                const response = await fetch(apiUrl, {
                    method: "GET",
                    headers: {
                        Accept: "application/json",
                    },
                });

                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch space name for pageId ${pageId}: ${response.statusText}`
                    );
                }

                const data = await response.json();
                return data.space.key; // Return the space key from the API response
            }

            // If neither case matches, return null
            return null;
        } catch (error) {
            console.error("Error fetching space name:", error);
            return null; // Return null if the space name cannot be retrieved
        }
    } // eofun getSpaceKeyFromUrl

    const getObjectFromLocalStorage = async function (key) {
        return new Promise((resolve, reject) => {
            try {
                chrome.storage.sync.get(key, function (value) {
                    if (chrome.runtime.lastError) {
                        reject(
                            new Error(
                                `Error accessing local storage: ${chrome.runtime.lastError.message}`
                            )
                        );
                    } else {
                        resolve(value[key]);
                    }
                });
            } catch (ex) {
                reject(
                    new Error(
                        `Unexpected error accessing local storage: ${ex.message}`
                    )
                );
            }
        });
    };

    function extractRootUrl(url) {
        try {
            const parsedUrl = new URL(url); // Parse the URL
            return parsedUrl.origin; // Return the root URL (protocol + hostname + port if present)
        } catch (error) {
            console.error("Error extracting root URL:", error);
            throw new Error(`Invalid URL: ${url}`);
        }
    }

    /**
     * Displays a dialog for the user to select a link display mode
     * @param {Object} tab - The current browser tab
     * @returns {Promise<string|null>} - The selected display mode or null if canceled
     */
    /**
     * Displays a dialog for the user to select a link display mode
     * @param {Object} tab - The current browser tab
     * @returns {Promise<string|null>} - The selected display mode or null if canceled
     */
    async function selectlinkFormat(tab) {
        return new Promise((resolve) => {
            chrome.scripting.executeScript(
                {
                    target: { tabId: tab.id },
                    func: () => {
                        return new Promise((dialogResolve) => {
                            // Create the dialog container
                            const dialog = document.createElement("div");
                            dialog.style.cssText = `
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        z-index: 10000;
                        font-family: Arial, sans-serif;
                        width: 400px;
                    `;

                            // Create the dialog content
                            dialog.innerHTML = `
                        <h3 style="margin-top: 0; color: #172B4D;">Link Display Format</h3>
                        <p style="color: #505F79;">Choose how to display the link text:</p>
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <button id="full-btn" style="padding: 8px; cursor: pointer; background: #F4F5F7; border: 1px solid #DFE1E6; border-radius: 3px;">
                                <strong>Full</strong> - Page Title - Space Name - Confluence Name                            </button>
                            <button id="middle-btn" style="padding: 8px; cursor: pointer; background: #F4F5F7; border: 1px solid #DFE1E6; border-radius: 3px;">
                                <strong>Middle</strong> - Page Title - Space Name
                            </button>
                            <button id="short-btn" style="padding: 8px; cursor: pointer; background: #F4F5F7; border: 1px solid #DFE1E6; border-radius: 3px;">
                                <strong>Short</strong> - Page title only
                            </button>
                            <button id="breadcrumb-btn" style="padding: 8px; cursor: pointer; background: #F4F5F7; border: 1px solid #DFE1E6; border-radius: 3px;">
                                <strong>Breadcrumb</strong> - Path format
                            </button>
                        </div>
                        <div style="margin-top: 15px; text-align: right;">
                            <button id="cancel-btn" style="padding: 6px 12px; cursor: pointer; background: #FFFFFF; border: 1px solid #DFE1E6; border-radius: 3px;">
                                Cancel
                            </button>
                        </div>
                    `;

                            document.body.appendChild(dialog);

                            // Create overlay
                            const overlay = document.createElement("div");
                            overlay.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0,0,0,0.5);
                        z-index: 9999;
                    `;
                            document.body.appendChild(overlay);

                            // Add hover effects to buttons
                            const buttons = dialog.querySelectorAll("button");
                            buttons.forEach((button) => {
                                button.addEventListener("mouseover", () => {
                                    button.style.background =
                                        button.id === "cancel-btn"
                                            ? "#F4F5F7"
                                            : "#EBECF0";
                                });
                                button.addEventListener("mouseout", () => {
                                    button.style.background =
                                        button.id === "cancel-btn"
                                            ? "#FFFFFF"
                                            : "#F4F5F7";
                                });
                            });

                            // Add event listeners
                            document
                                .getElementById("full-btn")
                                .addEventListener("click", () => {
                                    cleanup();
                                    dialogResolve("full");
                                });

                            document
                                .getElementById("middle-btn")
                                .addEventListener("click", () => {
                                    cleanup();
                                    dialogResolve("middle");
                                });

                            document
                                .getElementById("short-btn")
                                .addEventListener("click", () => {
                                    cleanup();
                                    dialogResolve("short");
                                });

                            document
                                .getElementById("breadcrumb-btn")
                                .addEventListener("click", () => {
                                    cleanup();
                                    dialogResolve("breadcrumb");
                                });

                            document
                                .getElementById("cancel-btn")
                                .addEventListener("click", () => {
                                    cleanup();
                                    dialogResolve(null);
                                });

                            // Close dialog when clicking on overlay
                            overlay.addEventListener("click", () => {
                                cleanup();
                                dialogResolve(null);
                            });

                            // Helper function to clean up the dialog
                            function cleanup() {
                                dialog.remove();
                                overlay.remove();
                            }

                            // Handle escape key to cancel
                            document.addEventListener(
                                "keydown",
                                function escHandler(e) {
                                    if (e.key === "Escape") {
                                        document.removeEventListener(
                                            "keydown",
                                            escHandler
                                        );
                                        cleanup();
                                        dialogResolve(null);
                                    }
                                }
                            );
                        });
                    },
                },
                (results) => {
                    if (results && results[0] && results[0].result !== undefined) {
                        resolve(results[0].result);
                    } else {
                        // Default if something goes wrong
                        resolve(null);
                    }
                }
            );
        });
    } // eofun selectlinkFormat

    /**
     * Creates an HTML breadcrumb trail for a Confluence page
     * @param {string} pageId - The ID of the Confluence page
     * @param {string} [url] - Optional URL to help determine the root URL
     * @returns {Promise<string>} - HTML string with the breadcrumb trail
     */
    async function getHtmlBreadcrumb(pageId, url = null, sliceIdx = 1) {
        try {
            // Get the root URL
            let rootUrl;
            if (url) {
                rootUrl = extractRootUrl(url);
                if (rootUrl.includes("atlassian.net")) {
                    rootUrl += "/wiki";
                }
            } else {
                rootUrl = await getRootUrl();
            }

            // Fetch the page details
            const apiUrl = `${rootUrl}/rest/api/content/${pageId}?expand=ancestors,space`;
            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(
                    `Failed to fetch page details for pageId ${pageId}: ${response.statusText}`
                );
            }

            const pageData = await response.json();

            // Start building the breadcrumb
            let breadcrumb = "";

            // Add space link
            const spaceKey = pageData.space.key;
            const spaceName = pageData.space.name;
            let spaceUrl;

            if (rootUrl.includes(".atlassian.net")) {
                // Cloud
                spaceUrl = `${rootUrl}/spaces/${spaceKey}`;
            } else {
                // Server
                spaceUrl = `${rootUrl}/display/${spaceKey}`;
            }

            breadcrumb += `<a href="${spaceUrl}">${spaceName}</a>`;

            // Add ancestors
            if (
                pageData.ancestors &&
                pageData.ancestors.length > 0 &&
                sliceIdx != -1
            ) {
                const ancestorsToShow = pageData.ancestors.slice(sliceIdx + 1); // always skip Home page, -2 only first parent

                ancestorsToShow.forEach((ancestor) => {
                    const ancestorTitle = shortenTitle(ancestor.title);
                    let ancestorUrl;

                    if (rootUrl.includes(".atlassian.net")) {
                        // Cloud
                        ancestorUrl = `${rootUrl}/spaces/${spaceKey}/pages/${ancestor.id}`;
                    } else {
                        // Server
                        ancestorUrl = `${rootUrl}/pages/viewpage.action?pageId=${ancestor.id}`;
                    }
                    breadcrumb += ` &gt; <a href="${ancestorUrl}">${ancestorTitle}</a>`;
                });
            }

            // Add current page
            const pageTitle = shortenTitle(pageData.title);
            let pageUrl;

            if (rootUrl.includes(".atlassian.net")) {
                // Cloud
                pageUrl = `${rootUrl}/spaces/${spaceKey}/pages/${pageId}`;
            } else {
                // Server
                pageUrl = `${rootUrl}/pages/viewpage.action?pageId=${pageId}`;
            }

            breadcrumb += ` &gt; <a href="${pageUrl}">${pageTitle}</a>`;

            return breadcrumb;
        } catch (error) {
            console.error("Error generating breadcrumb:", error);
            return `<span style="color: red;">Error generating breadcrumb: ${error.message}</span>`;
        }
    } // eofun getHtmlBreadcrumb

    function shortenTitle(title, count = 1, sep = " - ") {
        if (title.match(/ - (intern|public)$/)) {
            // exceptions for pages ending with 'intern' or 'public'
            return title;
        }
        let lastDashIndex;
        for (let i = 0; i < count; i++) {
            lastDashIndex = title.lastIndexOf(sep);
            if (lastDashIndex !== -1) {
                title = title.substring(0, lastDashIndex);
            }
        }
        return title;
    } // eofun shortenTitle

    function Clip(tab, html, plain) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (html, plain) => {
                navigator.clipboard.write([
                    new ClipboardItem({
                        "text/html": new Blob([html], { type: "text/html" }),
                        "text/plain": new Blob([plain], { type: "text/plain" }),
                    }),
                ]);
            },
            args: [html, plain],
        });
    } // eofun Clip

    const SNIPPET_INDEX_KEY = "snippet_index";
    const SNIPPET_CHUNK_PREFIX = "snippet_chunk_";

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
    async function getSnippets() {
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
    async function getSnippet(name) {
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
            // In Firefox, lastError might not be set, but response will be undefined if no listener exists
            if (chrome.runtime.lastError || response === undefined) {
                console.log("TOC content script not loaded, injecting...");
                // If content script not loaded, inject it first
                // Use different API depending on Manifest version
                if (chrome.scripting) {
                    // Manifest V3 API (Chrome)
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
                                    // After injection, send the toggle message again
                                    chrome.tabs.sendMessage(
                                        tabId,
                                        { action: "toggleToc" },
                                        (response) => {
                                            console.log("TOC toggled:", response);
                                        }
                                    );
                                });
                        });
                } else {
                    // Manifest V2 API (Firefox)
                    chrome.tabs.executeScript(
                        tabId,
                        { file: "toc-content.js" },
                        () => {
                            chrome.tabs.insertCSS(
                                tabId,
                                { file: "toc-overlay.css" },
                                () => {
                                    // After injection, send the toggle message again
                                    chrome.tabs.sendMessage(
                                        tabId,
                                        { action: "toggleToc" },
                                        (response) => {
                                            console.log("TOC toggled:", response);
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
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

    // Handle all context menu clicks
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
        // Handle snippet menu items
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
            return;
        }

        // Handle all other menu items
        switch (info.menuItemId) {
            case "crx_help":
                CrxHelp();
                return;
            case "crx_rn":
                CrxRn();
                return;
            case "crx_options":
                chrome.windows.create({
                    url: chrome.runtime.getURL("options.html"),
                    type: 'popup',
                    width: 800,
                    height: 600
                });
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
                return;
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
        if (advancedSearch === "true" && !searchQuery.match(/(\s|^)\-?o(\s|$)/)) {
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

})();
