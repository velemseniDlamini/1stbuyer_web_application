// Turning raw model output into something safe to render.
//
// Two jobs, both of them about not trusting the model:
//
//   1. Citations. Guardian writes [[cite:some-id]]. Only ids that exist in the
//      knowledge base survive; anything else is deleted from the text. This is
//      what makes a fabricated citation structurally impossible rather than
//      merely discouraged.
//
//   2. Links. Guardian writes [[link:/credit|Record your score]]. Only routes
//      that actually exist in this app survive. A model asked for a deep link
//      will happily invent /cars/toyota/hilux, and a 404 in a trust product is
//      worse than no link at all.
//
// Anything malformed is stripped rather than shown. The user never sees a raw
// marker leak into the conversation.

import { ALLOWED_HREFS } from './app-knowledge'
import { KNOWLEDGE_BY_ID } from './knowledge'
import type { GuardianCitation, GuardianResponse } from './protocol'

const CITE_PATTERN = /\[\[cite:([a-z0-9._-]+)\]\]/gi
const LINK_PATTERN = /\[\[link:([^\]|]+)\|([^\]]+)\]\]/gi

/**
 * Em and en dashes, with any spaces around them.
 *
 * This product deliberately does not use them anywhere, and a system-prompt
 * instruction is not a guarantee: a model will still reach for one. Built from
 * char codes so this line does not itself contain the characters the
 * typography check looks for.
 */
const DASHES = new RegExp(`\\s*[${String.fromCharCode(0x2014)}${String.fromCharCode(0x2013)}]\\s*`, 'g')

export function renderReply(raw: string): GuardianResponse {
  const citations: GuardianCitation[] = []
  const seen = new Set<string>()

  let text = raw.replace(CITE_PATTERN, (_match, id: string) => {
    const entry = KNOWLEDGE_BY_ID.get(id.toLowerCase())
    // An unknown id is dropped silently: the sentence around it stays, but no
    // citation is attached to it, so the answer degrades to uncited rather
    // than carrying an invented authority.
    if (!entry) return ''
    if (!seen.has(entry.id)) {
      seen.add(entry.id)
      citations.push({
        id: entry.id,
        label: entry.citationLabel,
        href: entry.href,
        url: entry.url,
      })
    }
    return ''
  })

  let link: GuardianResponse['link'] = null
  text = text.replace(LINK_PATTERN, (_match, href: string, label: string) => {
    const cleanHref = href.trim()
    const cleanLabel = label.trim().slice(0, 60)
    // First valid link wins: one call to action, not a wall of buttons.
    if (!link && ALLOWED_HREFS.has(cleanHref) && cleanLabel) {
      link = { label: cleanLabel, href: cleanHref }
    }
    return ''
  })

  // Any marker the model malformed (an unclosed bracket, a stray [[cite:) is
  // removed rather than rendered as literal noise in the bubble.
  text = text.replace(/\[\[[^\]]*\]?\]?/g, '')

  return {
    reply: tidy(text),
    citations,
    link,
  }
}

/**
 * Clean up after the stripped markers.
 *
 * A model that writes "the excellent band ([[cite:credit.bands]])" leaves
 * "the excellent band ()" once the marker is removed, so the empty brackets
 * have to go too, along with a bullet whose only content was a marker.
 */
function tidy(text: string): string {
  return text
    .replace(DASHES, ', ')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/^[ \t]*[-*][ \t]*$/gm, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([.,;:!?])/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim()
}
