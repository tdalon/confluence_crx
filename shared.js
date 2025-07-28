
export function showHint(message, timeout = 2000) {
  // Create the hint div
  const hintNode = document.createElement('div');
  hintNode.textContent = message;
  Object.assign(hintNode.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: 10000,
    background: '#444',
    color: '#fff',
    padding: '10px 20px',
    borderRadius: '5px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
    fontFamily: 'sans-serif',
    opacity: '0',
    transition: 'opacity 0.3s'
  });

  document.body.appendChild(hintNode);

  // Animate in
  setTimeout(() => { hintNode.style.opacity = '1'; }, 50);

  // Auto-remove after timeout
  setTimeout(() => {
    hintNode.style.opacity = '0';
    setTimeout(() => hintNode.remove(), 300);
  }, timeout);
}

function showAlert(message) {
  alert(message);
}



async function getRootUrl() {
    let rooturl = await getObjectFromLocalStorage('rooturl');
    
    // fix rooturl
    // remove trailing slash if present
    rooturl = rooturl.replace(/\/$/, "");
    // append .atlassian.net if only subdomain is provided (without .)

    // ensure rooturl starts with http or https
    if (!rooturl.match(/^http/)) {
        rooturl = `https://${rooturl}`;
    }

    // append /wiki if url ends with atlassian.net
    if (!rooturl.match(/\.atlassian\.net$/)) {
        rooturl += '/wiki';
    }
    return rooturl;
};

export async function CopyLink(tab) { 
    
    let url = tab.url;
    const rootUrl = extractRootUrl(url); // Extract the root URL
    const CrxRootUrl = await getObjectFromLocalStorage('rooturl');
    let IsConfluenceUrl = (CrxRootUrl=== rootUrl) || (rootUrl.includes('atlassian.net'))
    let hintText;
    if (!IsConfluenceUrl)  {
        console.log('Link is not a Confluence link');
        hintText="Nice link was copied to the clipboard!";
    } else {
         hintText = "Nice Confluence Page link was copied to the clipboard!";
    }
    if (rootUrl.includes('atlassian.net')) { // cloud version
        // remove edit portion
        url = url.replace(/\/edit\//, '');
        url = url.replace(/\/edit-v2\//, '');
    } else {
        if (IsConfluenceUrl)  {
            let pageId = await getPageIdFromUrl(url);
            if (pageId) {
                url = `${rootUrl}/pages/viewpage.action?pageId=${pageId}`; // Construct the full link
            } else {
                console.log('Page ID not found for URL:', url);
                hintText="Link copied to clipboard but failed to find Page ID for the Confluence link!";
            }         
        }
    }

    //const pageTitle = await getPageTitleFromPageId(pageId,tab.url);
    let text = tab.title;
    // For Confluence links strip second part in title about Confluence instance
    // Use regex to extract the substring before the second '-'
    if (hintText.includes('Confluence')) {
        const match = text.match(/^(.*?\s-\s.*?)\s-\s/); // Match everything up to the second ' - '
        if (match) {
            text = match[1]; // Extract the matched substring and trim whitespace
        }
    }

    chrome.scripting.executeScript({ // Clipboard can only be run from a content script context
    target: { tabId: tab.id },
    func: (url, text) => {
      const html = `<a href="${url}">${text}</a>`;
      const type = "text/html";
      const blob = new Blob([html], { type });
      const clipboardItem = new ClipboardItem({ [type]: blob });

      navigator.clipboard.write([clipboardItem]);
    },
    args: [url, text]
    });

    chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: showHint,
    args: [hintText]
    });

}

