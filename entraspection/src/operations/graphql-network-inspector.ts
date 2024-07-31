'use strict';

// Lifted entirely from v2.21.1 of graphql-network-inspector by warrenday: https://github.com/warrenday/graphql-network-inspector

import { FieldNode, OperationDefinitionNode } from 'graphql';
import gql from 'graphql-tag'

type OperationType = 'query' | 'mutation' | 'subscription' | 'persisted'


interface IGraphqlRequestBody {
    query?: string
    operationName?: string
    variables?: Record<string, unknown>
    extensions?: Record<string, unknown>
  }

  interface IOperationDetails {
    operationName: string
    operation: OperationType
  }

export const getFirstGraphqlOperation = (
    graphqlBody: IGraphqlRequestBody[]
  ): IOperationDetails | undefined => {
    try {
      if (!graphqlBody.length) {
        return
      }
  
      if (graphqlBody[0].query) {
        const documentNode = parseGraphqlQuery(graphqlBody[0].query)
        const firstOperationDefinition = documentNode.definitions.find(
          (def) => def.kind === 'OperationDefinition'
        ) as OperationDefinitionNode
        const field = firstOperationDefinition.selectionSet.selections.find(
          (selection) => selection.kind === 'Field'
        ) as FieldNode
  
        const operationName =
          graphqlBody[0].operationName ||
          firstOperationDefinition.name?.value ||
          field?.name.value
        const operation = firstOperationDefinition?.operation
  
        if (!operationName) {
          throw new Error('Operation name could not be determined')
        }
  
        return {
          operationName,
          operation,
        }
      }
  
      if (graphqlBody[0].extensions?.persistedQuery) {
        return {
          operationName: graphqlBody[0].operationName || 'Persisted Query',
          operation: 'persisted',
        }
      }
    } catch (error) {
      console.error('Error getting first operation', error)
      return
    }
  }

const stringify = (
    value: any,
    replacer?: () => any,
    space?: string | number
  ): string => {
    if (!value) {
      return ""
    }
    try {
      return JSON.stringify(value, replacer, space)
    } catch (e) {
      return "{}"
    }
  }
  
  export const parse = <T extends {}>(
    text?: string,
    reviver?: () => any
  ): T | null => {
    try {
      return JSON.parse(text as string, reviver)
    } catch (e) {
      return null
    }
  }
  

interface IHeader {
  name: string
  value?: string
}

export const parseGraphqlQuery = (queryString: any) => {
    return gql`
        ${queryString}
    `
}

const isGraphqlQuery = (queryString: string) => {
    try {
      return !!parseGraphqlQuery(queryString)
    } catch (e) {
      return false
    }
  }

const isParsedGraphqlRequestValid = (
    requestPayloads: any[]
  ) => {
    const isValid = requestPayloads.every((payload) => {
      const isQueryValid =
        ('query' in payload &&
          typeof payload.query === 'string' &&
          isGraphqlQuery(payload.query)) ||
        payload.extensions?.persistedQuery
      const isVariablesValid =
        'variables' in payload ? typeof payload.variables === 'object' : true
  
      return isQueryValid && isVariablesValid
    })
  
    return isValid
  }

export const parseGraphqlBody = (
    body: string
  ) => {
    try {
      const requestPayload = JSON.parse(body)
      const requestPayloads = Array.isArray(requestPayload)
        ? requestPayload
        : [requestPayload]
  
      if (!isParsedGraphqlRequestValid(requestPayloads)) {
        throw new Error('Parsed requestBody is invalid')
      } else {
        return requestPayloads
      }
    } catch (error) {
      return undefined
    }
  }

const decodeQueryParam = (param: string): string => {
    try {
      return decodeURIComponent(param.replace(/\+/g, ' '))
    } catch (e) {
      return param
    }
  }

const decodeRawBody = (raw: chrome.webRequest.UploadData[]) => {
  const decoder = new TextDecoder('utf-8')
  return raw.map((data) => decoder.decode(data.bytes)).join('')
}

