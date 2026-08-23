'use client'

/**
 * The narrow slice of markdown Guardian is instructed to use: paragraphs,
 * "- " bullets and **bold**.
 *
 * Rendered by splitting the string, never by dangerouslySetInnerHTML. Model
 * output is untrusted text, and the one thing that must not happen in an app
 * built on trust is a model talking the browser into running markup. A full
 * markdown library would be a bigger dependency and a bigger attack surface
 * for three constructs.
 *
 * Shared by the floating panel and the full Guardian screen so the two cannot
 * render the same answer differently.
 */
export function GuardianRichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim())

  return (
    <div className="space-y-2">
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').filter((line) => line.trim())
        const isList = lines.length > 0 && lines.every((line) => /^\s*[-*]\s+/.test(line))

        if (isList) {
          return (
            <ul key={blockIndex} className="space-y-1">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex} className="flex gap-2 text-sm">
                  <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  <span className="min-w-0 text-pretty">
                    {withBold(line.replace(/^\s*[-*]\s+/, ''))}
                  </span>
                </li>
              ))}
            </ul>
          )
        }

        return (
          <p key={blockIndex} className="text-sm leading-relaxed text-pretty">
            {withBold(block)}
          </p>
        )
      })}
    </div>
  )
}

function withBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}
