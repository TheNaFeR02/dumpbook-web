import * as Y from "yjs"

export function textFromXml(el: Y.XmlFragment | Y.XmlElement): string {
  return el
    .toArray()
    .map((child) => {
      if (child instanceof Y.XmlText) return child.toString()
      if (child instanceof Y.XmlElement) return textFromXml(child) + "\n"
      return ""
    })
    .join("")
}

export function textFromYDoc(doc: Y.Doc): string {
  return textFromXml(doc.getXmlFragment("default"))
}

export function countWords(text: string): number {
  const trimmed = text.trim()
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length
}

export function truncateYDocToLimit(
  doc: Y.Doc,
  limits: { wordLimit: number; charLimit: number },
): void {
  const fragment = doc.getXmlFragment("default")
  const elements = fragment.toArray()

  // Capture original counts before any modification.
  const originalText = textFromYDoc(doc)
  const originalWordCount = countWords(originalText)
  const originalCharCount = originalText.length

  // Walk forward and find the first element that crosses the limit.
  let wordsSoFar = 0
  let charsSoFar = 0
  let cutoffIndex = elements.length

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]
    const elText =
      el instanceof Y.XmlElement
        ? textFromXml(el) + "\n"
        : el instanceof Y.XmlText
          ? el.toString()
          : ""

    if (
      wordsSoFar + countWords(elText) > limits.wordLimit ||
      charsSoFar + elText.length > limits.charLimit
    ) {
      cutoffIndex = i
      break
    }
    wordsSoFar += countWords(elText)
    charsSoFar += elText.length
  }

  // Write truncation metadata so the client can show original counts and gradient.
  doc.transact(() => {
    const meta = doc.getMap("_meta")
    meta.set("truncated", true)
    meta.set("originalWordCount", originalWordCount)
    meta.set("originalCharCount", originalCharCount)
  })

  if (cutoffIndex < elements.length) {
    doc.transact(() => {
      fragment.delete(cutoffIndex, fragment.length - cutoffIndex)
    })
  }
}
