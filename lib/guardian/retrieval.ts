// Choosing which knowledge entries to put in front of the model.
//
// WHY THERE IS NO VECTOR DATABASE HERE
//
// The corpus is about a dozen entries. Embedding a dozen paragraphs, standing
// up a vector store and paying an embedding call per question would add a
// service, a schema and a failure mode to retrieve from a list short enough to
// scan with a for-loop. Keyword scoring over a curated corpus is the correct
// size of solution for this corpus, and it is auditable: you can tell exactly
// why an entry was selected.
//
// The interface is the part that matters. `retrieve()` takes a query and
// returns ranked entries. Swapping the body of this function for an embedding
// search later changes nothing anywhere else in Guardian.

import { KNOWLEDGE, type KnowledgeEntry, type KnowledgeTopic } from './knowledge'
import type { PageId } from './protocol'

/** Topics worth pre-loading for the screen the user is on. */
const PAGE_TOPICS: Record<PageId, KnowledgeTopic[]> = {
  dashboard: ['app'],
  journey: ['app'],
  explore: ['vehicles'],
  'new-cars': ['vehicles'],
  rivals: ['vehicles'],
  compare: ['vehicles', 'finance'],
  credit: ['credit'],
  finance: ['finance', 'credit'],
  documents: ['quotation'],
  quotation: ['quotation', 'finance'],
  insurance: ['insurance'],
  profile: ['app'],
  support: ['app'],
  other: ['app'],
}

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
}

export type Retrieved = { entry: KnowledgeEntry; score: number }

/**
 * Rank the corpus against a question.
 *
 * Scoring is deliberately dull: a keyword hit is worth more than a body hit,
 * and an entry whose topic matches the current screen gets a nudge so that
 * "explain this" on the Insurance screen retrieves insurance rather than
 * whichever entry happens to share a word.
 */
export function retrieve(
  query: string,
  page: PageId,
  limit = 4,
): Retrieved[] {
  const tokens = tokenise(query)
  const pageTopics = PAGE_TOPICS[page] ?? []
  const scored: Retrieved[] = []

  for (const entry of KNOWLEDGE) {
    let score = 0
    const keywords = new Set(entry.keywords)
    const body = entry.body.toLowerCase()
    const title = entry.title.toLowerCase()

    for (const token of tokens) {
      if (keywords.has(token)) score += 3
      else if (title.includes(token)) score += 2
      else if (body.includes(token)) score += 1
    }

    // A topical nudge, not an override: it can lift a weak match above another
    // weak match, but it cannot beat a real keyword hit from another topic.
    if (pageTopics.includes(entry.topic)) score += 1.5

    if (score > 0) scored.push({ entry, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id))
    .slice(0, limit)
}

/**
 * Render retrieved entries for the prompt, each tagged with the id the model
 * must use to cite it. The id is the only citation handle it is ever given.
 */
export function renderForPrompt(results: Retrieved[]): string {
  if (results.length === 0) return 'No approved source material matched this question.'
  return results
    .map(
      ({ entry }) =>
        `<source id="${entry.id}" cite-as="${entry.citationLabel}">\n${entry.title}\n${entry.body}\n</source>`,
    )
    .join('\n\n')
}
