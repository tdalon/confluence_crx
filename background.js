import {getSearchUrl, getObjectFromLocalStorage, getSingleSpaceKey, CopyLink} from './shared.js';


// Commands
chrome.commands.onCommand.addListener(function (command) {
switch (command) {
	case "share2teams": 
		//Share2Teams();
		return;
	case "copy_link": 
		chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
			await CopyLink(tabs[0]);
		});
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
        default:
            console.log(`Unknown command: ${command}`);			
} // end switch

}); // end command.addListener

function CrxHelp(){
// Open CRX Help
chrome.tabs.create({ url: "https://github.com/tdalon/confluence_crx/blob/main/README.md"});
}

function CrxRn(){
// Open Crx Release Notes
chrome.tabs.create({ url:"https://github.com/tdalon/confluence_crx/blob/main/Changelog.md"});
}



async function updateContextMenus() {
    // Retrieve the RootUrl from storage
    const rootUrl = await getObjectFromLocalStorage('rooturl');

    if (!rootUrl) {
        console.log('RootUrl is not set. Context menus will not be updated.');
        return;
    }

    // Remove all existing context menus
    chrome.contextMenus.removeAll();

    // Construct the documentUrlPatterns dynamically based on the RootUrl
	//"documentUrlPatterns": ["https://*.atlassian.net/wiki/*/edit-v2/*","https://*.atlassian.net/wiki/*/edit/*" ]
    const pageEditUrlPatterns = [
        `${rootUrl}/*/edit-v2/*`, // Cloud
        `${rootUrl}/*/edit/*`,
		`${rootUrl}/pages/resumedraft.action` // server/DC
    ];

	const pageViewUrlPatterns = [
        `${rootUrl}/pages/*` ,
		`${rootUrl}/display/*`
    ];

	chrome.contextMenus.create({
        id: "copy_link",
        title: "Copy Link",
        contexts: ["page", "frame", "selection", "link", "editable","action"],
		documentUrlPatterns: pageViewUrlPatterns
    });

    // Create context menus with the dynamically generated documentUrlPatterns
    chrome.contextMenus.create({
        title: "Numbered Headings: Add Numbers",
        id: "numheading_add",
        contexts: ["page", "frame", "selection", "link", "editable"],
        documentUrlPatterns: pageEditUrlPatterns
    });

    chrome.contextMenus.create({
        title: "Numbered Headings: Remove Numbers",
        id: "numheading_remove",
        contexts: ["page", "frame", "selection", "link", "editable"],
        documentUrlPatterns: pageEditUrlPatterns
    });

    // Create other static context menus
    chrome.contextMenus.create({
        id: "crx_help",
        title: "Help",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "crx_options",
        title: "Options",
        contexts: ["action"]
    });

    chrome.contextMenus.create({
        id: "crx_rn",
        title: "Release Notes",
        contexts: ["action"]
    });

	

    console.log('Context menus updated with RootUrl:', rootUrl);
}

// Call updateContextMenus when the extension starts
updateContextMenus();

// Listen for changes to the RootUrl and update context menus dynamically
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync' && changes.rooturl) {
        updateContextMenus();
    }
});


// Add Context Menu listener
chrome.contextMenus.onClicked.addListener(function(info, tab) {
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
				window.open(chrome.runtime.getURL('options.html'));
			  }
			return;
		case "numheading_add": 
			chrome.tabs.query({active: true,currentWindow: true}, function(tabs) {
				chrome.scripting.executeScript({
					target: { tabId: tabs[0].id },
					files: ["jquery-3.7.1.min.js","numheading_add.js"]
				});
			})
			return;
		case "numheading_remove": 
			chrome.tabs.query({active: true,currentWindow: true}, function(tabs) {
				chrome.scripting.executeScript({
					target: { tabId: tabs[0].id },
					files: ["jquery-3.7.1.min.js","numheading_remove.js"]
				});
			})
			return;
		case "copy_link": 
		    chrome.tabs.query({active: true, currentWindow: true}, async function(tabs) {
				await CopyLink(tabs[0]);
			});
			return;
		default:
			return
					 
	} // end switch

});

	
// #START
chrome.omnibox.onInputEntered.addListener(async function (searchQuery) {

// if user enters a keyword after the omnibox keyword, redirect search to different destination
var splitText = searchQuery.split(' ');
var firstWord = splitText[0];

if (firstWord === "h" || firstWord === "-h") {
    CrxHelp();
    return;
}

if ((firstWord == "-r") || firstWord === "r"){
	CrxRn();
	return
}

// create a new page
if ((firstWord == "-c") || firstWord === "c"){
	
	var spaceKey = await getSingleSpaceKey(searchQuery);
	if (!spaceKey) { // fallback if defspace not set to settings
		return 
	}
	const rooturl = await getObjectFromLocalStorage('rooturl');
	const u = rooturl + '/pages/createpage.action?spaceKey=' + spaceKey; 
	// Open the URL in new tab and exit the function
	chrome.tabs.update({ url: u });
	return
}

// Quick Navigate to Space

if (firstWord === "n" || firstWord === "-n") {
	var spaceKey = await getSingleSpaceKey(searchQuery);
	if (!spaceKey) { // fallback if defspace not set to settings
		return 
	}
	const rooturl = await getObjectFromLocalStorage('rooturl');
	let u;
	if (rooturl.includes(".atlassian.net")) { // cloud
    	u = rooturl + '/spaces/' + spaceKey;  
	} else {
		u = rooturl + '/display/' + spaceKey; 
	}
	// Open the URL in new tab and exit the function
	chrome.tabs.update({ url: u });
	return
}

//const searchQuery = encodeURIComponent(searchQuery);
const advancedSearch = await getObjectFromLocalStorage('advancedsearch');

if (advancedSearch && !searchQuery.match(/(\s|^)\-?o(\s|$)/)) { // not quick open
	const u = await getSearchUrl(searchQuery); 
	// Open the URL in new tab and exit the function
	chrome.tabs.update({ url: u });
} else {
	searchQuery = encodeURIComponent(searchQuery); // for conflict with #label
	chrome.tabs.update({url: chrome.runtime.getURL('search.html?q=' + searchQuery) + '#window'});
}


}); // end omnibox.onInputEntered.addListener



String.prototype.replaceAll = function(search, replacement) {
	var target = this;
	return target.replace(new RegExp(search, 'g'), replacement);
};


// ----------------------------------------------------------------------------------------------------------
function closeCurrentTab(){
// Close current tab and browser window if last tab
// chrome.tabs.remove will not close the window on last tab closure -> needs to check if single tab opened
chrome.tabs.query({
	//active: true,
	currentWindow: true
}, function(tabs)	{
	if (tabs.length > 1) {
		chrome.tabs.query({
			active: true,
			currentWindow: true
		}, function(tabs)	{
		chrome.tabs.remove(tabs[0].id, function() { });
		});
	} else {
		chrome.windows.getCurrent(function(win) {
			chrome.windows.remove(win.id, function() { });
		});
	}		
});
} // eofun
