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
