const init = async () => 
{
    initCheckbox('transl', 'Translations');
    initCheckbox('seeal', 'See also');
    initCheckbox('furth', 'Further reading');
    initCheckbox('deriv', 'Derived terms');

    const langModeSelect = document.querySelector('#langmd');
    langModeSelect.value = (await getState('whitelist')) ? 'Whitelist' : 'Blacklist';
    langModeSelect.addEventListener('change', () =>
    {
        saveState('whitelist', langModeSelect.value == "Whitelist");
    });

    let langList = await getState('langs');
    if (!langList) 
    {
        langList = [];
        saveState('langs', langList);
    }

    for (const lang of langList) 
    {
        addLang(lang, langList);
    }

    const addButton = document.querySelector('#lang-confirm');
    const langInput = document.querySelector('#lang-write');
    addButton.addEventListener('click', () =>
    {
        if (trySubmit(langInput.value, langList)) 
        {
            langInput.value = "";
        };
    });
    langInput.addEventListener('keydown', (e) =>
    {
        if (e.key === "Enter" && trySubmit(langInput.value, langList))
        {
            langInput.value = "";
        }
    });

};

const trySubmit = (value, langList) =>
{
    if (value.length > 0 && !/^\s*$/.test(value)) 
    {
        addLang(value.trim(), langList);
        langList.push(value.trim());
        saveState('langs', langList);
        return true;
    }
    return false;
};

const initCheckbox = async (id, name) =>
{
    const checkbox = document.querySelector(`#${id}`);
    checkbox.checked = await getState(name) ? true : false;
    checkbox.addEventListener('click', () =>
    {
        saveState(name, checkbox.checked);
    });
};


const addLang = (lang, langList) =>
{
    langArea = document.querySelector('#lang-area');
    const li = document.createElement('li');
    li.innerText = lang;
    li.className = "input-box";
    langArea.append(li);

    li.addEventListener('click', () =>
    {
        langList.splice(langList.indexOf(lang), 1);
        li.remove();
        saveState('langs', langList);
    });
};

const saveState = (key, value) =>
{
    const storageObj = {};
    storageObj[key] = value;
    browser.storage.sync.set(storageObj);
};

const getState = async (key) => 
{
    const result = await browser.storage.sync.get([key]);
    return result[key];
};


init();