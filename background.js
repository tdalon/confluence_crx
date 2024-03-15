// Commands
chrome.commands.onCommand.addListener(function (command) {
switch (command) {
	case "share2teams": 
		Share2Teams();
		return;
	case "GoodreadsEdit": 
		GoodreadsEdit();
		return;
					
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



// Context menus
chrome.contextMenus.removeAll();

chrome.contextMenus.create({
    title: "Numbered Headings: Add Numbers",
	id: "numheading_add",
	contexts:["page","frame","selection","link","editable"],
    "documentUrlPatterns": ["https://*.atlassian.net/wiki/*/edit-v2/*","https://*.atlassian.net/wiki/*/edit/*" ]
});

chrome.contextMenus.create({
    title: "Numbered Headings: Remove Numbers",
	id: "numheading_remove",
	contexts:["page","frame","selection","link","editable"],
    "documentUrlPatterns": ["https://*.atlassian.net/wiki/*/edit-v2/*","https://*.atlassian.net/wiki/*/edit/*" ]
});


// Top level Number limited to 6


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
		default:
			return
					 
	} // end switch

});

	
// #START
chrome.omnibox.onInputEntered.addListener(
    function (searchStr) {

// if user enters a keyword after the omnibox keyword, redirect search to different destination
var splitText = searchStr.split(' ');
var firstWord = splitText[0];

if (firstWord == "-h") {
	CrxHelp();
	return
}

if (firstWord == "-r") {
	CrxRn();
	return
}

chrome.tabs.update({url: chrome.runtime.getURL('popup.html?q=' + encodeURIComponent(searchStr)) + '#window'});

});


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
