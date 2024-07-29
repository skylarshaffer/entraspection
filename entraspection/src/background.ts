'use strict';

// With background scripts you can communicate with sidepanel
// and contentScript files.
// For more information on background script,
// See https://developer.chrome.com/extensions/background_pages

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GREETINGS') {
    const message: string =
      "Hi Syd, my name is Bac. I am from Background. It's great to hear from you.";

    // Log message coming from the `request` parameter
    console.log(request.payload.message);
    // Send a response message
    sendResponse({
      message,
    });
  }
});

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.frameId === 0) {
      if (details.requestBody && details.requestBody.raw && details.requestBody.raw.length > 0) {
        const decoder = new TextDecoder();
        console.log(decoder.decode(details.requestBody.raw[0].bytes));
        const body = decoder.decode(details.requestBody.raw[0].bytes);
        console.log(details);
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);
