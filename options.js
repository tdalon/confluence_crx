document.addEventListener('DOMContentLoaded', function () {

document.getElementById('help').addEventListener('click', function() {
  chrome.tabs.create({url: 'https://github.com/tdalon/confluence_crx/blob/main/README.md#options'});
});

});



// Saves options to chrome.storage
const saveOptions = () => {
    const type = document.getElementById('type').value;
    const spacekey = document.getElementById('spacekey').value.toUpperCase();
    const subdomain = document.getElementById('subdomain').value;
    const limit = document.getElementById('limit').value;
  
    chrome.storage.sync.set(
      { type: type, spacekey: spacekey, subdomain: subdomain, limit: limit },
      () => {
        // Update status to let user know options were saved.
        const status = document.getElementById('status_msg');
        status.textContent = 'Options saved.';
        setTimeout(() => {
          status.textContent = '';
        }, 750);
      }
    );
  };
  
  // Restores select box and checkbox state using the preferences
  // stored in chrome.storage.
  const restoreOptions = () => {
    chrome.storage.sync.get(
      {type: 'page', spacekey: '',subdomain:'', limit:25 },
      (items) => {
        document.getElementById('type').value = items.type;
        document.getElementById('spacekey').value = items.spacekey;
        document.getElementById('subdomain').value = items.subdomain;
        document.getElementById('limit').value = items.limit;
      }
    );
  };
  
  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.getElementById('save').addEventListener('click', saveOptions);