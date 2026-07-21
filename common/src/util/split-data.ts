export type SplitDataValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date
  | RegExp
  | SplitDataValue[]
  | { [key: string]: SplitDataValue }

type PlainObject = Record<string, SplitDataValue>

interface Chunk<T> {
  data: T
  length: number
}

function isPlainObject(val: SplitDataValue): val is PlainObject {
  return (
    typeof val === 'object' &&
    val !== null &&
    !Array.isArray(val) &&
    !(val instanceof Date) &&
    !(val instanceof RegExp) &&
    Object.getPrototypeOf(val) === Object.prototype
  )
}

function getJsonSize<T extends SplitDataValue>(data: T): number {
  if (data === undefined) {
    return 'undefined'.length
  }
  return JSON.stringify(data).length
}

function splitString(params: {
  data: string
  maxSize: number
}): Chunk<string>[] {
  const { data, maxSize } = params
  if (data === '') {
    return [{ data: '', length: 2 }]
  }

  const chunks: Chunk<string>[] = []
  let currentChunk: Chunk<string> = { data: '', length: 2 }

  if (maxSize < 2) {
    for (let i = 0; i < data.length; i++) {
      chunks.push({ data: data[i], length: getJsonSize(data[i]) })
    }
    return chunks
  }

  for (let i = 0; i < data.length; i++) {
    const char = data[i]
    const charSizeContribution = JSON.stringify(char).length - 2
    const potentialNextSize = currentChunk.length + charSizeContribution

    if (potentialNextSize <= maxSize) {
      currentChunk.data += char
      currentChunk.length = potentialNextSize
    } else {
      if (currentChunk.data !== '') {
        chunks.push(currentChunk)
      }

      currentChunk = { data: char, length: 2 + charSizeContribution }
    }
  }

  if (currentChunk.data !== '') {
    chunks.push(currentChunk)
  }

  return chunks
}

function splitObject(params: {
  obj: PlainObject
  maxSize: number
}): Chunk<PlainObject>[] {
  const { obj, maxSize } = params
  const chunks: Chunk<PlainObject>[] = []

  let currentChunk: Chunk<PlainObject> = {
    data: {},
    length: 2,
  }
  for (const [key, value] of Object.entries(obj)) {
    const entryObject: PlainObject = { [key]: value }
    const standaloneEntry: Chunk<PlainObject> = {
      data: entryObject,
      length: getJsonSize(entryObject),
    }

    if (standaloneEntry.length > maxSize) {
      const overhead = getJsonSize({ [key]: '' }) - 2

      const items = splitDataWithLengths({
        data: value,
        maxChunkSize: maxSize - overhead,
      })

      for (const [index, item] of items.entries()) {
        if (index < items.length - 1) {
          if (key in currentChunk.data) {
            chunks.push(currentChunk)
            currentChunk = {
              data: { [key]: item.data },
              length: item.length + overhead,
            }
            continue
          }

          const candidateChunkLength =
            currentChunk.length +
            item.length +
            (currentChunk.length === 2 ? 0 : -1)
          if (candidateChunkLength <= maxSize) {
            currentChunk.data[key] = item.data
            currentChunk.length = candidateChunkLength
            continue
          }

          if (currentChunk.length > 2) {
            chunks.push(currentChunk)
          }
          currentChunk = {
            data: { [key]: item.data },
            length: item.length + overhead,
          }
          continue
        }

        if (currentChunk.length > 2) {
          chunks.push(currentChunk)
        }
        currentChunk = {
          data: { [key]: item.data },
          length: item.length + overhead,
        }
      }

      continue
    }

    const candidateChunkLength =
      currentChunk.length +
      standaloneEntry.length -
      (currentChunk.length === 2 ? 2 : 3)

    if (candidateChunkLength <= maxSize) {
      currentChunk.data[key] = value
      currentChunk.length = candidateChunkLength
      continue
    }

    if (currentChunk.length > 2) {
      chunks.push(currentChunk)
    }
    currentChunk = standaloneEntry
  }

  if (currentChunk.length > 2) {
    chunks.push(currentChunk)
  }

  return chunks
}

function splitArray<T extends SplitDataValue>(params: {
  arr: T[]
  maxSize: number
}): Chunk<T[]>[] {
  const { arr, maxSize } = params
  const chunks: Chunk<T[]>[] = []
  let currentChunk: Chunk<T[]> = { data: [], length: 2 }

  for (const element of arr) {
    const entryArr = [element]
    const standaloneEntry: Chunk<T[]> = {
      data: entryArr,
      length: getJsonSize(entryArr),
    }

    if (standaloneEntry.length > maxSize) {
      if (currentChunk.length > 2) {
        chunks.push(currentChunk)
      }
      currentChunk = { data: [], length: 2 }

      const items = splitDataWithLengths({
        data: element,
        maxChunkSize: maxSize - 2,
      })

      for (const item of items) {
        const candidateChunkLength =
          currentChunk.length +
          item.length +
          (currentChunk.length === 2 ? 1 : 0)
        if (candidateChunkLength <= maxSize) {
          currentChunk.data.push(item.data as T)
          currentChunk.length = candidateChunkLength
          continue
        }

        if (currentChunk.length > 2) {
          chunks.push(currentChunk)
        }
        currentChunk = { data: [item.data as T], length: item.length + 2 }
      }
      continue
    }

    const candidateChunkLength =
      currentChunk.length +
      standaloneEntry.length -
      (currentChunk.length === 2 ? 1 : 2)

    if (candidateChunkLength <= maxSize) {
      currentChunk.data.push(element)
      currentChunk.length = candidateChunkLength
      continue
    }

    if (currentChunk.length > 2) {
      chunks.push(currentChunk)
    }
    currentChunk = standaloneEntry
  }

  if (currentChunk.length > 2) {
    chunks.push(currentChunk)
  }

  return chunks
}

function splitDataWithLengths<T extends SplitDataValue>(params: {
  data: T
  maxChunkSize: number
}): Chunk<T>[] {
  const { data, maxChunkSize } = params
  if (typeof data !== 'object' || data === null) {
    if (typeof data === 'string') {
      const result = splitString({
        data,
        maxSize: maxChunkSize,
      })
      return result as Chunk<T>[]
    }
    return [{ data, length: getJsonSize(data) }]
  }

  if (!Array.isArray(data) && !isPlainObject(data)) {
    return [{ data, length: getJsonSize(data) }]
  }

  if (Array.isArray(data)) {
    const result = splitArray({
      arr: data,
      maxSize: maxChunkSize,
    })
    return result as Chunk<T>[]
  }

  const result = splitObject({
    obj: data,
    maxSize: maxChunkSize,
  })
  return result as Chunk<T>[]
}

export function splitData<T extends SplitDataValue>(params: {
  data: T
  maxChunkSize?: number
}): T[] {
  const { data, maxChunkSize = 99_000 } = params
  return splitDataWithLengths({ data, maxChunkSize }).map((cwjl) => cwjl.data)
}
