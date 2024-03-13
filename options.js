// Saves options to chrome.storage
const saveOptions = () => {
    const type = document.getElementById('type').value;
    const spacekey = document.getElementById('spacekey').value.toUpperCase();
    const subdomain = document.getElementById('subdomain').value;
  
    chrome.storage.sync.set(
      { type: type, spacekey: spacekey, subdomain: subdomain },
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
      {type: 'post', spacekey: '',subdomain:'' },
      (items) => {
        document.getElementById('type').value = items.type;
        document.getElementById('spacekey').value = items.spacekey;
        document.getElementById('subdomain').value = items.subdomain;
      }
    );
  };
  
  document.addEventListener('DOMContentLoaded', restoreOptions);
  document.getElementById('save').addEventListener('click', saveOptions);