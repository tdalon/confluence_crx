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
	contexts:["all"],
    "documentUrlPatterns": ["https://*.atlassian.net/wiki/*/edit-v2/*","https://*.atlassian.net/wiki/*/edit/*" ]
});

chrome.contextMenus.create({
    title: "Numbered Headings: Remove Numbers",
	id: "numheading_remove",
	contexts:["all"],
    "documentUrlPatterns": ["https://*.atlassian.net/wiki/*/edit-v2/*","https://*.atlassian.net/wiki/*/edit/*" ]
});


// Top level Number limited to 6


chrome.contextMenus.create({
	id: "crx_help",
	title: "Help",
	contexts: ["browser_action"]
});

chrome.contextMenus.create({
	id: "crx_rn",
	title: "Release Notes",
	contexts: ["browser_action"]
});


//  Add separator
chrome.contextMenus.create({
	id:"nws_crx_sep1",
	type: "separator",
	contexts: ["browser_action"]
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

// shortlinks
if (firstWord == "l") {
	var secondWord = splitText[1];
	if (secondWord == "mb") {
		sUrl = "https://tdalon.blogspot.com/";
	} else if (secondWord == "gh") {
		sUrl = "https://github.com/tdalon/ahk";
	} else if (secondWord == "gi") {
		sUrl = "https://gist.github.com/tdalon";
	} else if (secondWord == "pt") {
		sUrl = "https://tdalon.github.io/ahk/PowerTools";
	} else if (secondWord == "yt") {
		sUrl = "https://www.youtube.com/";
	} else {
		sUrl = "https://links.toto.de/" + secondWord ; // TODO
	}
	var thirdWord = splitText[2];
	if (thirdWord == null) {
		window.open(sUrl);
	} else if (thirdWord == "-c") {
		copyTextToClipboard(sUrl);
		closeCurrentTab();
	}
	return;
}

if (firstWord == "#test") {
	const data = new Blob(['<div>test</div>'], {type: 'text/html'})
	const item = new ClipboardItem({'text/html': data});
	navigator.clipboard.write([item]);
	return
}

switch (firstWord.toLowerCase()) {
	case 'gr+': // Goodreads Amazon to Goodreads
		closeCurrentTab();
		Amazon2Goodreads();
		return;
	case 'gr':
			searchStr = searchStr.substring(firstWord.length + 1);	
			if (searchStr == null) {
				sUrl = "https://www.goodreads.com" ;
				chrome.tabs.update({ url: sUrl });
			} else {
				searchGoodreads(searchStr);
			}
			return;
	case 'cal':
		sUrl = "https://calendar.google.com/calendar/u/0/r";
		chrome.tabs.update({ url: sUrl });
		return;
	case 'gm':
	case 'mail':
		sUrl = "https://mail.google.com/mail/ca/u/0/";
		chrome.tabs.update({ url: sUrl });
		return;
	case 'so': // stackoverflow
		searchStr = searchStr.substring(firstWord.length + 1);	
		searchStackOverflow(searchStr);
		return;
	case 'g': // google
	case 'go':
		searchStr = searchStr.substring(firstWord.length + 1);	
		if (searchStr == null) {
			sUrl = "https://www.google.com" ;
		} else {
			sUrl = "https://www.google.com/search?q=" + searchStr;
		}
		chrome.tabs.update({ url: sUrl });
		return;
	case 'tw': // twitter
		searchStr = searchStr.substring(firstWord.length + 1);	
		if (searchStr == null) {
			sUrl = "https://twitter.com/tdalon" ;
		} else {
			searchStr = searchStr.replaceAll("#","%23");
			sUrl = "https://twitter.com/search?q=" + searchStr;
		}
		chrome.tabs.update({ url: sUrl });
		return;
	case 'mb': // my blog
		searchStr = searchStr.substring(firstWord.length + 1);
		sUrl = "https://tdalon.blogspot.com";
		searchBlogger(sUrl, searchStr);
		return
	case 'nb': // new blog post - blogger dashboard
		sUrl = "https://draft.blogger.com/blogger.g?blogID=7106641098407922697#overview/src=dashboard";
		chrome.tabs.update({ url: sUrl });
		return
	case 'p': // profiles by name
	case 'li': // profiles by name - LinkedIn
		var secondWord = splitText[1];
		if (secondWord == null) {
			sUrl = "https://www.linkedin.com/in/tdalon/";
		} else if (secondWord == "-c") {
			sUrl = "https://www.linkedin.com/in/tdalon/";
			copyTextToClipboard(sUrl);
			closeCurrentTab();
			return
		} else if (secondWord == "j") {
			sUrl = "https://www.linkedin.com/jobs/"
		} else if (secondWord == "mj") {
			sUrl = "https://www.linkedin.com/my-items/saved-jobs/"
		} else {
			searchStr = searchStr.substring(firstWord.length + 1);
			sUrl = "https://www.linkedin.com/search/results/people/?keywords=" + searchStr;
		}
		break;
	case 'yt':
	case 'youtube':
		searchStr = searchStr.substring(firstWord.length + 1);	
		if (searchStr == "") {
			sUrl = "https://www.youtube.com/c/ThierryDalon" ;
		} else {
			sUrl = "https://www.youtube.com/results?search_query=" + searchStr;
		}
		break;
	case 'pt':
		var secondWord = splitText[1];
		if (secondWord == null) {
			sUrl = "https://tdalon.github.io/ahk/PowerTools";
			chrome.tabs.update({ url: sUrl });
			return;
		} else if (secondWord == "-c") {
			sUrl = "https://tdalon.github.io/ahk/PowerTools";
			copyTextToClipboard(sUrl);
			closeCurrentTab();
			return
		} 

		switch (secondWord) {
			case 'teamsy':
			case 'ty':
				sUrl = "https://tdalon.github.io/ahk/Teamsy";
				break;
			case 'tl':
				sUrl = "https://tdalon.github.io/ahk/Teamsy-Launcher";
				break;
			case 'ts':
				sUrl = "https://tdalon.github.io/ahk/Teams-Shortcuts";
				break;
			case 'mu':
			case 'mute':
				sUrl = "https://tdalon.github.io/ahk/Mute-PowerTool";
				break;
			case 'cy':
				sUrl = "https://tdalon.github.io/ahk/Chromy";
				break;
		}

		var thirdWord = splitText[2];
		if (thirdWord == null) {
			chrome.tabs.update({ url: sUrl });
		} else if (thirdWord == "-c") {
			copyTextToClipboard(sUrl);
			closeCurrentTab();
		}
	default:
		return
		     
} // end switch


chrome.tabs.update({ url: sUrl });
});


String.prototype.replaceAll = function(search, replacement) {
	var target = this;
	return target.replace(new RegExp(search, 'g'), replacement);
};

function prepSearchString(searchText) {
	return encodeURIComponent(searchText)
};



// Copied from search.js by nws_search.xlsm
// Library of common search functions


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

// ----------------------------------------------------------------------------------------------------------
// https://stackoverflow.com/a/18455088/2043349
function copyTextToClipboard(text) {
	//Create a textbox field where we can insert text to. 
	var copyFrom = document.createElement("textarea");
  
	//Set the text content to be the text you wished to copy.
	copyFrom.textContent = text;
  
	//Append the textbox field into the body as a child. 
	//"execCommand()" only works when there exists selected text, and the text is inside 
	//document.body (meaning the text is part of a valid rendered HTML element).
	document.body.appendChild(copyFrom);
  
	//Select all the text!
	copyFrom.select();
  
	//Execute command
	document.execCommand('copy');
  
	//(Optional) De-select the text using blur(). 
	//copyFrom.blur();
  
	//Remove the textbox field from the document.body, so no other JavaScript nor 
	//other elements can get access to this.
	document.body.removeChild(copyFrom);
} // eofun

