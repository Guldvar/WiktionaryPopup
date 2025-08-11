"use strict";
/**
 * True whenever the documentFrame element is expanded
 */
let popupOpen = false;
let loading = false;
let mouseOver = false;
let savedSelection = "";
/**
 * True if whitelist is enabled, false if blacklist is enabled.
 * @type boolean
 */
let whitelist;


/**
 * Array of the categories that by default are not shown without the option to enable them.
 */
const ALWAYS_FORBIDDEN_CATS = ['References'];

/**
 * Array of the categories that are not shown, regardless of why.
 */
const forbiddenCats = [];

/**
 * Array of the categories that can be enabled or disabled in the config.
 */
const OPTION_CATS = ['See also', 'Further reading', 'Translations', 'Derived terms'];

//There is probably a better way to remove these
/**
 * MediaWiki classes that do not bring joy.
 */
const FORBIDDEN_CLASSES = ['mw-empty-elt', 'sister-project', 'noprint'];

/**
 * Array of the languages listed (blacklist or whitelist) in the config by the user.
 */
const listedLangs = [];

/**
 * The div element containing the popup. Shown in small form when the user selects text and in large form when the user clicks on it
 * @property {HTMLDivElement} body - Another div element which forms the "body" of the popup and is a child of documentFrame 
 */
const documentFrame = document.createElement('div');

/**
 * Initializes the documentFrame as well as calling updateState to sync stored configs
 */
const init = () =>
{
    /*
        Text selection is different in svgs
    */
    if (document.documentElement.tagName == "svg") 
    {
        return;
    }
    documentFrame.classList.add('wiktionary-popup');
    documentFrame.style.display = "none";

    documentFrame.body = document.createElement('div');
    documentFrame.append(documentFrame.body);

    /*
        Popup is added immediatly to improve perfomance
    */
    document.body.append(documentFrame);
    documentFrame.style.cursor = "pointer";

    documentFrame.addEventListener('click', onClick);
    documentFrame.addEventListener('mouseover', () =>
    {
        mouseOver = true;
    });
    documentFrame.addEventListener('mouseout', () =>
    {
        mouseOver = false;
    });

    document.addEventListener('selectionchange', onSelectionChange);
    updateState();
};

/**
 * Saves the given value in synced browser storage at the given key 
 * @param {string} key The key to save at
 * @param {object} value The value to save
 */
const saveState = (key, value) =>
{
    try
    {
        const storageObj = {};
        storageObj[key] = value;
        browser.storage.sync.set(storageObj);
    }
    catch (e)
    {

    }
};

/**
 * Retrieves a stored object from synced browser storage
 * @param {string} key The key to the stored object
 * @returns {object} The object stored at the key
 */
const getState = async (key) => 
{
    try
    {
        const result = await browser.storage.sync.get([key]);
        return result[key];
    }
    catch (e)
    {

    }
};

/**
 * Retrieves stored configs from browser storage and sets the relevant variables for the active session.
 */
const updateState = async () =>
{
    forbiddenCats.length = 0;
    forbiddenCats.push(...ALWAYS_FORBIDDEN_CATS);
    for (const cat of OPTION_CATS) 
    {
        const enabled = await getState(cat) ? true : false;
        if (!enabled) 
        {
            forbiddenCats.push(cat);
        }
    }

    whitelist = await getState('whitelist') ? true : false;
    let langs = await getState('langs');
    if (!langs) 
    {
        langs = [];
        saveState('langs', langs);
    }
    listedLangs.length = 0;
    listedLangs.push(...langs);
};

/**
 * Called when the documentFrame is clicked on. Expands it to the large view, clears it and starts fetching the active selection.
 */
const onClick = async () =>
{
    if (!popupOpen)
    {
        await updateState();
        popupOpen = true;
        documentFrame.classList.add('open-wik-popup');
        documentFrame.body.className = "wik-frame-body";
        documentFrame.style.cursor = null;
        
        const header = document.createElement('header');
        const h3 = document.createElement('h3');
        const main = document.createElement('main');
        h3.innerText = savedSelection;
        header.append(h3);

        documentFrame.body.innerHTML = "";

        documentFrame.body.append(header);
        documentFrame.body.append(main);
        fetchPage(formatRequest(savedSelection));
    }
};

/**
 * Fetches a page from a formatted request. If the fetch fails another is attempted in all lower-case. On success onPageFetchSuccess is triggered to "render" and show the page. 
 * @param {string} request The formatted page request
 */
