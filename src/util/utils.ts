import { CONNECTION_STATE } from '../constants'
import * as URL from 'url'

/**
 * A regular expression that matches whitespace on either side, but
 * not in the center of a string
 */
const TRIM_REGULAR_EXPRESSION: RegExp = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g

/**
 * Removes whitespace from the beginning and end of a string
 */
export const trim = function (inputString: string): string {
  if (inputString.trim) {
    return inputString.trim()
  }
  return inputString.replace(TRIM_REGULAR_EXPRESSION, '')
}

/**
 * Compares two objects for deep (recoursive) equality
 *
 * This used to be a significantly more complex custom implementation,
 * but JSON.stringify has gotten so fast that it now outperforms the custom
 * way by a factor of 1.5 to 3.
 *
 * In IE11 / Edge the custom implementation is still slightly faster, but for
 * consistencies sake and the upsides of leaving edge-case handling to the native
 * browser / node implementation we'll go for JSON.stringify from here on.
 *
 * Please find performance test results here
 *
 * http://jsperf.com/deep-equals-code-vs-json
 */
export const deepEquals = (objA: any, objB: any): boolean => {
  if (objA === objB) {
    return true
  } else if (typeof objA !== 'object' || typeof objB !== 'object') {
    return false
  }

  return JSON.stringify(objA) === JSON.stringify(objB)
}

/**
 * Similar to deepEquals above, tests have shown that JSON stringify outperforms any attempt of
 * a code based implementation by 50% - 100% whilst also handling edge-cases and keeping
 * implementation complexity low.
 *
 * If ES6/7 ever decides to implement deep copying natively (what happened to Object.clone?
 * that was briefly a thing...), let's switch it for the native implementation. For now though,
 * even Object.assign({}, obj) only provides a shallow copy.
 *
 * Please find performance test results backing these statements here:
 *
 * http://jsperf.com/object-deep-copy-assign
 */
export const deepCopy = (obj: any): any => {
  if (typeof obj === 'object') {
    return JSON.parse(JSON.stringify(obj))
  }
  return obj
}

/**
 * Copy the top level of items, but do not copy its items recourisvely. This
 * is much quicker than deepCopy does not guarantee the object items are new/unique.
 * Mainly used to change the reference to the actual object itself, but not its children.
 */
export const shallowCopy = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.slice(0)
  } else if (typeof obj === 'object') {
    const copy = Object.create(null)
    const props = Object.keys(obj)
    for (let i = 0; i < props.length; i++) {
      copy[props[i]] = obj[props[i]]
    }
    return copy
  }
  return obj
}

/**
 * Used to see if a protocol is specified within the url
 * @type {RegExp}
 */
const hasUrlProtocol = /^wss:|^ws:|^\/\//

/**
 * Used to see if the protocol contains any unsupported protocols
 * @type {RegExp}
 */
const unsupportedProtocol = /^http:|^https:/

/**
 * Take the url passed when creating the client and ensure the correct
 * protocol is provided
 * @param  {String} url Url passed in by client
 * @return {String} Url with supported protocol
 */
export const parseUrl = (initialURl: string, defaultPath: string): string => {
  let url = initialURl
  if (unsupportedProtocol.test(url)) {
    throw new Error('Only ws and wss are supported')
  }
  if (!hasUrlProtocol.test(url)) {
    url = `ws://${url}`
  } else if (url.indexOf('//') === 0) {
    url = `ws:${url}`
  }
  const serverUrl = URL.parse(url)
  if (!serverUrl.host) {
    throw new Error('invalid url, missing host')
  }
  serverUrl.protocol = serverUrl.protocol ? serverUrl.protocol : 'ws:'
  serverUrl.pathname = serverUrl.pathname ? serverUrl.pathname : defaultPath
  return URL.format(serverUrl)
}

/**
* Returns a random string. The first block of characters
* is a timestamp, in order to allow databases to optimize for semi-
* sequentuel numberings
*/
export const getUid = (): string => {
  const timestamp = (new Date()).getTime().toString(36)
  const randomString = (Math.random() * 10000000000000000).toString(36).replace('.', '')

  return `${timestamp}-${randomString}`
}

export interface RecordSetArguments { callback?: (error: string | null) => void, path?: string, data?: any }
export interface RecordSubscribeArguments { callback: (data: any) => void, path?: string, triggerNow?: boolean }

/**
 * Creates a map based on the types of the provided arguments
 */
export const normalizeSetArguments = (args: IArguments, startIndex: number = 0): RecordSetArguments => {
  let result

  const isRootData = (data: any) => data !== undefined && typeof data === 'object'
  const isNestedData = (data: any) => typeof data !== 'function'
  const isPath = (path: any) => path !== undefined && typeof path === 'string'
  const isCallback = (callback: any) => typeof callback === 'function'

  if (args.length === startIndex + 1) {
    result = {
      path: undefined,
      data: isRootData(args[startIndex]) ? args[startIndex] : undefined,
      callback: undefined
    }
  }

  if (args.length === startIndex + 2) {
    result = { path: undefined, data: undefined, callback: undefined }
    if (!isCallback(args[startIndex + 1]) && isNestedData(args[startIndex + 1])) {
      result.path = isPath(args[startIndex]) ? args[startIndex] : false
    }

    if (isPath(args[startIndex])) {
      result.data = isNestedData(args[startIndex + 1]) ? args[startIndex + 1] : undefined
    } else {
      result.data = isRootData(args[startIndex]) ? args[startIndex] : undefined
    }

    if (!isPath(args[startIndex])) {
      result.callback = isCallback(args[startIndex + 1]) ? args[startIndex + 1] : false
    }
  }

  if (args.length === startIndex + 3) {
    result = {
      path: isPath(args[startIndex]) ? args[startIndex] : false,
      data: isNestedData(args[startIndex + 1]) ? args[startIndex + 1] : false,
      callback: isCallback(args[startIndex + 2]) ? args[startIndex + 2] : false
    }
  }

  if (result) {
    if (result.path !== undefined && result.path.length === 0 || result.path === false) {
      throw Error('Invalid set path argument')
    }
    if (result.data === undefined && !result.path || result.data === false) {
      throw Error('Invalid set data argument')
    }
    if (result.callback !== undefined && result.callback === false) {
      throw Error('Invalid set callback argument')
    }
    return result
  }

  throw Error('Invalid set arguments')
}

/**
 * Creates a map based on the types of the provided arguments
 */
export const normalizeArguments = (args: IArguments): RecordSubscribeArguments => {
  // If arguments is already a map of normalized parameters
  // (e.g. when called by AnonymousRecord), just return it.
  if (args.length === 1 && typeof args[0] === 'object') {
    return args[0]
  }

  const result = Object.create(null)

  for (let i = 0; i < args.length; i++) {
    if (typeof args[i] === 'string') {
      result.path = args[i]
    } else if (typeof args[i] === 'function') {
      result.callback = args[i]
    } else if (typeof args[i] === 'boolean') {
      result.triggerNow = args[i]
    }
  }
  return result
}
