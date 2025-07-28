
import {Query2Cql, getSpaceKeyFromUrl, getSearchUrl, getSpaceKey} from './shared.js';

let g_SearchResponse;

// Store the state of Ctrl and Shift keys for advanced Search switch https://www.perplexity.ai/search/in-my-chrome-extension-i-have-M_y8SHhqQ6KNjgPviHNC3g
let isCtrlPressed = false;
let isShiftPressed = false;

window.addEventListener('keydown', function(e) {
    if (e.key === "Control") isCtrlPressed = true;
    if (e.key === "Shift") isShiftPressed = true;
});
window.addEventListener('keyup', function(e) {
    if (e.key === "Control") isCtrlPressed = false;
    if (e.key === "Shift") isShiftPressed = false;
});


document.addEventListener('DOMContentLoaded', function () {

    chrome.storage.sync.get('rooturl', (data) => {
		var rooturl = data.rooturl;
        if (typeof rooturl ==='undefined' || rooturl === '') {
            alert('Set Confluence rooturl in the Options!');
            window.open(chrome.runtime.getURL('options.html'));
            return
        }
	});

    const spacekeyInput = document.getElementById('spacekey');

    // Load the saved spacekey value when the popup is opened
	chrome.storage.sync.get('spacekey', (data) => {
		if (data.spacekey) {
			spacekeyInput.value = data.spacekey;
		}
	});


    const formElement = document.getElementById('confluenceForm');
    
    
    document.getElementById('confluenceForm').addEventListener('submit', async function (e) {
        //if (e.ctrlKey || e.shiftKey) { // does not work properly - undefined
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
        var q= decodeURIComponent(params.get("q"));
        if (q) {
            document.getElementById("confluenceSearchQuery").value = q;
            showResults();
            return
        }   
    } 
    // Set focus to search bar
    document.getElementById("confluenceSearchQuery").focus();
    // hide results_next and results_prev
    document.getElementById('results_next').style.display = "none";
    document.getElementById('results_prev').style.display = "none";

});

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
    g_SearchResponse = await fetch(u).then(res => res.json());

    if (g_SearchResponse.statusCode === 403) {
        alert('Error! Check that you are logged in!');
        throw new Error(`${g_SearchResponse.message}`);
    }

    // code inspiration https://www.florin-pop.com/blog/2019/06/vanilla-javascript-instant-search/
    
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
    document.getElementById('results_msg').textContent= g_SearchResponse.results.length + ' items found. (max.' + limit + ')';
    
    document.getElementById('go-to-options').focus();
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
         const rootUrl = await getObjectFromLocalStorage('rooturl');
    }
    
    var searchQuery = document.getElementById('confluenceSearchQuery').value;
    
    
   const spacekey = await getSpaceKey(searchQuery);
    // remove -l option if present in searchQuery
    searchQuery=searchQuery.replace(/(\s|^)\-?l(\s|$)/,'');
     
    const type = await getObjectFromLocalStorage('type');
    var limit;
    if (searchQuery.match(/(\s|^)\-?o(\s|$)/)) { // quick open
        searchQuery=searchQuery.replace(/(\s|^)\-?o(\s|$)/,'');
        limit=1;
    } else {
        limit = await getObjectFromLocalStorage('limit');
    }
    let cql = Query2Cql(searchQuery,spacekey,type);
    let searchUrl = rootUrl + '/rest/api/content/search?cql=' + cql + '&limit=' + limit.toString();
    //alert(searchUrl);
    return searchUrl;
}

// https://gist.github.com/sumitpore/47439fcd86696a71bf083ede8bbd5466

const getObjectFromLocalStorage = async function(key) {
return new Promise((resolve, reject) => {
    try {
    chrome.storage.sync.get(key, function(value) {
        resolve(value[key]);
    });
    } catch (ex) {
    reject(ex);
    }
});
};