const getMultipartFormDataBoundary = (
  headers: IHeader[]
): string | undefined => {
  const contentType = headers.find(
    (header) => header.name.toLowerCase() === 'content-type'
  )?.value
  if (!contentType) {
    return
  }

  const boundary = contentType.split('boundary=')[1]
  const isMultipart = contentType.includes('multipart/form-data')
  if (!isMultipart || typeof boundary !== 'string') {
    return
  }

  return boundary
}

const getRequestBodyFromMultipartFormData = (
  boundary: string,
  formDataString: string
) => {
  // Split on the form boundary
  const parts = formDataString.split(boundary)
  const result: Record<string, any> = {}

  // Process each part
  for (const part of parts) {
    // Trim and remove trailing dashes
    const trimmedPart = part.trim().replace(/-+$/, '')

    // Ignore empty parts
    if (trimmedPart === '' || trimmedPart === '--') {
      continue
    }

    // Extract the header and body
    const [header, ...bodyParts] = trimmedPart.split('\n')
    const body = bodyParts.join('\n').trim()

    // Extract the name from the header
    const nameMatch = header.match(/name="([^"]*)"/)
    if (!nameMatch) {
      continue
    }

    const name = nameMatch[1]
    try {
      result[name] = JSON.parse(body.replace(/\n/g, ''))
    } catch (e) {
      // noop
    }
  }

  if (!result.operations.query) {
    throw new Error('Could not parse request body from multipart/form-data')
  }

  return {
    query: result.operations.query,
    operationName: result.operations.operationName,
    variables: result.operations.variables,
  }
}


const getRequestBodyFromUrl = (url: string) => {
  const urlObj = new URL(url)
  const query = urlObj.searchParams.get('query')
  const variables = urlObj.searchParams.get('variables')
  const operationName = urlObj.searchParams.get('operationName')
  const extensions = urlObj.searchParams.get('extensions')

  const decodedQuery = query ? decodeQueryParam(query) : undefined
  const decodedVariables = variables ? decodeQueryParam(variables) : undefined
  const decodedOperationName = operationName
    ? decodeQueryParam(operationName)
    : undefined
  const decodedExtensions = extensions
    ? decodeQueryParam(extensions)
    : undefined

  if (decodedQuery) {
    return {
      query: decodedQuery,
      operationName: decodedOperationName,
      variables: decodedVariables ? JSON.parse(decodedVariables) : undefined,
    }
  }

  // If not query found, check for persisted query
  const persistedQuery = parse<{ persistedQuery: boolean }>(
    decodedExtensions
  )?.persistedQuery
  if (persistedQuery) {
    return {
      query: '',
      extensions: decodedExtensions ? JSON.parse(decodedExtensions) : undefined,
      variables: decodedVariables ? JSON.parse(decodedVariables) : undefined,
    }
  }

  throw new Error('Could not parse request body from URL')
}

const getRequestBodyFromWebRequestBodyDetails = (
    details: chrome.webRequest.WebRequestBodyDetails,
    headers: IHeader[]
  ): string | undefined => {
    if (details.method === 'GET') {
      const body = getRequestBodyFromUrl(details.url)
      return JSON.stringify(body)
    }
  
    const body = decodeRawBody(details.requestBody?.raw || [])
    const boundary = getMultipartFormDataBoundary(headers)
  
    if (boundary && body) {
      const res = getRequestBodyFromMultipartFormData(boundary, body)
      return JSON.stringify(res)
    }
  
    return body
  }

export const getRequestBody = (details: chrome.webRequest.WebRequestBodyDetails, headers = []): string | undefined => {
  try {
      return getRequestBodyFromWebRequestBodyDetails(details, headers[0] || []) 
  } catch (e) {
    return undefined
  }
}

export const validateWebRequest = (details: chrome.webRequest.WebRequestBodyDetails) => {
    try {
      const body = getRequestBody(details)
      if (!body) {
        return false
      }
  
      const graphqlRequestBody = parseGraphqlBody(body)
      if (!graphqlRequestBody) {
        return false
      }
  
      const primaryOperation = getFirstGraphqlOperation(graphqlRequestBody)
      if (!primaryOperation) {
        return false
      }
    } catch (error) {
      console.error('Error validating network request', error)
      return false
    }
  
    return true
  }