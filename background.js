chrome.runtime.onMessage.addListener((msg, sender, sendResponse) =>
{
    if (msg.text == 'fetch')
    {

        fetch(`https://en.wiktionary.org/w/api.php?action=query&titles=${msg.request}&format=json`).then((response) =>
        {
            response.json().then((responseJSON) =>
            {
                if (responseJSON.query.pages.hasOwnProperty('-1') && (responseJSON.query.pages['-1'].hasOwnProperty('missing') || (responseJSON.query.pages['-1'].hasOwnProperty('invalid'))))
                {
                    sendResponse({ status: "failed", title: responseJSON.query.pages['-1'].title, request: msg.request });
                }
                else
                {
                    fetch(`https://en.wiktionary.org/wiki/${msg.request}`).then((rawPage) => 
                    {
                        rawPage.text().then((doc) =>
                        {
                            let title;
                            for (key in responseJSON.query.pages)
                            {
                                title = responseJSON.query.pages[key].title;
                            }
                            sendResponse({ status: "success", content: doc, title: title, request: msg.request });
                        });
                    });

                }
            });
        });

    }
    return true;
});
