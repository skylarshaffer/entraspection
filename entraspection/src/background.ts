'use strict';

import { validateWebRequest } from "./graphql-network-monitor"

type RequestResults = chrome.webRequest.WebRequestBodyDetails & chrome.webRequest.WebRequestHeadersDetails
const reqObjQueue = {} as Record<string,chrome.webRequest.WebRequestBodyDetails | chrome.webRequest.WebRequestHeadersDetails>
const reqObj = {} as Record<string,RequestResults>

type Props = {
  requestId: string,
  details: chrome.webRequest.WebRequestBodyDetails | chrome.webRequest.WebRequestHeadersDetails
}

function addToReqObj (details: RequestResults) {
  if (validateWebRequest(details)) {
    reqObj[details.requestId] = details
    console.log(reqObj)
  }
}

function addToReqObjQueue ({requestId, details}: Props) {
  if (reqObjQueue[requestId] !== undefined || null) {
    if ('requestHeaders' in reqObjQueue[requestId]) {
      if (reqObjQueue[requestId].requestHeaders === null || undefined) {
        delete reqObjQueue[requestId]
      } else {
        addToReqObj({...(details as chrome.webRequest.WebRequestBodyDetails), requestHeaders: (reqObjQueue[requestId] as chrome.webRequest.WebRequestHeadersDetails).requestHeaders})
      }
    } else 
    if ('requestBody' in reqObjQueue[requestId]) {
      if (reqObjQueue[requestId].requestBody === null || undefined) {
        delete reqObjQueue[requestId]
      } else {
        addToReqObj({...(details as chrome.webRequest.WebRequestHeadersDetails), requestBody: (reqObjQueue[requestId] as chrome.webRequest.WebRequestBodyDetails).requestBody})
      }
    } else {
      delete reqObjQueue[requestId]
    }
  } else {
    reqObjQueue[requestId] = details
  }
}


chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.frameId === 0) {
      addToReqObjQueue({requestId: details.requestId, details: details})
    }
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.frameId === 0) {
      addToReqObjQueue({requestId: details.requestId, details: details})
    }
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders']
)
/* 
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.frameId === 0) {
      if (details.requestBody && details.requestBody.raw && details.requestBody.raw.length > 0) {
        const decoder = new TextDecoder();
        const requestBodyDecoded = JSON.parse(decoder.decode(details.requestBody.raw[0].bytes));
        console.log('requestBody: ',requestBodyDecoded);
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['requestBody']
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.frameId === 0) {
      if (details.requestHeaders && details.requestHeaders.length > 0) {
        console.log('requestHeaders: ',details.requestHeaders);
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['requestHeaders']
) */