const fetchPage = (request) =>
{
    const main = documentFrame.body.querySelector('main');
    main.innerHTML = "";
    const loadingContainer = document.createElement('div');
    loadingContainer.className = "loader-container";
    const loadImg = new Image();
    loadImg.src = browser.runtime.getURL('load.gif');
    loadImg.className = "loading-gif";
    loadingContainer.append(loadImg);
    documentFrame.body.append(loadingContainer);
    loading = true;
    const onResponse = (msg) => 
    {
        loadingContainer.remove();
        loading = false;
        if (msg.status == "success")
        {
            onPageFetchSuccess(msg);
        }
        else
        {
            if (/^[A-Z]/.test(request))
            {
                request = request.toLowerCase();
                fetchPage(request);
            }
            else
            {
                main.innerText = "No entry found";
                main.append(document.createElement('br'));
                const a = document.createElement('a');
                a.href = `https://en.wiktionary.org/w/index.php?search=${msg.request}`;
                a.target = '_blank';
                a.innerText = `Search Wiktionary for "${msg.title}"?`;
                main.append(a);
            }
        }
    };
    try
    {
        browser.runtime.sendMessage({ request: request }, onResponse);
    }
    catch (e)
    {
        console.trace(e);
        documentFrame.body.querySelector('main').append(...generateHTMLMessage("Extension context invalidated", "Please reload page"));
        loadingContainer.remove();
    }
};

/**
 * 
 * @param {object} msg A response from the background script with a content string for the raw document, a title string for the title of the page and a request string for the original request
 */
const onPageFetchSuccess = ({ content, title, request }) =>
{
    documentFrame.scrollTo(0, 0);
    createHeader(title, request);
    createEntries(content);
};

/**
 * Creates a header on the popup for the given page title and link.
 * @param {string} title The title of page 
 * @param {string} relLink The relative URL to the page
 */
const createHeader = (title, relLink) =>
{
    const header = documentFrame.body.querySelector('header');
    if (header.querySelector('.wiki-link'))
    {
        header.querySelector('.wiki-link').remove();
    }
    const wikiLink = document.createElement('a');
    wikiLink.href = `https://en.wiktionary.org/wiki/${relLink}`;
    wikiLink.classList.add("wiki-link");
    wikiLink.innerText = ("(Link)");
    wikiLink.target = '_blank';
    header.append(wikiLink);
    header.querySelector('h3').innerText = title;
};

/**
 * Shows the entries from the fetched page.
 * @param {string} content The raw string of the HTML document of the page 
 */
const createEntries = (content) =>
{
    const main = documentFrame.body.querySelector('main');
    main.innerHTML = "";
    const contentElement = new DOMParser().parseFromString(content, "text/html").querySelector('#mw-content-text');
    const allLangs = Array.from(contentElement.querySelectorAll('.mw-heading2'));
    let noLangs = true;
    for (const langElement of allLangs)
    {
        if (langElement.id == "mw-toc-heading")
        {
            continue;
        }
        const langHeader = clean(langElement.querySelector('h2').cloneNode(true));
        const langListed = listedLangs.includes(langHeader.innerText);
        if ((whitelist || langListed) && (whitelist != langListed))
        {
            continue;
        }

        noLangs = false;
        langHeader.classList.add('lang-header');
        main.append(langHeader);

        const categoryHeadings = getCategoryHeadings(langElement);
        categoryHeadings.forEach((categoryHeading) =>
        {
            const catHead = clean(categoryHeading.firstElementChild.cloneNode(true));
            catHead.classList.add('category-header');
            main.append(catHead);

            let activeEntryElement = categoryHeading.nextElementSibling;
            const content = [];
            while (true)
            {
                if (!activeEntryElement || activeEntryElement.classList.contains('mw-heading'))
                {
                    break;
                }
                let entryContent = activeEntryElement;
                activeEntryElement = entryContent.nextElementSibling;
                entryContent = clean(entryContent);
                if (entryContent.tagName === "TABLE")
                {
                    console.log(entryContent)   
                    const tableContainer = document.createElement('div');
                    tableContainer.className = "table-container";
                    main.append(tableContainer);
                    tableContainer.append(entryContent);
                }
                else
                {
                    main.append(entryContent);
                }
                content.push(entryContent);
            }
        });
    }
    if (noLangs)
    {
        main.append(...generateHTMLMessage(`Entries were found, but ${whitelist ? "none in whitelisted" : "only in blacklisted"} languages`,
            `Change the ${whitelist ? "whitelist" : "blacklist"} in the configuration to view entries.`));
    }
};

/**
 * Extracts all category headings belonging to a given language.
 * @param {HTMLElement} langHeaderElement The relevant language header in the fetched document
 * @returns {HTMLHeadElement[]} An array of all category headings found
 */
const getCategoryHeadings = (langHeaderElement) =>
{
    const categoryHeadings = [];
    let activeHeader = langHeaderElement.nextElementSibling;
    while (true)
    {
        if (!activeHeader || activeHeader.classList.contains('mw-heading2'))
        {
            break;
        }
        else if (activeHeader.classList.contains("mw-heading") && !forbiddenCats.includes(activeHeader.firstElementChild.innerText))
        {
            categoryHeadings.push(activeHeader);
        }
        activeHeader = activeHeader.nextElementSibling;
    }
    return categoryHeadings;
};

const MAX_SELECTION = 40;

