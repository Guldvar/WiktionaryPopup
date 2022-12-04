chrome.runtime.onMessage.addListener((msg, sender, sendResponse) =>
{
    if (msg.text == 'fetch')
    {

        fetch(`https://en.wiktionary.org/w/api.php?action=query&titles=${msg.request}&format=json`).then((response) =>
        {
            response.json().then((docExists) =>
            {
                console.log(docExists);
                if (docExists.query.pages.hasOwnProperty('-1') && docExists.query.pages['-1'].hasOwnProperty('missing'))
                {
                    sendResponse({ status: "failed" });
                }
                else
                {
                    fetch(`https://en.wiktionary.org/wiki/${msg.request}`).then((response2) => 
                    {
                        response2.text().then((doc) =>
                        {
                            sendResponse({ status: "success", content: doc, title: msg.title, request: msg.request });
                        });
                    });

                }
            });
        });

    }
    return true;
});
