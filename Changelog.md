# Confluence Chrome Extension - Changelog


## TODO
* Add quick sort options (created by me, last updated by me, sort by last updated)

## 2025-08-03 (v1.3)
* Fix: if only subdomain is entered in rooturl, autocomplete with .atlassian.net
* Options Hotkeys: Esc to close and Ctrl+S to save and close
* Copy Link Breadcrumb Format
* Copy Link: Option for Link Format (short, middle, full)
* Fix: search with -s overwrite add undefined to search query
* README improved

## 2025-07 (v1.2)
* Fix: omnibox search with #label
* Option to pass space key as argument in the query
* Keyword to quick navigate to space
* Fix: [Ctrl/Shift Click/Submit](https://www.perplexity.ai/search/in-my-chrome-extension-i-have-M_y8SHhqQ6KNjgPviHNC3g) 
* [Copy Nice Link](README.md#copy-link) (also for non Confluence link)
* Fix Extension Keyboard Shortcut not working.
* Option for default space: setting, last accessed or global
* Keywords to overwrite space: setting (s), last accessed (l) or global (g)
* Keyword Quick Create (c)
* Option for omnibox search mode: advanced search vs. extension search
* Refactoring using share.js
* Advanced search by Ctrl+Click on Search button
* Support for Server/ DataCenter (added permissions handling)
* In case of search in multi-spaces, display space in search results

## 2024-09
* Support for server-based version preparation: Change subdomain to rooturl

## 2024-03-15
* Rename files popout.* to search.*
* Fix: search. If number of results lower than limit TAB does not highlight first result (Next not visible)

## 2024-03-14
* Quick Open Option i.e. Open first result (keyword -o or o)
* Fix: Remove Context menus in Extension Action menu.
* Added context menus for Help, Options and Release Notes to extension action menu
* Change mouse pointer on clickable images
* Focus on Next after search. Allows quick navigation with Tab to search results
* Next and Prev arrow focusable with Tab and clickable with Enter
* Added [pagination](https://developer.atlassian.com/server/confluence/pagination-in-the-rest-api/) and limit option
* Error handling if not signed-in

## 2024-03-13
* * Omnibar: open in new tab search results

## 2024-03-12
* First Release implementing Quick Search in popup
* Context Menu: Number Headings
* Support for multiple Spaces comma separated list of space keys
* Popout in separate window