/**
 * Triggered when selection changes. Saved the selection if applicable. If the selection is too large or small the documentFrame is hidden, otherwise it is shown above the selection.
 */
const onSelectionChange = () =>
{
    if (mouseOver || loading)
    {
        return;
    }
    const selection = window.getSelection().toString().trim();
    if (!selection || /^\s*$/.test(selection) || selection.length > MAX_SELECTION)
    {
        documentFrame.style.display = "none";
        documentFrame.style.cursor = "pointer";
        documentFrame.body.innerHTML = "";
        documentFrame.body.className = "";
        documentFrame.classList.remove("open-wik-popup");
        popupOpen = false;
    }

    else
    {
        savedSelection = window.getSelection().toString().trim();

        documentFrame.style.display = null;
        const rects = window.getSelection().getRangeAt(0).getClientRects();
        const boundingRect = { top: undefined, left: undefined };
        for (const rect of rects)
        {
            if (!boundingRect.top || rect.top + window.screenY < boundingRect.top + window.scrollY)
            {
                boundingRect.top = rect.top;
                boundingRect.left = rect.left;
            }
        }

        documentFrame.style.top = `${boundingRect.top + window.scrollY - 20}px`;
        documentFrame.style.left = `${boundingRect.left + window.scrollX + 40}px`;
    }
};

/**
 * Generates a message to be shown in case of errors or otherwise.
 * @param {string} strongText The text of the bold part of the message
 * @param {string} spanText The text of the nonbold part of the message
 * @returns {HTMLElement[]} The HTML elements in an array
 */
const generateHTMLMessage = (strongText, spanText) =>
{
    const strong = document.createElement('strong');
    strong.innerText = strongText;
    const span = document.createElement('span');
    span.innerText = spanText;
    return [strong, document.createElement('br'), span];
};

/**
 * Sanitizes the HTML of the given element from the fetched document for showing in the documentFrame.
 * Handles tables, links and other aspects which could break the displayed entries.
 * @param {HTMLElement} element The element to sanitize.
 * @returns {HTMLElement} The sanitized element.
 */
const clean = (element) =>
{
    if (element.className === "NavFrame" && element.querySelector('table'))
    {
        element = extractNavTable(element);
    }

    if (element.classList.contains("inflection-table-wrapper") && element.querySelector('table'))
    {
        console.log("tjohoo")
        element = extractInflectionTable(element);
    }

    for (const className of FORBIDDEN_CLASSES)
    {
        if (element.className.includes(className))
        {
            element.style.display = "none";
            element.remove();
            break;
        }
    }

    element.removeAttribute('class');
    if (element.hasAttribute('href'))
    {
        const href = element.getAttribute('href');
        element.removeAttribute('href');
        const requestSegment = /^\/wiki\/(Reconstruction:.*|[^:]*$)/;
        if (requestSegment.test(href))
        {
            element.addEventListener('click', (e) =>
            {
                e.preventDefault();
                const requestString = requestSegment.exec(href)[1].split('#')[0];
                fetchPage(requestString);
            });
        }
        else
        {
            element.style.color = "black";
            element.style.cursor = "default";
            element.style.textDecoration = "none";
            element.title = "";
        }
    }
    element.style.width = null;

    for (const child of element.querySelectorAll('*'))
    {
        clean(child);
    }
    return element;
};

/**
 * Extracts tables from their MediaWiki containers to sanitize them.
 * @param {HTMLElement} element The table to be sanitized
 * @returns 
 */
const extractNavTable = (element) =>
{
    const tableHeader = element.querySelector('.NavHead');
    if(!tableHeader)
    {
        return element;
    }
    if (tableHeader.firstElementChild)
    {
        tableHeader.firstElementChild.remove();
    }
    const tableTitle = tableHeader.innerHTML;
    const table = element.querySelector('table');
    table.style = null;
    table.firstElementChild.prepend(document.createElement('tr'));
    const th = document.createElement('th');
    th.colSpan = "100";
    th.style.border = "1px solid black";
    th.innerHTML = tableTitle;
    table.firstElementChild.firstElementChild.append(th);
    return table;
};

/**
 * Extracts inflection tables from their MediaWiki containers to sanitize them.
 * @param {HTMLElement} element The table to be sanitized
 * @returns 
 */
const extractInflectionTable = (element) =>
{
    const tableHeader = element.querySelector('.inflection-table-title');
    if(!tableHeader)
    {
        return element;
    }
    if (tableHeader.firstElementChild)
    {
        tableHeader.firstElementChild.remove();
    }
    return element.querySelector('table');
};

/**
 * Formats a given string to be used as a URL.
 * @param {string} rawRequest The unformattted request. 
 * @returns {string} The formatted string 
 */
const formatRequest = (rawRequest) =>
{
    let requestString = encodeURI(rawRequest);
    requestString = requestString.split('#')[0];
    if (requestString.length === 0)
    {
        requestString = ' ';
    }
    return requestString;
};

init();
