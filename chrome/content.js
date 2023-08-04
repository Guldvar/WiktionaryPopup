"use strict";
/**
 * True whenever the documentFrame element is expanded
 */
let popupOpen = false;
let loading = false;
let mouseOver = false;
let savedSelection = "";
/**
 * @type boolean
 */
let whitelist;

const FORBIDDEN_CATS = ['References'];
const forbiddenCats = [];
const OPTION_CATS = ['See also', 'Further reading', 'Translations', 'Derived terms'];
const FORBIDDEN_CLASSES = ['mw-empty-elt', 'sister-project', 'noprint'];
const listedLangs = [];

const documentFrame = document.createElement('iframe');

const init = () =>
{
    /*
        Text selection is different in svgs
    */
    if (document.documentElement.tagName == "svg") 
    {
        return;
    }
    documentFrame.src = "about:blank";
    documentFrame.classList.add('wiktionary-popup');
    documentFrame.style.display = "none";

    /*
        Popup is added immediatly to improve perfomance
    */
    document.body.append(documentFrame);
    documentFrame.contentDocument.documentElement.style.cursor = "pointer";

    documentFrame.contentDocument.addEventListener('click', onClick);
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

const saveState = (key, value) =>
{
    try
    {
        const storageObj = {};
        storageObj[key] = value;
        chrome.storage.sync.set(storageObj);
    }
    catch (e)
    {

    }
};

const getState = async (key) => 
{
    try
    {
        const result = await chrome.storage.sync.get([key]);
        return result[key];
    }
    catch (e)
    {

    }
};

const updateState = async () =>
{
    forbiddenCats.length = 0;
    forbiddenCats.push(...FORBIDDEN_CATS);
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

const onClick = async () =>
{
    if (!popupOpen)
    {
        await updateState();
        popupOpen = true;
        documentFrame.classList.add('open-wik-popup');
        documentFrame.contentDocument.body.className = "wik-frame-body";
        documentFrame.contentDocument.documentElement.style.cursor = null;
        documentFrame.contentDocument.body.innerHTML =
            `<header>
                <h3>${savedSelection}</h3>
            </header>
            <main>
            </main>`;
        fetchPage(formatRequest(savedSelection));
    }
};

const fetchPage = (requestString) =>
{
    const main = documentFrame.contentDocument.querySelector('main');
    main.innerHTML = "";
    const loadingContainer = document.createElement('div');
    loadingContainer.className = "loader-container";
    loadingContainer.innerHTML = `<img class = "loading-gif" src = "https://media.tenor.com/On7kvXhzml4AAAAj/loading-gif.gif"/>`;
    documentFrame.contentDocument.body.append(loadingContainer);
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
            if (/^[A-Z]/.test(requestString))
            {
                requestString = requestString.toLowerCase();
                fetchPage(requestString);
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
        chrome.runtime.sendMessage({ text: "fetch", request: requestString }, onResponse);
    }
    catch (e)
    {
        console.trace(e);
        documentFrame.contentDocument.querySelector('main').append(...generateHTMLMessage("Extension context invalidated", "Please reload page"));
        loadingContainer.remove();
    }
};

const onPageFetchSuccess = ({ content, title, request }) =>
{
    documentFrame.contentWindow.scrollTo(0, 0);
    createHeader(title, request);
    createEntries(content);
};

const createHeader = (title, request) =>
{
    const header = documentFrame.contentDocument.querySelector('header');
    if (header.querySelector('.wiki-link'))
    {
        header.querySelector('.wiki-link').remove();
    }
    const wikiLink = document.createElement('a');
    wikiLink.href = `https://en.wiktionary.org/wiki/${request}`;
    wikiLink.classList.add("wiki-link");
    wikiLink.innerText = ("(Link)");
    wikiLink.target = '_blank';
    header.append(wikiLink);
    header.querySelector('h3').innerText = title;
};

const createEntries = (content) =>
{
    const main = documentFrame.contentDocument.querySelector('main');
    main.innerHTML = "";
    const contentElement = new DOMParser().parseFromString(content, "text/html").querySelector('#mw-content-text');
    const allLangs = Array.from(contentElement.querySelectorAll('h2'));
    let noLangs = true;
    for (const langElement of allLangs)
    {
        if (langElement.id == "mw-toc-heading")
        {
            continue;
        }

        const langHeader = clean(langElement.querySelector('.mw-headline').cloneNode(true));
        const langListed = listedLangs.includes(langHeader.innerText);
        if ((whitelist || langListed) && (whitelist != langListed))
        {
            continue;
        }

        noLangs = false;
        langHeader.classList.add('lang-header');
        main.append(langHeader);
        main.append(document.createElement('br'));

        const categoryHeadings = getCategoryHeadings(langElement);
        categoryHeadings.forEach((categoryHeading) =>
        {
            const catHead = clean(categoryHeading.firstElementChild.cloneNode(true));
            catHead.classList.add('category-header');
            main.append(catHead);
            main.append(document.createElement('br'));

            let activeEntryElement = categoryHeading.nextElementSibling;
            const content = [];
            while (true)
            {
                if (!activeEntryElement || /^H.$/.test(activeEntryElement.tagName))
                {
                    break;
                }
                let entryContent = activeEntryElement;
                activeEntryElement = entryContent.nextElementSibling;
                entryContent = clean(entryContent);
                if (entryContent.tagName === "TABLE")
                {
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

const getCategoryHeadings = (langHeaderElement) =>
{
    const categoryHeadings = [];
    let activeHeader = langHeaderElement.nextElementSibling;
    while (true)
    {
        if (!activeHeader || activeHeader.tagName === "H2")
        {
            break;
        }
        else if (/^H(3|4|5)$/.test(activeHeader.tagName) && !forbiddenCats.includes(activeHeader.firstElementChild.innerText))
        {
            categoryHeadings.push(activeHeader);
        }
        activeHeader = activeHeader.nextElementSibling;
    }
    return categoryHeadings;
};

const onSelectionChange = () =>
{
    if (mouseOver || loading)
    {
        return;
    }
    const selection = window.getSelection().toString().trim();
    if (!selection || /^\s*$/.test(selection) || selection.length > 40)
    {
        documentFrame.style.display = "none";
        documentFrame.contentDocument.documentElement.style.cursor = "pointer";
        documentFrame.contentDocument.documentElement.innerHTML = "";
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

const generateHTMLMessage = (strongText, spanText) =>
{
    const strong = document.createElement('strong');
    strong.innerText = strongText;
    const span = document.createElement('span');
    span.innerText = spanText;
    return [strong, document.createElement('br'), span];
};

const clean = (element) =>
{
    if (element.className === "NavFrame" && element.querySelector('table'))
    {
        element = extractTable(element);
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

const extractTable = (element) =>
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
