/*Could not get this to work when not a single function

browser.runtime.onMessage.addListener((msg, sender, sendResponse) =>
{
    checkPageExistance(msg.request, sendResponse);
});

/**
 * Fetches the Wiktionary API for the given page to control the existance of the page and then triggers the response. 
 * @param {string} request The partial URL of the requested page
 * @param {function} sendResponse The response function of the message.
 *
const checkPageExistance = (request, sendResponse) =>
{
    fetch(`https://en.wiktionary.org/w/api.php?action=query&titles=${request}&format=json`).then((response) =>
    {
        response.json().then(responseJSON => handleJSONResponse(responseJSON, sendResponse, request));
    });
};


/**
 * Handles the response by the Wiktionary API.
 * @param {object} responseJSON The object version of the API json response
 * @param {function} sendResponse The response function of the message 
 * @param {string} request The partial URL of the requested page
 *
const handleJSONResponse = (responseJSON, sendResponse, request) =>
{
    if (responseJSON.query.pages.hasOwnProperty('-1') && (responseJSON.query.pages['-1'].hasOwnProperty('missing') || (responseJSON.query.pages['-1'].hasOwnProperty('invalid'))))
    {
        sendResponse({ status: "failed", title: responseJSON.query.pages['-1'].title, request: request });
    }
    else
    {
        fetchPage(request, responseJSON, sendResponse);

    }
};

/**
 * Fetches the Wiktionary page for the given term.
 * @param {string} request The partial URL of the requested page
 * @param {object} responseJSON The object version of the API json response
 * @param {function} sendResponse The response function of the message.
 *
const fetchPage = (request, responseJSON, sendResponse) =>
{
    fetch(`https://en.wiktionary.org/wiki/${request}`).then((rawPage) => 
    {
        rawPage.text().then((doc) =>
        {
            let title;
            for (key in responseJSON.query.pages)
            {
                title = responseJSON.query.pages[key].title;
            }
            sendResponse({ status: "success", content: doc, title: title, request: request });
        });
    });
};*/

browser.runtime.onMessage.addListener((msg, sender, sendResponse) =>
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


    return true;
});
