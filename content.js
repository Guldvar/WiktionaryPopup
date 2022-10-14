"use strict";
let isOpen = false;
let locked = false;
let savedSelection = "";

const PERCENT_ENCODE = { '%': '%25', '&': '%26', "?": "%3F", '=': '%3D', '/': '%2F' };
const LANGS = ['English', 'French'];
const CATEGORIES =
{
    'Etymology':
        {},
    'Pronunciation': {},
    'Noun': { skip2: true },
    'Adjective': { skip2: true },
    'Verb': { skip2: true },
    'Adverb': { skip2: true }
};

const isBefore = (elementX, elementY, container) =>
{
    let items = container.querySelectorAll('*');
    let result = false;
    for (const item of items)
    {
        if (item === elementX)
        {
            result = true;
            break;
        } else if (item === elementY)
        {
            result = false;
            break;
        }
    }
    return result;
};

const clean = (element, onResponse) =>
{
    element.removeAttribute('class');
    if (element.hasAttribute('href'))
    {
        element.removeAttribute('href')
        element.addEventListener('click', (e) =>
        {
            e.preventDefault();
            console.log("click")
            let requestString = element.innerText;
            for (const key in PERCENT_ENCODE)
            {
                requestString = requestString.replaceAll(key, PERCENT_ENCODE[key]);
            }
            chrome.runtime.sendMessage({ text: "fetch", request: requestString, title: element.innerText }, onResponse);
        });
    }

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
        if (document.querySelector(".wiktionary-popup"))
        {
            document.querySelector(".wiktionary-popup").remove();
            isOpen = false;
        }
        return;
    }
    savedSelection = window.getSelection().toString().trim();

    let element = document.querySelector(".wiktionary-popup");
    if (!element)
    {
        element = document.createElement('div');
        element.classList.add('wiktionary-popup');
        document.body.append(element);
        element.addEventListener('click', async () =>
        {
            if (!isOpen)
            {
                isOpen = true;
                element.classList.add('open');
                element.innerHTML =
                    `<header>
                        <h3>${savedSelection}</h3>
                    </header>
                    <main>
                    </main>`;
                let requestString = savedSelection;
                for (const key in PERCENT_ENCODE)
                {
                    requestString = requestString.replaceAll(key, PERCENT_ENCODE[key]);
                }
                const onResponse = ({ status, content, title }) => 
                {
                    console.log(status)
                    if (status == "success")
                    {
                        const main = element.querySelector('main');
                        main.innerHTML = "";
                        element.querySelector('header').querySelector('h3').innerText = title;
                        const contentElement = new DOMParser().parseFromString(content, "text/html").querySelector('#mw-content-text');
                        const allLangs = Array.from(contentElement.querySelectorAll('h2'));
                        allLangs.splice(0, 1);
                        for (const lang of LANGS)
                        {
                            let langElement = contentElement.querySelector(`#${lang}`);
                            if (langElement)
                            {
                                const langHead = clean(langElement.cloneNode(true));
                                langHead.classList.add('lang-header');
                                main.append(langHead);
                                main.append(document.createElement('br'));
                                console.log(`Found entry for ${lang}`);
                                langElement = langElement.parentElement;
                                const nr = allLangs.indexOf(langElement);
                                for (const category in CATEGORIES)
                                {
                                    const allOfCat = contentElement.querySelectorAll(`[id*="${category}"]`);
                                    let categoryHeading;
                                    for (const instance of allOfCat)
                                    {
                                        if (isBefore(langElement, instance, contentElement) && (allLangs.length - nr == 1 || !isBefore(allLangs[nr + 1], instance, contentElement)))
                                        {

                                            const catHead = clean(instance.cloneNode(true));
                                            catHead.classList.add('category-header');
                                            main.append(catHead);
                                            main.append(document.createElement('br'));
                                            categoryHeading = instance.parentElement;
                                            break;
                                        }
                                    }
                                    if (categoryHeading)
                                    {
                                        const entryContent = CATEGORIES[category].skip2 ? categoryHeading.nextElementSibling.nextElementSibling : categoryHeading.nextElementSibling;
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
                                                        if (lii.querySelector('dd').querySelector('div'))
                                                        {
                                                            lii.querySelector('dd').querySelector('div').outerHTML = lii.querySelector('dd').querySelector('div').innerHTML;
                                                        }
                                                    }
                                                }

                                            }
                                        }
                                        main.append(entryContent);
                                        console.log(`Found ${category} for ${lang}:`, CATEGORIES[category].skip2 ? categoryHeading.nextElementSibling.nextElementSibling : categoryHeading.nextElementSibling);
                                    }
                                    else
                                    {
                                        console.log(`Found no ${category} for ${lang}`);
                                    }
                                }
                            }
                            else
                            {
                                console.log(`Found no entry for ${lang}`);
                            }
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
    }
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
    element.style.left = `${boundingRect.left + window.scrollX}px`;
});