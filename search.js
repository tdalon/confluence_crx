
let g_SearchResponse;

document.addEventListener('DOMContentLoaded', function () {

    chrome.storage.sync.get('subdomain', (data) => {
		var subdomain = data.subdomain;
        if (typeof subdomain ==='undefined' || subdomain === '') {
            alert('Set subdomain in the Options!');
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

    document.getElementById('confluenceForm').addEventListener('submit', function (e) {
        e.preventDefault();
        showResults();
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
    
    if (arguments.length === 0) {
        var u = await getSearchUrl();
    }
   
    const resultsElt = document.getElementById('results');
    // clear previous results
    resultsElt.innerHTML = '';
    
    g_SearchResponse = await fetch(u).then(res => res.json());
    if (g_SearchResponse.statusCode=== 403) {
        alert('Error! Check that you are logged in!')
        throw new Error(`${g_SearchResponse.message}`);
    }

    var subdomain = await getObjectFromLocalStorage('subdomain');
    var rootUrl = `https://${subdomain}.atlassian.net/wiki`; 

    if (g_SearchResponse.results.length === 1) { // quick open
        u = rootUrl + g_SearchResponse.results[0]._links.webui;
        if (window.location.hash == '#popup') {
            chrome.tabs.create({url: u});
        } else {
            chrome.tabs.update({url: u});
        }
        return;
    }

    const ul = document.createElement('ul');
    ul.classList.add('results');
    g_SearchResponse.results.forEach((result,index) => {
        const li = document.createElement('li');
        li.tabindex = 0;
        li.classList.add('result-item');

        const result_title = document.createElement('h3');
        result_title.innerHTML = '<a href="' + rootUrl + result._links.webui + '">' + result.title + '</a>';
        result_title.classList.add('result-title');

        li.appendChild(result_title);

        ul.appendChild(li);
    });

    resultsElt.appendChild(ul);
    var limit = await getObjectFromLocalStorage('limit');
    document.getElementById('results_msg').textContent= g_SearchResponse.results.length + ' items found. (max.' + limit + ')';
    
    if (Object.hasOwn(g_SearchResponse._links,'next')) {
        document.getElementById('results_next').style.display = "block";
        document.getElementById('results_next').title = 'Next ' + limit.toString();
        document.getElementById('results_next').focus();
    } else {
        document.getElementById('results_next').style.display = "none";
        document.getElementById('go-to-options').focus();
    }
    if (Object.hasOwn(g_SearchResponse._links,'prev')) {
        document.getElementById('results_prev').style.display = "block";
        document.getElementById('results_prev').title = 'Previous ' + limit.toString();
    } else {
        document.getElementById('results_prev').style.display = "none";
    }
   
} // eofun showResults


async function getSearchUrl() {
    var searchQuery = document.getElementById('confluenceSearchQuery').value;
    var subdomain = await getObjectFromLocalStorage('subdomain');
    var spacekey = await getObjectFromLocalStorage('spacekey');
    var type = await getObjectFromLocalStorage('type');
    var limit;
    if (searchQuery.match(/(\s|^)\-?o(\s|$)/)) { // quick open
        searchQuery=searchQuery.replace(/(\s|^)\-?o(\s|$)/,'');
        limit=1;
    } else {
        limit = await getObjectFromLocalStorage('limit');
    }
    var rootUrl = `https://${subdomain}.atlassian.net/wiki`; 
    var cql = Query2Cql(searchQuery,spacekey,type);
    return rootUrl + '/rest/api/content/search?cql=' + cql + '&limit=' + limit.toString();
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


function Query2Cql(searchStr,spacekey,type) {
// parse labels with prefix # 
patt = /#[^ ]*/g;
arrMatch=searchStr.match(patt);
var CQLLabels = '';
if (arrMatch !== null){
    for (var i= 0;i<arrMatch.length;i++){
        var tag=arrMatch[i];
        tag=tag.slice(1); // remove trailing #
        tag= tag.replace("&","%26");
        CQLLabels = CQLLabels + '+AND+label+=+' + tag  ;
    }// end for tag array			
    searchStr = searchStr.replace(patt,"");
}
searchStr = searchStr.trim();
//CQL = encodeURIComponent(searchStr) ;

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
    CQL = '(type=page OR type=blogpost)'
    break;
default:
    console.log(`Sorry, we are out of ${type}.`);
}
  
if (searchStr) { 
    CQL = CQL + ' AND siteSearch ~ "' + searchStr + '"';
} 
if (spacekey) {
    var spaceCQL;
    var key_array = spacekey.split(',');
    for (let i = 0; i < key_array.length; i++) {
        if (i==0) {
            spaceCQL = 'space=' + key_array[i].trim();
        } else {
            spaceCQL = spaceCQL + ' OR space=' + key_array[i].trim();
        }
    }
    if (key_array.length>1) {
        spaceCQL = '(' + spaceCQL + ')';
    }
    CQL = CQL + ' AND ' + spaceCQL ;
}
if (CQLLabels) {
    CQL = CQL + CQLLabels ;
}     
return CQL;
} // eofun