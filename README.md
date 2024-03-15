
- [About](#about)
- [Options](#options)
  - [Subdomain](#subdomain)
  - [Space Key](#space-key)
  - [Limit](#limit)
- [Search](#search)
  - [Query parameter](#query-parameter)
    - [Quick Open](#quick-open)
  - [Open results](#open-results)
- [Omnibox](#omnibox)
  - [Change the omnibox keyword](#change-the-omnibox-keyword)
- [Extension Keyword](#extension-keyword)
- [Context Menu](#context-menu)
  - [Numbering Headings](#numbering-headings)
- [How to submit an issue](#how-to-submit-an-issue)
- [How to support the developer or show appreciation](#how-to-support-the-developer-or-show-appreciation)


# About
This extension only supports Confluence Cloud variant. (You might easily adapt it for server/data center version.) 
It provides search capability and some additional functionality.
See Blog posts labelled with [#confluence_crx](https://tdalon.blogspot.com/search/label/confluence_crx)

# Options

## Subdomain

To use this extension you need to provide your Cloud instance SubDomain in the Options.
The first time you click on the extension button the options page will be opened so you can provide it.

You can open the optons from the popup 'Options' button or from the Extension Action Menu.

Other options include:

## Space Key

You can enter multiple space keys separated by a comma (,). In this case it will search in the different spaces i.e. with an OR combination.
If no space key is entered, the search runs in your whole Confluence instance.


## Limit
This is the limit for the number of results returned by the search query. Default is 25. See doc [pagination](https://developer.atlassian.com/server/confluence/pagination-in-the-rest-api/).


# Search 

## Query parameter

You can use # to prefix for labels.
If you enter multiple labels, it will search by labels with an AND combination. (Contrary to the built-in Confluence Advance Search which search by OR combination.)

### Quick Open

If you use the keyword ' o' or ' -o' in the query to open the first match directly. (Quick Open feature) 

## Open results

After a search you can quickly TAB to the results. Press ENTER to open the link.

# Omnibox

The search is only implemented with an Omnibox keyword.
In the omnibox, type 'c' followed by Tab. It will complete into 'Confluence'. Then enter your query as explained above.

## Change the omnibox keyword

You can change the omnibox keyword in the [extension source](https://tdalon.blogspot.com/2020/10/chrome-extension-view-source.html).
(It is afaik not possible to set is as a user extension option.)

This is implemented in the manifest.json file:

"omnibox": {
      "keyword": "c"
   }

# Extension Keyword

In the extension options, you can set a shortcut to open the extension main action. Default is Ctrl+Shift+K.

# Context Menu

Some additional features are built-in in the Context Menu.

When you have a Confluence page opened in edit mode, you can access some functions via the Context menu (Right-Mouse Click). There are grouped under the extension menu "Confluence".

## Numbering Headings

You can add or remove numbering to headings using the corresponding menu entries.

See separate post [here](https://tdalon.blogspot.com/2024/03/crx-confluence-numbered-headings.html)


# How to submit an issue

You can submit an issue to report a bug or make a feature request using the [GitHub issues](https://github.com/tdalon/confluence_crx/issues) in the repository.

# How to support the developer or show appreciation

This extension is free and open source.
You can show your appreciation by [Buying me a coffee](https://www.buymeacoffee.com/tdalon).
