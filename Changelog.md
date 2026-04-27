# Confluence CRX - Changelog

- [Confluence CRX - Changelog](#confluence-crx---changelog)
  - [TODO](#todo)
  - [TODO 2026-01 (v3.0)](#todo-2026-01-v30)
  - [2026-04 (v2.3)](#2026-04-v23)
  - [2026-04-07 (v2.2.4)](#2026-04-07-v224)
  - [2026-02-11 (v2.2.3)](#2026-02-11-v223)
  - [2026-01-17 (v2.2.2)](#2026-01-17-v222)
  - [2025-12-19 (v2.2.1)](#2025-12-19-v221)
  - [2025-12-05 (v2.2)](#2025-12-05-v22)
  - [2025-11-13 (v2.1.3)](#2025-11-13-v213)
  - [2025-11-06 (v2.1.2)](#2025-11-06-v212)
  - [2025-11-04 (v2.1.1)](#2025-11-04-v211)
  - [2025-11-03 (v2.1)](#2025-11-03-v21)
  - [2025-10-30 (v2.0)](#2025-10-30-v20)
  - [2025-10-02 (v1.4.1)](#2025-10-02-v141)
  - [2025-08-07 (v1.4)](#2025-08-07-v14)
  - [2025-08-03 (v1.3)](#2025-08-03-v13)
  - [2025-07 (v1.2)](#2025-07-v12)
  - [2024-09](#2024-09)
  - [2024-03-15](#2024-03-15)
  - [2024-03-14](#2024-03-14)
  - [2024-03-13](#2024-03-13)
  - [2024-03-12](#2024-03-12)


## TODO
* Support label OR combination

## TODO 2026-01 (v3.0)
* New Confluence Search Table Results view
*  Sort feature
*  Last Modifier
*  Saved Searched  / Bookmarks e.g. Following Tags for new content not by me
*  Tag Cloud navigator

## 2026-04 (v2.3)

### Firefox Compatibility

* **Added full Firefox support** with Manifest V2 compatibility layer
* **Build system**: Implemented Rollup bundler to convert ES modules for Firefox
* **Dual manifest strategy**: 
  - Chrome uses Manifest V3 with ES modules (no build required)
  - Firefox uses Manifest V2 with bundled scripts
* **Build commands**:
  - `npm run build-firefox` - Build for Firefox
  - `npm run restore-chrome` - Restore Chrome manifest

### Firefox-Specific Fixes

1. **ES Modules Bundling**: All JavaScript modules bundled into single files for Firefox compatibility
2. **alert() Blocking**: Replaced `alert()` with HTML error messages in popup pages (Firefox blocks alert in popups)
3. **Addon ID**: Added explicit `browser_specific_settings.gecko.id` for storage API compatibility
4. **Context Menus**: Build script automatically patches "action" → "browser_action" for Manifest V2
5. **Script Injection API**: Runtime detection to use:
   - `chrome.scripting.executeScript()` for Chrome (Manifest V3)
   - `chrome.tabs.executeScript()` for Firefox (Manifest V2)
6. **Message Response Handling**: Check for both `chrome.runtime.lastError` and `undefined` response (Firefox doesn't set lastError when no listener exists)
7. **Web Accessible Resources**: Added TOC files (`toc-content.js`, `toc-overlay.css`) to web_accessible_resources
8. **Options Window Resize**: Changed options to open in popup window (800x600) instead of tab to prevent Firefox from resizing the main browser window

### Code Quality Improvements

* **Merged duplicate context menu listeners**: Combined two separate `chrome.contextMenus.onClicked.addListener` calls into one
* **Fixed missing return statement**: Added return in `snippet-selector` case to prevent fall-through
* **Smart backup system**: Build script only backs up Chrome manifest when current manifest is Manifest V3

### Documentation

* **README.md**: Added Firefox installation instructions with build steps
* **BUILD.md**: Documented all 7 Firefox compatibility issues and solutions

## 2026-04-07 (v2.2.4)
* fix: Label with non-ASCII characters like - or ü. ->Error message: Could not parse cql : ... Log referral number is 47fab1e9-fe5d-40dd-8c60-34390a89fc5a. Label is not wrapped between quotes in the cql.
* fix: label expansion if partial match and non-ASCII characters e.g. #künstliche matches like #k. Replace regexp by non-space match.

## 2026-02-11 (v2.2.3)
* fix: Copy Link in Breadcrumb format

## 2026-01-17 (v2.2.2)
* fix: omnibox search does not use search type option; always advanced search
* fix: omnibox search does not expand labels
* contributor=currentUser() does not work. get currentUser explicitly via api
* fix: -cbm instead of cbm
* fix: -bm not removed from searchString e.g. query: #label -bm 
* fix: search with -s keyword followed by spacekeys word to overwrite specific spaces and followed by further keyword starting with -. Example: -s Key -cbm

## 2025-12-19 (v2.2.1)
* fix: search with -s keyword followed by spacekeys word to overwrite specific spaces: remove spacekey word from search string

## 2025-12-05 (v2.2)
* added quick search filters: created by me ('cbm'), contributor/by me ('bm'), watched, mentioned and favorite (also with NOT)
* order by modified date ('om'), order by creation date ('oc') DESC and ASC
* fix: copy link plain text format to url instead of htmlString
* fix: once ctrl/shift key is pressed, advanced search is always used / sticky

## 2025-11-13 (v2.1.3)
* Improvement: if no snippets, insert snippet will open snippet manager
* Bug fix: snippet context menus duplicate id -> removed menus / only snippet selector
* Bug fix: edit HTML source in plain editor-> paste is marked as text format
## 2025-11-06 (v2.1.2)
* Small fix: error catching if input space key not found

## 2025-11-04 (v2.1.1)
* Bug fix: insert snippet multiple times

## 2025-11-03 (v2.1)

* Bug fix: remove label
* Added: Delete All button in Snippet UI
  
## 2025-10-30 (v2.0)

* Improved UI for options
* New feature: Snippet functionality
* New feature: Label dictionary
* New feature: Table of Contents overlay with expandable levels 
* Fix: Add and Remove Headings Numbers: support for Confluence Server/DataCenter (TinyMCE Editor)
* Bug fix: blog&page type
* Bug fix getSpaceKeyFromUrl for new url structure DC 9.x /spaces/$spaceKey/pages/$pageId
* Bug fix. Extension Search will display second page instead of first when triggering the search from the search bar with the Enter key
* Removed jquery dependency
  
## 2025-10-02 (v1.4.1)

* Improved display of active space(s) in search window (added default space setting directly in search, grey-out space setting if inactive, display active space (last:spacekey, global) e.g. if overwritten by flag)
* Fix: getSpaceKeyFromUrl for /pages/viewpage.action?spaceKey=xxx&title= url format

## 2025-08-07 (v1.4)

* New: Extension Hotkey for Open Search in new tab
* Default Hotkeys: Global:true is useless; Chrome window can not be put to the front
* Better Error handling if not logged in / no connection
* Fix: if not logged in, search return 0 result instead of error notification
* Changed Display Search Results Count with startIndex - endIndex instead of Count for better clarity

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

* Omnibar: open in new tab search results

## 2024-03-12

* First Release implementing Quick Search in popup
* Context Menu: Number Headings
* Support for multiple Spaces comma separated list of space keys
* Popout in separate window