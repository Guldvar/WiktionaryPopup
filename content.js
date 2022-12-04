"use strict";
let isOpen = false;
let locked = false;
let savedSelection = "";

const PERCENT_ENCODE = { '%': '%25', '&': '%26', "?": "%3F", '=': '%3D', '/': '%2F' };
const LANGS = ['English', 'French', 'Hungarian'];
const FORBIDDEN_CATS = ['References', 'See also', 'Further reading'];
const FORBIDDEN_CLASSES = ['mw-empty-elt', 'sister-project'];

const isBefore = (elementX, elementY, container) =>
{
    let items = container.querySelectorAll('*');
    for (const item of items)
    {
        if (item === elementX)
        {
            return true;
        }
        if (item === elementY)
        {
            return false;
        }
    }
    return false;
};

const clean = (element, onResponse) =>
{
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
        element.removeAttribute('href');
        if (element.title && !element.title.includes("(Page does not exist)"))
        {
            element.addEventListener('click', (e) =>
            {
                e.preventDefault();
                let requestString = element.title;
                for (const key in PERCENT_ENCODE)
                {
                    requestString = requestString.replaceAll(key, PERCENT_ENCODE[key]);
                }
                chrome.runtime.sendMessage({ text: "fetch", request: requestString, title: element.innerText }, onResponse);
            });
        }
        else if (element.parentElement.tagName !== "SUP")
        {
            element.style.color = "red";
        }
        else
        {
            element.style.color = "black";
            element.style.cursor = "default";
        }
    }
    element.style.width = null;


    for (const child of element.querySelectorAll('*'))
    {
        clean(child, onResponse);
    }
    return element;
};
document.addEventListener('selectionchange', () =>
{
    if (locked)
    {
        return;
    }
    const selection = window.getSelection().toString().trim();
    if (!selection || /^\s*$/.test(selection) || selection.length > 40)
    {
        element.style.display = "none";
        element.contentDocument.documentElement.style.cursor = "pointer";
        element.contentDocument.documentElement.innerHTML = "";
        element.classList.remove("open");
        isOpen = false;
        return;
    }
    savedSelection = window.getSelection().toString().trim();

    element.style.display = null;
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

    element.style.top = `${boundingRect.top + window.scrollY - 20}px`;
    element.style.left = `${boundingRect.left + window.scrollX + 40}px`;
});

const element = document.createElement('iframe');
element.src = "about:blank";
element.classList.add('wiktionary-popup');
element.style.display = "none";
document.body.append(element);
element.contentDocument.documentElement.style.cursor = "pointer";
element.contentDocument.addEventListener('click', async () =>
{
    if (!isOpen)
    {
        isOpen = true;
        element.classList.add('open');
        element.contentDocument.body.className = "wik-frame-body";
        element.contentDocument.documentElement.style.cursor = null;
        element.contentDocument.body.innerHTML =
            `<header>
                <h3>${savedSelection}</h3>
            </header>
            <main>
            <img src = "https://media.tenor.com/On7kvXhzml4AAAAj/loading-gif.gif">
            </main>`;
        let requestString = savedSelection;
        for (const key in PERCENT_ENCODE)
        {
            requestString = requestString.replaceAll(key, PERCENT_ENCODE[key]);
        }
        const onResponse = ({ status, content, title, request }) => 
        {
            if (status == "success")
            {
                element.contentWindow.scrollTo(0, 0);
                const header = element.contentDocument.querySelector('header');
                if (header.querySelector('.wiki-link'))
                {
                    header.querySelector('.wiki-link').remove();
                }
                const wikiLink = document.createElement('span');
                wikiLink.classList.add("wiki-link");
                wikiLink.innerText = ("(Link)");
                wikiLink.addEventListener('click', () =>
                {
                    window.open(`https://en.wiktionary.org/wiki/${request}`, '_blank');

                });
                header.append(wikiLink);
                const main = element.contentDocument.querySelector('main');
                main.innerHTML = "";
                header.querySelector('h3').innerText = title;
                const contentElement = new DOMParser().parseFromString(content, "text/html").querySelector('#mw-content-text');
                const allLangs = Array.from(contentElement.querySelectorAll('h2'));
                for (const langElement of allLangs)
                {
                    if (langElement.id == "mw-toc-heading")
                    {
                        continue;
                    }
                    const lang = langElement.firstElementChild.innerText;
                    const langHead = clean(langElement.firstElementChild.cloneNode(true));
                    langHead.classList.add('lang-header');
                    main.append(langHead);
                    main.append(document.createElement('br'));
                    //console.log(`Found entry for ${lang}`);
                    const categoryHeadings = [];
                    let activeHeader = langElement.nextElementSibling;
                    while (true)
                    {
                        if (!activeHeader || activeHeader.tagName === "H2")
                        {
                            break;
                        }
                        else if (/^H(3|4)$/.test(activeHeader.tagName) && !FORBIDDEN_CATS.includes(activeHeader.firstElementChild.innerText))
                        {
                            categoryHeadings.push(activeHeader);
                        }
                        activeHeader = activeHeader.nextElementSibling;
                    }
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
                            if (activeEntryElement.tagName === 'SUP')
                            {
                                activeEntryElement = activeEntryElement.nextElementSibling;
                                continue;
                            }
                            let entryContent = activeEntryElement;
                            activeEntryElement = entryContent.nextElementSibling;
                            if (entryContent.className === "NavFrame")
                            {
                                if (entryContent.querySelector('table'))
                                {
                                    const tableHeader = entryContent.querySelector('.NavHead');
                                    if (tableHeader.firstElementChild)
                                    {
                                        tableHeader.firstElementChild.remove();
                                    }
                                    const tableTitle = tableHeader.innerHTML;
                                    const table = entryContent.querySelector('table');
                                    table.style = null;
                                    table.firstElementChild.prepend(document.createElement('tr'));
                                    const th = document.createElement('th');
                                    th.colSpan = "100";
                                    th.innerHTML = tableTitle;
                                    table.firstElementChild.firstElementChild.append(th);
                                    entryContent = table;
                                }
                            }
                            clean(entryContent, onResponse);
                            for (const li of entryContent.querySelectorAll('li'))
                            {
                                for (const ul of li.querySelectorAll('ul'))
                                {
                                    for (const lii of ul.querySelectorAll('li'))
                                    {
                                        if (lii.querySelector('div'))
                                        {
                                            lii.querySelector('div').outerHTML = lii.querySelector('div').innerHTML;
                                            if (lii.querySelector('dd div'))
                                            {
                                                lii.querySelector('dd>div').outerHTML = lii.querySelector('dd div').innerHTML;
                                            }
                                        }
                                    }

                                }
                            }
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
                        //console.log(`Found ${catHead.innerText} for ${lang}:`, content);
                    });
                }
            }
            else
            {
                if (/^[A-Z]/.test(savedSelection))
                {
                    requestString = requestString.toLowerCase();
                    savedSelection = savedSelection.toLowerCase();
                    element.contentDocument.querySelector('header h3').innerHTML = savedSelection;
                    chrome.runtime.sendMessage({ text: "fetch", request: requestString, title: savedSelection }, onResponse);
                }
                else
                {
                    element.contentDocument.querySelector('main').innerText = "No entry found";
                }
            }
        };
        chrome.runtime.sendMessage({ text: "fetch", request: requestString, title: savedSelection }, onResponse);
    }
});
element.addEventListener('mouseover', () =>
{
    locked = true;
});
element.addEventListener('mouseout', () =>
{
    locked = false;
});
