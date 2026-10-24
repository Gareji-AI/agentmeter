// Deterministic metered tools. No network, no model: a judge can run the whole
// metering, top-up, payout and reconciliation loop offline in under a minute.

const summarise = (text, maxSentences) => {
  const sentences = String(text)
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  const kept = sentences.slice(0, Math.max(1, Math.min(5, Number(maxSentences) || 2)));
  return kept.join(' ');
};

const slugify = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const tokens = (text) => String(text).toLowerCase().match(/[a-z0-9]+/g) || [];

const STOPWORDS = new Set([
  'the','a','an','and','or','of','to','in','is','are','was','were','for','on','with','that',
  'this','it','as','by','at','from','be','been','has','have','had','not','but','if','then',
  'so','we','you','i','they','he','she','its','their','our','your','my','me','them','us',
]);

function keywordScores(text) {
  const counts = new Map();
  for (const token of tokens(text)) {
    if (token.length < 4 || STOPWORDS.has(token)) continue;
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return counts;
}

/**
 * Every handler receives (args, ctx) and returns a plain JSON-serialisable object.
 * Handlers must be pure and fast: they run inside the metering transaction.
 */
export const BUILTIN_HANDLERS = {
  extract_entities(args) {
    const text = String(args.text ?? '');
    const emails = [...new Set(text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [])];
    const urls = [...new Set(text.match(/https?:\/\/[^\s)>\]]+/g) || [])];
    const money = [...new Set(text.match(/\$\s?\d[\d,]*(?:\.\d+)?/g) || [])];
    const dates = [...new Set(
      text.match(/\b\d{4}-\d{2}-\d{2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}\b/g,
      ) || [],
    )];
    return {
      emails, urls, money, dates,
      counts: { emails: emails.length, urls: urls.length, money: money.length, dates: dates.length },
    };
  },

  summarize_text(args) {
    const text = String(args.text ?? '');
    const summary = summarise(text, args.maxSentences);
    const words = tokens(text).length;
    const summaryWords = tokens(summary).length;
    return {
      summary,
      stats: {
        inputWords: words,
        summaryWords,
        compression: words === 0 ? 0 : Number((summaryWords / words).toFixed(3)),
      },
    };
  },

  keyword_extract(args) {
    const limit = Math.max(1, Math.min(20, Number(args.limit) || 8));
    const scores = keywordScores(String(args.text ?? ''));
    const keywords = [...scores.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([term, count]) => ({ term, count }));
    return { keywords, scannedTerms: scores.size };
  },

  diff_json(args) {
    const left = args.left ?? {};
    const right = args.right ?? {};
    const changes = [];
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    for (const key of [...keys].sort()) {
      const a = left[key];
      const b = right[key];
      const same = JSON.stringify(a) === JSON.stringify(b);
      if (!same) changes.push({ key, from: a ?? null, to: b ?? null });
    }
    return { changed: changes.length > 0, count: changes.length, changes };
  },

  slugify_batch(args) {
    const inputs = Array.isArray(args.items) ? args.items : [];
    if (inputs.length > 200) throw new Error('slugify_batch accepts at most 200 items');
    return { slugs: inputs.map((item) => slugify(item)) };
  },

  validate_links(args) {
    const text = String(args.text ?? '');
    const found = [...new Set(text.match(/https?:\/\/[^\s)>\]]+/g) || [])];
    return {
      links: found.map((url) => {
        let parsed;
        try { parsed = new URL(url); } catch { parsed = null; }
        return {
          url,
          valid: Boolean(parsed),
          scheme: parsed?.protocol.replace(':', '') ?? null,
          host: parsed?.hostname ?? null,
          https: parsed?.protocol === 'https:',
        };
      }),
      count: found.length,
    };
  },
};

/** Tool catalogue seeded into a fresh database. */
export const BUILTIN_TOOLS = [
  {
    slug: 'extract-entities',
    name: 'extract_entities',
    description: 'Extract emails, URLs, money amounts and dates from a text blob. Deterministic, no model call.',
    priceMicro: 10_000,
    handler: 'extract_entities',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Text to scan.' } },
      required: ['text'],
    },
  },
  {
    slug: 'summarize-text',
    name: 'summarize_text',
    description: 'Compress a passage to a fixed number of leading sentences and report the compression ratio.',
    priceMicro: 25_000,
    handler: 'summarize_text',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Passage to compress.' },
        maxSentences: { type: 'number', description: 'Sentences to keep, 1-5. Default 2.' },
      },
      required: ['text'],
    },
  },
  {
    slug: 'keyword-extract',
    name: 'keyword_extract',
    description: 'Rank the top keywords in a passage by frequency, stopwords removed.',
    priceMicro: 15_000,
    handler: 'keyword_extract',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Passage to scan.' },
        limit: { type: 'number', description: 'Keywords to return, 1-20. Default 8.' },
      },
      required: ['text'],
    },
  },
  {
    slug: 'diff-json',
    name: 'diff_json',
    description: 'Structural diff of two JSON objects, returning changed keys with before/after values.',
    priceMicro: 5_000,
    handler: 'diff_json',
    inputSchema: {
      type: 'object',
      properties: {
        left: { type: 'object', description: 'Baseline object.' },
        right: { type: 'object', description: 'Candidate object.' },
      },
      required: ['left', 'right'],
    },
  },
  {
    slug: 'slugify-batch',
    name: 'slugify_batch',
    description: 'Turn up to 200 titles into ASCII kebab-case slugs.',
    priceMicro: 20_000,
    handler: 'slugify_batch',
    inputSchema: {
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'string' }, description: 'Titles.' } },
      required: ['items'],
    },
  },
  {
    slug: 'validate-links',
    name: 'validate_links',
    description: 'Find URLs in text and report whether each one parses and is HTTPS.',
    priceMicro: 10_000,
    handler: 'validate_links',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Text containing links.' } },
      required: ['text'],
    },
  },
];
