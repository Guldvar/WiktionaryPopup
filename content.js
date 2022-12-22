"use strict";
let isOpen = false;
let locked = false;
let savedSelection = "";

const PERCENT_ENCODE = { '%': '%25', '&': '%26', "?": "%3F", '=': '%3D', '/': '%2F' };
const FORBIDDEN_CATS = ['References', 'See also', 'Further reading', 'Translations', 'Derived terms'];
const FORBIDDEN_CLASSES = ['mw-empty-elt', 'sister-project', 'noprint'];

const frameElement = document.createElement('iframe');

const init = () =>
{
    frameElement.src = "about:blank";
    frameElement.classList.add('wiktionary-popup');
    frameElement.style.display = "none";
    document.body.append(frameElement);
    frameElement.contentDocument.documentElement.style.cursor = "pointer";

    frameElement.contentDocument.addEventListener('click', onClick);
    frameElement.addEventListener('mouseover', () =>
    {
        locked = true;
    });
    frameElement.addEventListener('mouseout', () =>
    {
        locked = false;
    });

    document.addEventListener('selectionchange', onSelectionChange);


};

const onClick = () =>
{
    if (!isOpen)
    {
        isOpen = true;
        frameElement.classList.add('open-wik-popup');
        frameElement.contentDocument.body.className = "wik-frame-body";
        frameElement.contentDocument.documentElement.style.cursor = null;
        frameElement.contentDocument.body.innerHTML =
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
    const main = frameElement.contentDocument.querySelector('main');
    main.innerHTML = "";
    const loadingContainer = document.createElement('div');
    loadingContainer.className = "loader-container";
    loadingContainer.innerHTML = `<img class = "loading-gif" src = "https://media.tenor.com/On7kvXhzml4AAAAj/loading-gif.gif"/>`;
    frameElement.contentDocument.body.append(loadingContainer);
    const onResponse = (msg) => 
    {
        loadingContainer.remove();
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
        frameElement.contentDocument.querySelector('main').innerHTML = `<strong>${e}</strong> <br>Please reload page`;
    }
};

const onPageFetchSuccess = ({ content, title, request }) =>
{
    frameElement.contentWindow.scrollTo(0, 0);
    createHeader(title, request);
    createEntries(content);
};

const createHeader = (title, request) =>
{
    const header = frameElement.contentDocument.querySelector('header');
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
    const main = frameElement.contentDocument.querySelector('main');
    main.innerHTML = "";
    const contentElement = new DOMParser().parseFromString(content, "text/html").querySelector('#mw-content-text');
    const allLangs = Array.from(contentElement.querySelectorAll('h2'));
    for (const langElement of allLangs)
    {
        if (langElement.id == "mw-toc-heading")
        {
            continue;
        }

        const langHeader = clean(langElement.firstElementChild.cloneNode(true));
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
        else if (/^H(3|4|5)$/.test(activeHeader.tagName) && !FORBIDDEN_CATS.includes(activeHeader.firstElementChild.innerText))
        {
            categoryHeadings.push(activeHeader);
        }
        activeHeader = activeHeader.nextElementSibling;
    }
    return categoryHeadings;
};

const onSelectionChange = () =>
{
    if (locked)
    {
        return;
    }
    const selection = window.getSelection().toString().trim();
    if (!selection || /^\s*$/.test(selection) || selection.length > 40)
    {
        frameElement.style.display = "none";
        frameElement.contentDocument.documentElement.style.cursor = "pointer";
        frameElement.contentDocument.documentElement.innerHTML = "";
        frameElement.classList.remove("open-wik-popup");
        isOpen = false;
        return;
    }
    savedSelection = window.getSelection().toString().trim();

    frameElement.style.display = null;
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

    frameElement.style.top = `${boundingRect.top + window.scrollY - 20}px`;
    frameElement.style.left = `${boundingRect.left + window.scrollX + 40}px`;
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
    let requestString = rawRequest;
    for (const key in PERCENT_ENCODE)
    {
        requestString = requestString.replaceAll(key, PERCENT_ENCODE[key]);
    }
    requestString = requestString.split('#')[0];
    if (requestString.length === 0)
    {
        requestString = ' ';
    }
    return requestString;
};

init();
