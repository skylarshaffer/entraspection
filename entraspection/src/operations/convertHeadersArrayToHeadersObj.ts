export function convertHeadersArrayToHeadersObj (headersArr: chrome.webRequest.HttpHeader[]): HeadersInit {
    const headersObj = {} as Record<string,string>
    headersArr.forEach((headerObj) => {
        headersObj[headerObj.name] = headerObj.value || ''
    })
    return headersObj
}