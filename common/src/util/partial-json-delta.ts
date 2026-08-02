import type { JSONObject, JSONValue } from '../types/json'

export function parsePartialJsonObjectSingle(content: string): {
  lastParamComplete: boolean
  params: JSONObject
} {
  let parsed: JSONValue
  try {
    parsed = JSON.parse(content)
    if (isJSONObject(parsed)) return { lastParamComplete: true, params: parsed }
  } catch {}

  if (!content.match(/\d$/)) {
    try {
      parsed = JSON.parse(content + '}')
      if (isJSONObject(parsed))
        return { lastParamComplete: true, params: parsed }
    } catch {}
  }

  try {
    parsed = JSON.parse(content + '"}')
    if (isJSONObject(parsed))
      return { lastParamComplete: false, params: parsed }
  } catch {}

  if (content.endsWith('\\')) {
    try {
      parsed = JSON.parse(content.slice(0, -1) + '"}')
      if (isJSONObject(parsed))
        return { lastParamComplete: false, params: parsed }
    } catch {}
  }

  let commaPos = content.length
  while ((commaPos = content.lastIndexOf(',', commaPos - 1)) !== -1) {
    try {
      parsed = JSON.parse(content.slice(0, commaPos) + '}')
      if (isJSONObject(parsed))
        return { lastParamComplete: true, params: parsed }
    } catch {}
  }

  return { lastParamComplete: true, params: {} }
}

export function getPartialJsonDelta(
  content: string,
  previous: string,
): {
  delta: JSONObject
  result: JSONObject
  lastParam: { key: string | undefined; complete: boolean }
} {
  if (!content.startsWith(previous)) {
    throw new Error(
      `Content must be previous content plus new content. Content ${JSON.stringify(content)} does not start with previous content ${JSON.stringify(previous)}`,
    )
  }
  const { lastParamComplete, params } = parsePartialJsonObjectSingle(content)
  const lastParam = Object.keys(params).pop()

  const { lastParamComplete: prevLastParamComplete, params: prevParams } =
    parsePartialJsonObjectSingle(previous)
  const prevLastParam = Object.keys(prevParams).pop()

  const entries = Object.entries(params)

  const delta: JSONObject = {}
  for (const [key, value] of entries) {
    if (prevParams[key] === value) {
      if (prevLastParam === key && !prevLastParamComplete) {
        delta[key] = ''
      }
      continue
    }
    const prevValue = prevParams[key]
    if (typeof value === 'string' && typeof prevValue === 'string') {
      delta[key] = value.slice(prevValue.length)
    } else {
      delta[key] = value
    }
  }

  return {
    delta,
    result: params,
    lastParam: {
      key: lastParam,
      complete:
        prevLastParam === lastParam
          ? lastParamComplete && !prevLastParamComplete
          : lastParamComplete,
    },
  }
}

function isJSONObject(value: JSONValue): value is JSONObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
