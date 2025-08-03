document.addEventListener('DOMContentLoaded', function () {

document.getElementById('help').addEventListener('click', function() {
  chrome.tabs.create({url: 'https://github.com/tdalon/confluence_crx/blob/main/README.md#options'});
});

// Add event listener for closing the window on Esc key press
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      window.close();
    }

    // Save and close on Ctrl+S
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault(); // Prevent the browser's default save dialog
      saveOptions();
      window.close();
    }
  });

});



// Saves options to chrome.storage
const saveOptions = () => {
    const type = document.getElementById('type').value;
    const defspace = document.getElementById('defspace').value;
    const linkFormat = document.getElementById('linkFormat').value;
    const spacekey = document.getElementById('spacekey').value.toUpperCase();
    var rooturl = document.getElementById('rooturl').value;
    const limit = document.getElementById('limit').value;
    const startBreadcrumb = document.getElementById('startBreadcrumb').value;
    const advancedsearch = document.getElementById('advancedsearch').checked;
  
    // fix rooturl
    // remove trailing slash if present
    rooturl = rooturl.replace(/\/$/, "");
    // append .atlassian.net if only subdomain is provided (without .)
    if (!rooturl.includes('.')) {
      rooturl += '.atlassian.net';
    }
    
    // ensure rooturl starts with http or https
    if (!rooturl.match(/^http/)) {
        rooturl = `https://${rooturl}`;
    }

    // append /wiki if url ends with atlassian.net
    if (rooturl.match(/\.atlassian\.net$/)) {
        rooturl += '/wiki';
    }
    
    chrome.storage.sync.set(
      { type: type, spacekey: spacekey, defspace: defspace, rooturl: rooturl, limit: limit, advancedsearch:advancedsearch, linkFormat: linkFormat , startBreadcrumb: startBreadcrumb},
      () => {
        // Update status to let user know options were saved.
        const status = document.getElementById('status_msg');
        status.textContent = 'Options saved.';
        setTimeout(() => {
          status.textContent = '';
        }, 750);
      }
    );

    // Request permission for the domain only for url not hosted on atlassian.net
    if (!rooturl.includes('.atlassian.net')) {
      chrome.permissions.request(
        {
          origins: [rooturl + '/'] // Append trailing slash for permission request else error Invalid value for origin pattern ... Empty path.
          // If you also need API permissions:
          // permissions: ["tabs"]
        },
        function(granted) {
          if (granted) {
            // Permission was granted
            console.log(`Permission granted for ${rooturl}!`);
          } else {
            // Permission was denied
            console.log(`Permission denied for ${rooturl}!`);
          }
        }
      );
    }; // end if not atlassian.net
  };
  
  // Restores select box and checkbox state using the preferences
  // stored in chrome.storage.
  const restoreOptions = () => {
    chrome.storage.sync.get(
      {type: 'page',defspace: 's', spacekey: '',rooturl:'', limit:25, advancedsearch: false, linkFormat:'middle',startBreadcrumb: 0 },
      (items) => {
        document.getElementById('type').value = items.type;
        document.getElementById('linkFormat').value = items.linkFormat;
        document.getElementById('defspace').value = items.defspace;
        document.getElementById('spacekey').value = items.spacekey;
        document.getElementById('rooturl').value = items.rooturl;
        document.getElementById('limit').value = items.limit;
        document.getElementById('advancedsearch').checked = items.advancedsearch;
        document.getElementById('startBreadcrumb').value = items.startBreadcrumb;
      }
    );
  };
  
  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.getElementById('save').addEventListener('click', saveOptions);