// Helper for saving/restoring markdown
const createSaveRestore = () => {
  const saved = []
  const save = (m) => {
    saved.push(m)
    return `\x00${saved.length - 1}\x00`
  }
  const restore = (text) => text.replace(/\x00(\d+)\x00/g, (_, i) => saved[i])
  return { save, restore }
}

// Cache regex patterns
const PATTERNS = {
  codeBlock: /```[\s\S]*?```/g,
  inlineCode: /`[^`\n]+`/g,
  image: /!\[[^\]]*\]\([^)]+\)/g,
  link: /\[[^\]]*\]\([^)]+\)/g,
  trailingSpaces: /( {2,})(\r?\n)/g,

  MD: '(?:[*_]{1,3})?',
  O: '(?:[wWzZ]e|[bB]y|[aAiI]ż|[kK]u|[aAiIoOuUwWzZ])'
}

// Lazy init for complex patterns
let _orphanPattern, _doubleOrphanPattern, _movePatterns, _moveMdBreak

const getOrphanPatterns = () => {
  if (!_orphanPattern) {
    const { MD, O } = PATTERNS
    _orphanPattern = new RegExp(
      `(^| )(${MD})(${O})(${MD}) `,
      'gm'
    )
    _doubleOrphanPattern = new RegExp(
      `\xa0(${MD})(${O})(${MD}) `,
      'g'
    )
    _movePatterns = [
      new RegExp(` (${MD})(${O})(${MD})(\\r?\\n)(\\S)`, 'g'),
      new RegExp(` (${MD})(${O})(${MD}) (\\r?\\n)(\\S)`, 'g'),
      new RegExp(` (${MD})(${O})(${MD})[ \xa0]?(\\r?\\n)([^\r\n])`, 'g')
    ]
    _moveMdBreak = new RegExp(
      ` (${MD})(${O})(${MD})(\\x00\\d+\\x00)(\\r?\\n)`,
      'g'
    )
  }
  return { _orphanPattern, _doubleOrphanPattern, _movePatterns, _moveMdBreak }
}

export const nbsp = (text) => {
  const { save, restore } = createSaveRestore()

  text = text
    .replace(PATTERNS.codeBlock, save)
    .replace(PATTERNS.inlineCode, save)
    .replace(PATTERNS.image, save)
    .replace(PATTERNS.link, save)
    .replace(PATTERNS.trailingSpaces, (_, sp, nl) => save(sp) + nl)
    .replace(/[^\S\r\n]+/g, ' ')

  const { _orphanPattern, _doubleOrphanPattern, _movePatterns, _moveMdBreak } = getOrphanPatterns()

  let prev
  let iterations = 0
  const maxIterations = 5

  while (prev !== text && iterations < maxIterations) {
    prev = text
    text = text.replace(_orphanPattern, '$1$2$3$4\xa0')
    iterations++
  }

  prev = null
  iterations = 0
  while (prev !== text && iterations < maxIterations) {
    prev = text
    text = text.replace(_doubleOrphanPattern, '\xa0$1$2$3\xa0')
    iterations++
  }

  prev = null
  iterations = 0
  while (prev !== text && iterations < maxIterations) {
    prev = text
    _movePatterns.forEach(pattern => {
      text = text.replace(pattern, '$4$1$2$3\xa0$5')
    })
    text = text.replace(_moveMdBreak, '$4$5$1$2$3\xa0')
    iterations++
  }

  return restore(text)
}

export const dash = (text) => {
  return text.replace(/(\s-)+\s/g, (match) =>
    match === ' - ' ? ' – ' : match
  )
}

export const ellipsis = (text) => text.replace(/\.{3}/g, '…')

export const punctuation = (text) => {
  const { save, restore } = createSaveRestore()

  text = text
    .replace(PATTERNS.codeBlock, save)
    .replace(PATTERNS.inlineCode, save)
    .replace(PATTERNS.trailingSpaces, (_, sp, nl) => save(sp) + nl)
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/([,.!?;:])\s{2,}(?!\r?\n)/g, '$1 ')

  return restore(text)
}

export const abbreviations = (text) => {
  const { save, restore } = createSaveRestore()

  text = text
    .replace(PATTERNS.codeBlock, save)
    .replace(PATTERNS.inlineCode, save)
    .replace(PATTERNS.image, save)
    .replace(PATTERNS.link, save)

  const abbrevs = [
    'ul', 'al', 'pl', 'os',
    'dr', 'prof', 'mgr', 'inż', 'hab',
    'np', 'tj', 'tzn', 'itd', 'itp', 'pot', 'ang',
    'wg', 'ok', 'ew', 'godz', 'poz', 'por', 'zob',
    'cdn', 'r', 'w', 'nr', 'vol', 'op', 'red',
    'm\\.in', 'p\\.n\\.e', 'n\\.e', 'tzw', 'śp'
  ]

  const pattern = new RegExp(
    `\\b(${abbrevs.join('|')})\\. (?=[\\p{L}\\d])`,
    'giu'
  )

  text = text.replace(pattern, (match, abbr) => abbr + '.\xa0')

  return restore(text)
}

export const format = (text) => {
  return punctuation(abbreviations(nbsp(dash(ellipsis(text))))).trim()
}