import {Query2Cql, getSpaceKeyFromUrl, getSearchUrl, getSpaceKey, getObjectFromLocalStorage, getLastAccessedSpaceKey} from './shared.js';

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

document.addEventListener('DOMContentLoaded', async function () {
    // Initial fetch of last accessed space key
    await fetchLastAccessedSpaceKey();
    
    chrome.storage.sync.get('rooturl', (data) => {
        var rooturl = data.rooturl;
        if (typeof rooturl ==='undefined' || rooturl === '') {
            alert('Set Confluence rooturl in the Options!');
            window.open(chrome.runtime.getURL('options.html'));
            return;
        }
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
            spaceStatus.innerHTML = statusText;
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

    // Listen for changes in the search query to detect space flags
    searchQueryInput.addEventListener('input', async function() {
        // If the query contains -l flag, fetch the last accessed space key
        if (getSpaceFlagType(searchQueryInput.value) === 'l') {
            await fetchLastAccessedSpaceKey();
        }
        
        chrome.storage.sync.get('defspace', (data) => {
            updateSpaceKeyState(data.defspace, searchQueryInput.value);
        });
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

    const formElement = document.getElementById('confluenceForm');
    
    document.getElementById('confluenceForm').addEventListener('submit', async function (e) {
        if (isCtrlPressed || isShiftPressed) {
            // If Ctrl or Shift is pressed, call advancedSearch
            const searchQuery = document.getElementById('confluenceSearchQuery').value;
            const u = await getSearchUrl(searchQuery); 
            // Open the URL in new tab and exit the function
            chrome.tabs.create({ url: u });
        } else {
            // Otherwise, call showResults
            showResults();
        }
        e.preventDefault();
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
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL('options.html'));
        }
    });

    document.getElementById('popout').addEventListener('click', function() {
        const q= document.getElementById("confluenceSearchQuery").value;
        chrome.tabs.create({url: chrome.runtime.getURL('search.html?q=' + encodeURIComponent(q))});
    });

    document.getElementById('results_next').addEventListener('click', function() {
      nextResults();
    });

    document.getElementById('results_prev').addEventListener('click', function() {
        prevResults();
    });

    document.getElementById('results_next').addEventListener("keyup", function(e) {
        if (e.key === 'Enter') {
            nextResults();
        }
    });

    document.getElementById('results_prev').addEventListener("keyup", function(e) {
        if (e.key === 'Enter') {
            prevResults();
        }
    });

    if (window.location.hash == '#popup') {
        document.getElementById("title").style.display = "none";
        // make links in popout clickable
        $('body').on('click', 'a', function(){
            chrome.tabs.create({url: $(this).attr('href')});
            return false;
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
            
            // If the query contains -l flag or default space is 'l', fetch the last accessed space key
            if (getSpaceFlagType(q) === 'l' || defspaceSelect.value === 'l') {
                await fetchLastAccessedSpaceKey();
                // Update space key state AFTER fetching the last accessed space key
                chrome.storage.sync.get('defspace', (data) => {
                    console.log('Updating space key state after fetching last accessed space key');
                    updateSpaceKeyState(data.defspace, q);
                });
            } else {
                // Update space key state if no need to fetch last accessed space key
                chrome.storage.sync.get('defspace', (data) => {
                    updateSpaceKeyState(data.defspace, q);
                });
            }
            
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
    
    const resultsElt = document.getElementById('results');
    // clear previous results
    resultsElt.innerHTML = '';
    
    // Use fetch 
    const response = await fetch(u);
    g_SearchResponse = await response.json();
    
    // First check HTTP status from the response object
    if (response.status === 401 || response.status === 403) {
        const statusText = response.status === 401 ? "Unauthorized" : "Forbidden";
        
        // Create a more informative error message in the results area
        resultsElt.innerHTML = `
            <div class="error-container">
                <h3>Authentication Error (${response.status} ${statusText})</h3>
                <p>You need to be logged in to Confluence to perform this search.</p>
                <p>Please <a href="${rootUrl}" target="_blank">log in to Confluence</a> and try again.</p>
            </div>
        `;
        
        // Update the results message
        document.getElementById('results_msg').textContent = `Authentication error: ${statusText}`;
        
        // Hide navigation buttons
        document.getElementById('results_next').style.display = "none";
        document.getElementById('results_prev').style.display = "none";
        
        return;
    }
            
    
    // Handle other HTTP error status codes
    if (response.status >= 400) {
        resultsElt.innerHTML = `
            <div class="error-container">
                <h3>Server Error (${response.status})</h3>
                <p>The Confluence server returned an error.</p>
                <p class="error-details">Error message: ${g_SearchResponse.message || response.statusText}</p>
            </div>
        `;
        
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
            resultsElt.innerHTML = `
                <div class="error-container">
                    <h3>Login Required</h3>
                    <p>You need to be logged in to Confluence to perform this search.</p>
                    <p>Please <a href="${loginUrl}" target="_blank">log in to Confluence</a> and try again.</p>
                </div>
            `;
        
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
    
    // Update the search query in the search bar
  //  document.getElementById("confluenceSearchQuery").value = g_SearchResponse.query.value;
    
    // Clear previous search 
    
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
        if (ismultispace) {
            const spaceKey = await getSpaceKeyFromUrl(rootUrl + result._links.webui);
            result_title.innerHTML = '<a href="' + rootUrl + result._links.webui + '">' + result.title + '</a><span class="space-key">' + spaceKey + '</span>';
        } else {
            result_title.innerHTML = '<a href="' + rootUrl + result._links.webui + '">' + result.title + '</a>';
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
    
    var searchQuery = document.getElementById('confluenceSearchQuery').value;
    
    // If the query contains -l flag, refresh the last accessed space key
    if (searchQuery.match(/(\s|^)\-?l(\s|$)/)) {
        await fetchLastAccessedSpaceKey();
    }
    
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
    let cql = Query2Cql(searchQuery, spacekey, type);
    let searchUrl = rootUrl + '/rest/api/content/search?cql=' + cql + '&limit=' + limit.toString();
    //alert(searchUrl);
    return searchUrl;
} // eofun getApiSearchUrl