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

    // Safe HTML setter to avoid innerHTML security warnings
    function setHTMLContent(element, htmlString) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');
        element.textContent = '';
        while (doc.body.firstChild) {
            element.appendChild(doc.body.firstChild);
        }
    }

    let g_SearchResponse; // global variable

    // Store the state of Ctrl and Shift keys for advanced Search switch
    let isCtrlPressed = false;
    let isShiftPressed = false;
    // Single declaration of lastAccessedSpaceKey at global scope
    let lastAccessedSpaceKey = null;

    window.addEventListener('keydown', function(e) {
        if (e.key === "Control") isCtrlPressed = true;
        if (e.key === "Shift") isShiftPressed = true;
    });
    window.addEventListener('keyup', function(e) {
        if (e.key === "Control") isCtrlPressed = false;
        if (e.key === "Shift") isShiftPressed = false;
    });

    // Function to fetch the last accessed space key - moved outside event listener
    async function fetchLastAccessedSpaceKey() {
        try {
            const spaceKey = await getLastAccessedSpaceKey();
            console.log('fetchLastAccessedSpaceKey retrieved:', spaceKey);
            lastAccessedSpaceKey = spaceKey;
            return spaceKey;
        } catch (error) {
            console.error('Error fetching last accessed space key:', error);
            return null;
        }
    }

    // Function to check which space flag is used in the query - moved outside event listener
    function getSpaceFlagType(query) {
        if (!query) return null;
        
        // Check for -s flag (settings space)
        if (query.match(/(\s|^)\-?s(\s|$)/) || query.match(/(\s|^)\-?s\s([^\s]*)/)) {
            return 's';
        }
        
        // Check for -l flag (last accessed space)
        if (query.match(/(\s|^)\-?l(\s|$)/)) {
            return 'l';
        }
        
        // Check for -g flag (global search)
        if (query.match(/(\s|^)\-?g(\s|$)/)) {
            return 'g';
        }
        
        return null;
    }



    // Function to apply search filters from UI to query

    function ui2query(query) {
        const sortOrderSelect = document.getElementById('sort-order');
        

        const cb_ids = ['cbm', 'bm','w','f','m'];
        for (const cb_id of cb_ids) {
            const cb = document.getElementById(cb_id + '-filter');
            if (cb.checked) {
                query += ` -${cb_id}`;
            } else if (cb.indeterminate) {
                query += ` -!${cb_id}`;
            } 
        }
        
        // Add sort parameter if not set to relevance
        if (sortOrderSelect.value !== 'relevance') {
            query += ' ' + sortOrderSelect.value;
        }
        
        return query;
    }

    document.addEventListener('DOMContentLoaded', async function () {

        chrome.storage.sync.get('rooturl', (data) => {
            const rooturl = data.rooturl;
            if (typeof rooturl ==='undefined' || rooturl === '') {
                // Show error message instead of alert (Firefox blocks alert in popups)
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = 'background:#ffebee;border:2px solid#c62828;padding:15px;margin:10px;border-radius:5px';
                
                const strong = document.createElement('strong');
                strong.style.color = '#c62828';
                strong.textContent = '⚠️ Configuration Required';
                errorDiv.appendChild(strong);
                
                errorDiv.appendChild(document.createElement('br'));
                errorDiv.appendChild(document.createTextNode('Please set Confluence root URL in Options.'));
                errorDiv.appendChild(document.createElement('br'));
                
                const openOptionsBtn = document.createElement('button');
                openOptionsBtn.id = 'openOptionsBtn';
                openOptionsBtn.style.cssText = 'margin-top:10px;padding:5px 10px;cursor:pointer';
                openOptionsBtn.textContent = 'Open Options';
                errorDiv.appendChild(openOptionsBtn);
                
                document.body.insertBefore(errorDiv, document.body.firstChild);
                document.getElementById('openOptionsBtn').addEventListener('click', () => {
                    chrome.windows.create({
                        url: chrome.runtime.getURL('options.html'),
                        type: 'popup',
                        width: 800,
                        height: 600
                    });
                });
                return;
            }

        });

        // Initial fetch of last accessed space key
        await fetchLastAccessedSpaceKey();
        
        // Three-state checkboxes
      

        const checkboxes = document.getElementsByClassName('three-state-checkbox');

        // Apply three-state logic to each checkbox
        Array.from(checkboxes).forEach((checkbox) => {
            
            // Find the associated visual element
            const visualCheckbox = checkbox.nextElementSibling;
            
            // Cycle through states on click
            visualCheckbox.addEventListener('click', () => {
                if (checkbox.indeterminate) {
                    // Indeterminate -> Unchecked
                    checkbox.checked = false;
                    checkbox.indeterminate = false;
                } else if (checkbox.checked) {
                    // Checked -> Indeterminate
                    checkbox.checked = false;
                    checkbox.indeterminate = true;
                } else {
                    //  Unchecked > Checked
                    checkbox.checked = true;
                }
            });
        });




        const spacekeyInput = document.getElementById('spacekey');
        const searchQueryInput = document.getElementById('confluenceSearchQuery');
        const defspaceSelect = document.getElementById('defspace');
        const spaceStatus = document.getElementById('space-status');
        
        
        // Function to update space key state based on default space setting and query
        function updateSpaceKeyState(defspace, query = '') {
            // Check which space flag is used in the query
            const spaceFlag = getSpaceFlagType(query);
            
            // Determine if space key from settings is active
            let isSpaceKeyActive = false;
            let statusText = '';
            
            if (spaceFlag === 's') {
                // -s flag in query overrides everything and makes space key active
                isSpaceKeyActive = true;
                statusText = '';
            } else if (spaceFlag === 'l') {
                // -l flag in query overrides to use last accessed space
                isSpaceKeyActive = false;
                if (lastAccessedSpaceKey) {
                    statusText = `last: <span class="space-key-value">${lastAccessedSpaceKey}</span>`;
                } else {
                    statusText = 'last: none';
                }
            } else if (spaceFlag === 'g') {
                // -g flag in query overrides to use global search
                isSpaceKeyActive = false;
                statusText = 'global';
            } else {
                // No flag in query, use default space setting
                if (defspace === 's') {
                    isSpaceKeyActive = true;
                    statusText = '';
                } else if (defspace === 'l') {
                    isSpaceKeyActive = false;
                    if (lastAccessedSpaceKey) {
                        statusText = `last: <span class="space-key-value">${lastAccessedSpaceKey}</span>`;
                    } else {
                        statusText = 'last: none';
                    }
                } else if (defspace === 'g') {
                    isSpaceKeyActive = false;
                    statusText = 'global';
                }
            }
            
            // Apply appropriate styling
            if (isSpaceKeyActive) {
                spacekeyInput.classList.remove('inactive');
                spaceStatus.style.display = 'none';
            } else {
                spacekeyInput.classList.add('inactive');
                spaceStatus.style.display = 'inline-block';
                spaceStatus.textContent = statusText;
            }
        }
        
        // Load the saved spacekey value and defspace setting when the popup is opened
        chrome.storage.sync.get(['spacekey', 'defspace'], async (data) => {
            if (data.spacekey) {
                spacekeyInput.value = data.spacekey;
            }
            
            if (data.defspace) {
                defspaceSelect.value = data.defspace;
                
                // If default space is set to 'last accessed', refresh the last accessed space key
                if (data.defspace === 'l') {
                    await fetchLastAccessedSpaceKey();
                }
                
                updateSpaceKeyState(data.defspace, searchQueryInput.value);
            }
        });

        // Function to update search filter UI based on query
        async function query2ui(searchQueryInput) {

            // If the query contains -l flag, fetch the last accessed space key
            if (getSpaceFlagType(searchQueryInput.value) === 'l') {
                await fetchLastAccessedSpaceKey();
            }
            
            // Update space key state
            chrome.storage.sync.get('defspace', (data) => {
                updateSpaceKeyState(data.defspace, searchQueryInput.value);
            });
            
            let query = searchQueryInput.value;
            
            
            // Check for sort order parameters
            const sortOrderSelect = document.getElementById('sort-order');
            const o_values = ['oc', 'om', '!oc', '!om'];

            for (const o_val of o_values) {
                if (query.match(new RegExp(`(\\s|^)\\-${o_val}(\\s|$)`)) !== null) {
                    sortOrderSelect.value = o_val.replace('-', '');
                    query = query.replace(new RegExp(`(\\s|^)\\-${o_val}(\\s|$)`), '').trim();
                    break;
                }
                
            }
        
            const cb_ids = ['cbm', 'lbm', 'bm'];
            for (const cb_id of cb_ids) {
                const cb = document.getElementById(cb_id + '-filter');
                if (query.match(new RegExp(`(\\s|^)\\-\\!${cb_id}(\\s|$)`)) !== null) {
                    // Negated filter
                    cb.checked = true;
                    cb.indeterminate = true;
                    query = query.replace(new RegExp(`(\\s|^)\\-\\!${cb_id}(\\s|$)`), '').trim();
                } else if (query.match(new RegExp(`(\\s|^)\\-${cb_id}(\\s|$)`)) !== null) {
                    // Regular filter
                    cb.checked = true;
                    cb.indeterminate = false;
                    query = query.replace(new RegExp(`(\\s|^)\\-${cb_id}(\\s|$)`), '').trim();
                } 
            }

            searchQueryInput.value=query;

        } // eofun query2ui

        // Listen for input in the search query to detect space flags and filter options
        searchQueryInput.addEventListener('input', async function() {
            

            // Update search filter UI based on the query
            await query2ui(searchQueryInput);
            
        });

        // Listen for changes in the default space selector
        defspaceSelect.addEventListener('change', async function() {
            const newDefspace = defspaceSelect.value;
            
            // If changing to 'last accessed', refresh the last accessed space key
            if (newDefspace === 'l') {
                await fetchLastAccessedSpaceKey();
            }
            
            // Save the new default space setting
            chrome.storage.sync.set({'defspace': newDefspace}, function() {
                // Update status to let user know options were saved
                const status = document.getElementById('status_msg');
                status.textContent = 'Default space saved.';
                setTimeout(() => {
                    status.textContent = '';
                }, 750);
                
                // Update the space key state based on the new default space
                updateSpaceKeyState(newDefspace, searchQueryInput.value);
            });
        });
        

        
        document.getElementById('confluenceForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            
            const ctrlPressed = isCtrlPressed;
            const shiftPressed = isShiftPressed;

             // Reset the global variables immediately
            isCtrlPressed = false;
            isShiftPressed = false;
            
            if (ctrlPressed || shiftPressed) {
                    // If Ctrl or Shift is pressed, call advancedSearch
                    // Apply search filters to the query
                    const searchQuery = document.getElementById('confluenceSearchQuery').value;
                    const modifiedQuery = ui2query(searchQuery);
                    const u = await getSearchUrl(modifiedQuery); 
                    // Open the URL in new tab and exit the function
                    chrome.tabs.create({ url: u });
                } else {
                    // Otherwise, call showResults
                    showResults();
                }
            });

        document.getElementById('help').addEventListener('click', function() {
            chrome.tabs.create({url: 'https://github.com/tdalon/confluence_crx'});
        });

        document.getElementById('spacekey').addEventListener("keyup", function(e) {
            if (e.key === 'Enter') {
                var spacekey = document.getElementById('spacekey').value.toUpperCase();
                chrome.storage.sync.set({'spacekey': spacekey }, function () {
                    // Update status to let user know options were saved.
                    const status = document.getElementById('status_msg');
                    status.textContent = 'SpaceKey saved.';
                    setTimeout(() => {
                    status.textContent = '';
                    }, 750);
                });
            }
        });

        document.getElementById('go-to-options').addEventListener('click', function() {
            chrome.windows.create({
                url: chrome.runtime.getURL('options.html'),
                type: 'popup',
                width: 800,
                height: 600
            });
        });

        document.getElementById('popout').addEventListener('click', function() {
            const q = document.getElementById("confluenceSearchQuery").value;
            chrome.tabs.create({url: chrome.runtime.getURL('search.html?q=' + encodeURIComponent(q))});
        });

        document.getElementById('results_next').addEventListener('click', function() {
          nextResults();
        });

        document.getElementById('results_prev').addEventListener('click', function() {
            prevResults();
        });

        document.getElementById('results_next').addEventListener("keydown", function(e) {
            if (e.key === 'Enter') {
                nextResults();
            }
        });

        document.getElementById('results_prev').addEventListener("keydown", function(e) {
            if (e.key === 'Enter') {
                prevResults();
            }
        });

        if (window.location.hash == '#popup') {
            document.getElementById("title").style.display = "none";
            // make links in popout clickable - CONVERTED FROM JQUERY
            document.body.addEventListener('click', function(e) {
                // Check if the clicked element is an anchor tag
                if (e.target.tagName === 'A') {
                    chrome.tabs.create({url: e.target.href});
                    e.preventDefault();
                }
            });
        } else {
            document.getElementById("popout").style.display = "none";
        }

        // Load the search query if passed as option parameter in the Url
        const search = window.location.search;
        if (search) {
            const params = new URLSearchParams(search);
            var q = decodeURIComponent(params.get("q"));
            if (q) {
                document.getElementById("confluenceSearchQuery").value = q;
                await query2ui(document.getElementById("confluenceSearchQuery"));            
                showResults();
                return;
            }   
        }
        
        // Set focus to search bar
        document.getElementById("confluenceSearchQuery").focus();
        // hide results_next and results_prev
        document.getElementById('results_next').style.display = "none";
        document.getElementById('results_prev').style.display = "none";
    });

    // code inspiration https://www.florin-pop.com/blog/2019/06/vanilla-javascript-instant-search/
    function nextResults() {
        var u = g_SearchResponse._links.base + g_SearchResponse._links.next;
        showResults(u);
    }

    function prevResults() {
        var u = g_SearchResponse._links.base + g_SearchResponse._links.prev;
        showResults(u);
    }

    async function showResults(u) {
        
        const rootUrl = await getObjectFromLocalStorage('rooturl');
        if (!u) {
            u = await getApiSearchUrl(rootUrl);
        }
        
        console.log('Fetching results from: '+ u);
        const resultsElt = document.getElementById('results');
        // clear previous results
        resultsElt.textContent = '';
        
        // Use fetch 
        const response = await fetch(u);
        g_SearchResponse = await response.json();
        
        // First check HTTP status from the response object
        if (response.status === 401 || response.status === 403) {
            const statusText = response.status === 401 ? "Unauthorized" : "Forbidden";
            
            // Create a more informative error message in the results area
            setHTMLContent(resultsElt, `
            <div class="error-container">
                <h3>Authentication Error (${response.status} ${statusText})</h3>
                <p>You need to be logged in to Confluence to perform this search.</p>
                <p>Please <a href="${rootUrl}" target="_blank">log in to Confluence</a> and try again.</p>
            </div>
        `);
            
            // Update the results message
            document.getElementById('results_msg').textContent = `Authentication error: ${statusText}`;
            
            // Hide navigation buttons
            document.getElementById('results_next').style.display = "none";
            document.getElementById('results_prev').style.display = "none";
            
            return;
        }
                
        
        // Handle other HTTP error status codes
        if (response.status >= 400) {
            let errorMsg = `${g_SearchResponse.message || response.statusText}`;

            setHTMLContent(resultsElt, `
            <div class="error-container">
                <h3>Server Error (${response.status})</h3>
                <p>The Confluence server returned an error.</p>
                ${
                    errorMsg
                        ? `<p class="error-details">Error message: ${errorMsg}</p>`
                        : '<p class="error-details">Check if the space keys used exist.</p>'
                }
            </div>
        `);
            
            document.getElementById('results_msg').textContent = `Server error: ${response.status}`;
            document.getElementById('results_next').style.display = "none";
            document.getElementById('results_prev').style.display = "none";
            return;
        }
            
            
        if (g_SearchResponse && g_SearchResponse.results && g_SearchResponse.results.length === 0) {
            document.getElementById('results_next').style.display = "none";
            document.getElementById('results_prev').style.display = "none";
               
            
            // Send a secondary request to /rest/api/user/current to check if log in issue
            const userInfo = await fetch(rootUrl + '/rest/api/user/current');
            const user = await userInfo.json();
            
            // Log user information for debugging
            if (user.type === "anonymous" || !user.username) {
                let loginUrl = rootUrl;
                if (!rootUrl.includes('.atlassian.net')) { // Cloud
                   loginUrl = rootUrl + '/login.action';
                }
                setHTMLContent(resultsElt, `
                <div class="error-container">
                    <h3>Login Required</h3>
                    <p>You need to be logged in to Confluence to perform this search.</p>
                    <p>Please <a href="${loginUrl}" target="_blank">log in to Confluence</a> and try again.</p>
                </div>
            `);
            
                //document.getElementById('results_msg').textContent = 'Login required';
                
                // Show a notification for authentication issues
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'images/error-48.png',
                    title: 'Confluence CRX: Authentication Required',
                    message: 'Please log in to Confluence to perform searches.',
                    priority: 1
                });
            return;
            } 
            document.getElementById('results_msg').textContent = 'No result found!';
            return;
        }

        // display response text in console log
        //console.log('Response:', JSON.stringify(g_SearchResponse, null, 2));
        
        // Update the results message
        document.getElementById('results_msg').textContent = '';
        
        // Display navigation buttons
        if (g_SearchResponse._links.prev) {
            document.getElementById('results_prev').style.display = "inline-block";
        } else {
            document.getElementById('results_prev').style.display = "none";
        }
        
        if (g_SearchResponse._links.next) {
            document.getElementById('results_next').style.display = "inline-block";
        } else {
            document.getElementById('results_next').style.display = "none";
        }
        
        if (g_SearchResponse.results.length === 1) { // quick open
            u = rootUrl + g_SearchResponse.results[0]._links.webui;
            if (window.location.hash == '#popup') {
                chrome.tabs.create({url: u});
            } else {
                chrome.tabs.update({url: u});
            }
            return;
        }
        
        const ismultispace = !u.includes(" AND space=");

        const ul = document.createElement('ul');
        ul.classList.add('results');

        for (const result of g_SearchResponse.results) {
            const li = document.createElement('li');
            li.tabindex = 0;
            li.classList.add('result-item');

            const result_title = document.createElement('h3');
            const resultLink = document.createElement('a');
            resultLink.href = rootUrl + result._links.webui;
            resultLink.textContent = result.title;
            result_title.appendChild(resultLink);
            
            if (ismultispace) {
                const spaceKey = await getSpaceKeyFromUrl(rootUrl + result._links.webui);
                if (spaceKey === null) {
                    console.warn('Failed to get space key from URL:', rootUrl + result._links.webui);
                }
                const spaceKeySpan = document.createElement('span');
                spaceKeySpan.className = 'space-key';
                spaceKeySpan.textContent = spaceKey;
                result_title.appendChild(spaceKeySpan);
            }

            result_title.classList.add('result-title');
            li.appendChild(result_title);
            ul.appendChild(li);
        }

        resultsElt.appendChild(ul);
        
        var limit = await getObjectFromLocalStorage('limit');
        
        // Calculate the current range of results being displayed
        let startItem = 1;
        let endItem;
        const totalItems = g_SearchResponse.totalSize;
        // Parse the current URL to extract the start parameter if it exists
        const currentUrlStart = u.match(/[?&]start=(\d+)/);
        if (currentUrlStart && currentUrlStart[1]) {
            startItem = parseInt(currentUrlStart[1]) + 1;
        }
        
        // End item is start item plus the number of results on this page
        endItem = startItem + g_SearchResponse.results.length - 1;
        
        // Format the message
        document.getElementById('results_msg').textContent = 
            `${startItem}-${endItem} of ${totalItems} items:`;
        
        
        document.getElementById('go-to-options').focus();
        
        // Handle navigation buttons visibility based on response links
        if (Object.hasOwn(g_SearchResponse._links,'prev')) {
            document.getElementById('results_prev').style.display = "block";
            document.getElementById('results_prev').title = 'Previous ' + limit.toString();
            document.getElementById('results_next').focus();
        } else {
            document.getElementById('results_prev').style.display = "none";
        }
        
        if (Object.hasOwn(g_SearchResponse._links,'next')) {
            document.getElementById('results_next').style.display = "block";
            document.getElementById('results_next').title = 'Next ' + limit.toString();
            document.getElementById('results_next').focus();
        } else {
            document.getElementById('results_next').style.display = "none";
        }
    } // eofun showResults

    async function getApiSearchUrl(rootUrl) {
        // If no rootUrl is passed, retrieve it dynamically
        if (!rootUrl) {
            rootUrl = await getObjectFromLocalStorage('rooturl');
        }
        
        // Get the search query and apply filters
        var searchQuery = document.getElementById('confluenceSearchQuery').value;
        searchQuery = ui2query(searchQuery);
        
        const spacekey = await getSpaceKey(searchQuery);
        // remove -l option if present in searchQuery
        searchQuery = searchQuery.replace(/(\s|^)\-?l(\s|$)/,'');
         
        const type = await getObjectFromLocalStorage('type');
        
        var limit;
        if (searchQuery.match(/(\s|^)\-?o(\s|$)/)) { // quick open
            searchQuery = searchQuery.replace(/(\s|^)\-?o(\s|$)/,'');
            limit = 1;
        } else {
            limit = await getObjectFromLocalStorage('limit');
        }
        let cql = await Query2Cql(searchQuery, spacekey, type);
        console.log("cql:" + cql);
        let searchUrl = rootUrl + '/rest/api/content/search?cql=' + cql + '&limit=' + limit.toString(); // use content/search for more information about the page like _links.webui
        console.log("searchUrl:" + searchUrl);
        return searchUrl;
    } // eofun getApiSearchUrl

})();
//# sourceURL=search.bundle.js
