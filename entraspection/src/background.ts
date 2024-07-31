'use strict';

import { validateWebRequest, parseGraphqlBody, getRequestBody } from "./operations/graphql-network-inspector"
import { convertHeadersArrayToHeadersObj } from "./operations/convertHeadersArrayToHeadersObj"

type RequestResults = chrome.webRequest.WebRequestBodyDetails & chrome.webRequest.WebRequestHeadersDetails & {graphqlBody?: any[], responseBody?: JSON, requestBodyDecoded?: string}
const reqObjQueue = {} as Record<string,chrome.webRequest.WebRequestBodyDetails | chrome.webRequest.WebRequestHeadersDetails>
const reqObj = {} as Record<string,RequestResults>

type Props = {
  requestId: string,
  details: chrome.webRequest.WebRequestBodyDetails | chrome.webRequest.WebRequestHeadersDetails
}


function getDecodedBody (details: chrome.webRequest.WebRequestBodyDetails): string {
  if (details.requestBody && details.requestBody.raw) {
    const decoder = new TextDecoder();
    const decodedBody = decoder.decode(details.requestBody.raw[0].bytes)
    return decodedBody
  }
  throw new Error('Supposedly unreachable')
}

async function getQueryResponse (details: RequestResults): Promise<JSON> {
  console.log('requestHeaders: ',details.requestHeaders)
  console.log('converted headers: ', convertHeadersArrayToHeadersObj(details.requestHeaders as chrome.webRequest.HttpHeader[]))
  const request = fetch(details.url, {
    method: details.method,
    headers: convertHeadersArrayToHeadersObj(details.requestHeaders as chrome.webRequest.HttpHeader[]),
    body: details.requestBodyDecoded
  })
  return (await request).json()
}

async function extractGraphQLBody (details: chrome.webRequest.WebRequestBodyDetails): Promise<false | any[]> {
  try {
    const body = getRequestBody(details)
    if (!body) {
      return false
    }

    const graphqlRequestBody = parseGraphqlBody(body)
    if (!graphqlRequestBody) {
      return false
    } else {
      return graphqlRequestBody
    }
  } catch (error) {
    console.error('Error validating network request', error)
    return false
  }
}

async function addToReqObj (details: RequestResults) {
  if (validateWebRequest(details)) {
    details.requestBodyDecoded = getDecodedBody(details);
    Promise.all([extractGraphQLBody(details) as Promise<any[]>,getQueryResponse(details)]).then(([graphqlBody,responseBody]) => {
      details.graphqlBody = graphqlBody;
      details.responseBody = responseBody
    })
    reqObj[details.requestId] = details
    console.log(reqObj)
  }
}

function addToReqObjQueue ({requestId, details}: Props) {
  if (reqObjQueue[requestId] !== undefined || null) {
    if ('requestHeaders' in reqObjQueue[requestId]) {
      if ((reqObjQueue[requestId] as chrome.webRequest.WebRequestHeadersDetails).requestHeaders === null || undefined) {
        delete reqObjQueue[requestId]
      } else {
        addToReqObj({...(details as chrome.webRequest.WebRequestBodyDetails), requestHeaders: (reqObjQueue[requestId] as chrome.webRequest.WebRequestHeadersDetails).requestHeaders})
      }
    } else 
    if ('requestBody' in reqObjQueue[requestId]) {
      if ((reqObjQueue[requestId] as chrome.webRequest.WebRequestBodyDetails).requestBody === null || undefined) {
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
  ['requestHeaders','extraHeaders']
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