async function getPageTitleFromPageId(pageId,url) {
    
    let rootUrl;
    if (!url) {
        rootUrl = extractRootUrl(url); // Extract the root URL from the provided URL
    } else {
        rootUrl = await getObjectFromLocalStorage('rooturl'); // Retrieve the root URL from storage
    }

    const apiUrl = `${rootUrl}/rest/api/content/${pageId}`; // Construct the API URL

    try {
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch page title for pageId ${pageId}: ${response.statusText}`);
        }

        const data = await response.json();

        return data.title; // Return the page title from the API response
    } catch (error) {
        console.error('Error fetching page title:', error);
        throw error; // Rethrow the error for further handling
    }
} // eofun

async function getPageIdFromUrl(url) {
// returns null if could not be found

// Cloud version
if (url.includes(".atlassian.net")) { 
    const regex = /\.atlassian\.net\/wiki\/spaces\/([^/]*)\/pages\/(?:edit\/|edit-v2\/|)([^/]*)/;
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
const responseText = await fetch(url).then(res => res.text()); // Fetch the HTML as text
// Use a regular expression to match the <meta name="ajs-page-id" content="..."> tag
const metaTagMatch = responseText.match(/<meta name="ajs-page-id" content="([^"]*)">/);

if (metaTagMatch) {
    const pageId = metaTagMatch[1]; // Extract the value of the content attribute
    console.log('Page ID extracted from HTML: ' + pageId); // Alert the extracted page ID
    return pageId; // Return the extracted page ID
} 

} // eofun getPageIdFromUrl

export async function getSpaceKey(searchQuery) {
    
var spacekey; 

// Overwrite by options
// Option -g used
if (searchQuery.match(/(\s|^)\-?g(\s|$)/)) { 
    return spacekey = null;        
}

// Option -l for space key from last current opened Confluence page
if (searchQuery.match(/(\s|^)\-?l(\s|$)/) ) { // last used space
    return spacekey = await getLastAccessedSpaceKey(); // returns null if not found        
}

// Option -s for space key from settings or followed word
if (searchQuery.match(/(\s|^)\-?s$/)) { 
    return spacekey = await getObjectFromLocalStorage('spacekey');        
}

const match = searchQuery.match(/(\s|^)\-?s\s([^\s]*)/);
if (match) { 
    return match[2];        
}

// Default values
const defspace = await getObjectFromLocalStorage('defspace');

if (defspace==='g') {
    return null;
} else if (defspace==='l') {
    return spacekey = await getLastAccessedSpaceKey(); // returns null if not found
} else if (defspace==='s') {
    return spacekey = await getObjectFromLocalStorage('spacekey');  
}

} // eofun getSpaceKey

export async function getSingleSpaceKey(searchQuery) {
// return null if space key not found and display an error notification
    var spaceKey = await getSpaceKey(searchQuery);
	if (spaceKey === null) { // fallback if defspace not set to settings
		spaceKey = await getObjectFromLocalStorage('spacekey');  
	}
	if (spaceKey === null) {
        // Display error message using chrome.notifications
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'images/error-48.png', // Replace with the path to your error icon
            title: 'Error:Confluence CRX: Space Key Not Found',
            message: 'Unable to determine the space key. Please check your input or configuration or if a confluence page is opened.',
        });
        return;
    }
	return spaceKey=spaceKey.split(',')[0]; // in case of multiple spacekeys, take the first one
} // eofun getSingleSpaceKey

export async function getSearchUrl(searchQuery) {
    // Calls: Query2Cql
    const rooturl = await getObjectFromLocalStorage('rooturl');
    const type = await getObjectFromLocalStorage('type');

    const spacekey = await getSpaceKey(searchQuery);
    // remove -l option if present in searchQuery
    searchQuery=searchQuery.replace(/(\s|^)\-?l(\s|$)/,'');

    let cql = Query2Cql(searchQuery, spacekey, type);

    let searchUrl = rooturl + '/dosearchsite.action?cql=' + cql;

    return searchUrl;
};

export function Query2Cql(searchStr, spacekey, type) {
    console.log('spacekey='+spacekey+', type='+type+', searchStr='+searchStr);
    // parse labels with prefix #
    const patt = /#[^ ]*/g;
    const arrMatch = searchStr.match(patt);
    let CQLLabels = '';
    if (arrMatch !== null) {
        for (let i = 0; i < arrMatch.length; i++) {
            let tag = arrMatch[i];
            tag = tag.slice(1); // remove trailing #
            tag = tag.replace("&", "%26");
            CQLLabels = CQLLabels + '+AND+label+=+' + tag;
        } // end for tag array
        searchStr = searchStr.replace(patt, '');
    }
    searchStr = searchStr.trim();

    let CQL;
    switch (type) {
        case 'all':
            break;
        case 'page':
            CQL = 'type=' + type;
            break;
        case 'blogpost':
            CQL = 'type=' + type;
            break;
        case 'page&blogpost':
            CQL = '(type=page OR type=blogpost)';
            break;
        default:
            console.log(`Sorry, we are out of ${type}.`);
    }

    // Clean-up options for space from query (Space is processed before in getSpaceKey(queryStr))
    // 1. Clean-up Option -g for global search 
    searchStr = searchStr.replace(/(\s|^)\-?g(\s|$)/,'');
    // 2. Clean-up Option -l for last current opened Confluence page
    searchStr = searchStr.replace(/(\s|^)\-?l(\s|$)/,'');
    // 3. Clean-up Option -s for space key from settings or followed word
    searchStr = searchStr.replace(/(\s|^)\-?s$/,'');
    searchStr = searchStr.replace(/(\s|^)\-?s\s([^\s]*)/);

    if (searchStr) { 
        CQL = CQL + ' AND siteSearch ~ "' + searchStr + '"';
    }
    
    if (spacekey) {
        let spaceCQL;
        const key_array = spacekey.split(',');
        if (key_array.length === 1) { // only one space key
            spaceCQL = 'space=' + key_array[0].trim();
        } else { // more than one space key
            for (let i = 0; i < key_array.length; i++) {
                if (i == 0) {
                    spaceCQL = 'space in (' + key_array[i].trim();
                } else {
                    spaceCQL = spaceCQL + ',' + key_array[i].trim();
                }
            }
            spaceCQL = spaceCQL + ')';
        }
        CQL = CQL + ' AND ' + spaceCQL;
    }
    if (CQLLabels) {
        CQL = CQL + CQLLabels;
    }
    return CQL;
} // eofun Query2Cql

export async function getLastAccessedSpaceKey() {
    const rootUrl = await getObjectFromLocalStorage('rooturl');
    return new Promise((resolve, reject) => {
        // Query all tabs
        chrome.tabs.query({}, async (tabs) => {
            // Filter tabs to find Confluence tabs
            const confluenceTabs = tabs.filter(tab => tab.url && tab.url.startsWith(rootUrl));
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
                console.error('Error fetching last selected Confluence space key:', error);
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
export async function getSpaceKeyFromUrl(url) {
    const rootUrl = await getObjectFromLocalStorage('rooturl');

    try {
        // Check if the URL starts with the root URL
        if (!url.startsWith(rootUrl)) {
            throw new Error(`URL does not belong to the Confluence instance: ${url}`);
        }

        const parsedUrl = new URL(url);

        // Case 1: URL contains `display/spacename`
        if (parsedUrl.pathname.includes('/display/')) {
            const pathSegments = parsedUrl.pathname.split('/');
            const spaceNameIndex = pathSegments.indexOf('display') + 1;
            if (spaceNameIndex > 0 && spaceNameIndex < pathSegments.length) {
                return pathSegments[spaceNameIndex]; // Return the space name
            }
        }

        // Case 2: URL contains `pageId`
        const pageIdMatch = parsedUrl.search.match(/pageId=(\d+)/);
        if (pageIdMatch) {
            const pageId = pageIdMatch[1];
            const apiUrl = `${rootUrl}/rest/api/content/${pageId}`; // Construct the API URL

            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch space name for pageId ${pageId}: ${response.statusText}`);
            }

            const data = await response.json();
            return data.space.key; // Return the space key from the API response
            
        }

        // If neither case matches, return null
        return null;
    } catch (error) {
        console.error('Error fetching space name:', error);
        return null; // Return null if the space name cannot be retrieved
    }
} // eofun getSpaceKeyFromUrl

export const getObjectFromLocalStorage = async function(key) {
    return new Promise((resolve, reject) => {
        try {
            chrome.storage.sync.get(key, function(value) {
                if (chrome.runtime.lastError) {
                    reject(new Error(`Error accessing local storage: ${chrome.runtime.lastError.message}`));
                } else {
                    resolve(value[key]);
                }
            });
        } catch (ex) {
            reject(new Error(`Unexpected error accessing local storage: ${ex.message}`));
        }
    });
};


function extractRootUrl(url) {
    try {
        const parsedUrl = new URL(url); // Parse the URL
        return parsedUrl.origin; // Return the root URL (protocol + hostname + port if present)
    } catch (error) {
        console.error('Error extracting root URL:', error);
        throw new Error(`Invalid URL: ${url}`);
    }
}