import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cache } from 'hono/cache'

const app = new Hono()
app.use('*', logger())

// Types
type JSONLDDocument = {
  '@context'?: any
  [key: string]: any
}

// Import all JSON-LD files at build time
const contextFiles = import.meta.glob('../contexts/**/*.jsonld', { 
  eager: true,
  as: 'raw'
})

const vocabFiles = import.meta.glob('../vocab/**/*.html', { 
  eager: true,
  as: 'raw'
})

// Helpers
async function loadDocument(path: string): Promise<JSONLDDocument> {
  const content = contextFiles[path]
  if (!content) {
    throw new Error(`Document not found: ${path}`)
  }
  return JSON.parse(content)
}

async function fileExists(path: string): Promise<boolean> {
  return vocabFiles[path] !== undefined
}

// Main handler
const serveDocument = (basePath: string = '') => {
  return async (c: any) => {
    const path = c.req.param('path')

    // Handle explicit .jsonld requests
    if (path.endsWith('.jsonld')) {
      // Only serve .jsonld files from contexts directory
      if (basePath === 'contexts') {
        const contextPath = `../${basePath}/${path}`
        try {
          const doc = await loadDocument(contextPath)
          return c.json(doc, {
            headers: { 'Content-Type': 'application/ld+json' }
          })
        } catch {
          return c.json({ error: 'Document not found' }, 404)
        }
      }
      
      return c.json({ error: 'Document not found' }, 404)
    }

    // Try vocab directory first (always HTML)
    const vocabPath = `../vocab/${path}.html`
    if (await fileExists(vocabPath)) {
      return c.html(vocabFiles[vocabPath])
    }

    // Redirect to .jsonld URL for context files
    if (basePath === 'contexts') {
      return c.redirect(`/contexts/${path}.jsonld`)
    }

    return c.json({ error: 'Document not found' }, 404)
  }
}

// Routes
app.get('/contexts/:path{.*}', cache({
  cacheName: 'contexts-cache',
  cacheControl: 'public, max-age=86400',
}), serveDocument('contexts'))

app.get('/:path{.*}', cache({
  cacheName: 'root-cache',
  cacheControl: 'public, max-age=86400',
}), serveDocument())

app.get('/', async (c) => {
  try {
    return c.html(
      <html>
        <head><title>Murmurations Namespace</title></head>
        <body>
          <h1>Murmurations Namespace</h1>
          <h2>Vocabulary and Contexts for Murmurations</h2>
          <p>Vocabulary definitions are hosted in the root directory (e.g., <a href="/linkedSchemas"><code>linkedSchemas</code> definition</a>), and contexts are hosted in the <code>/contexts</code> directory (e.g., <a href="/contexts/karte_von_morgen-v1.0.0.jsonld">karte_von_morgen-v1.0.0.jsonld</a>).</p>
        </body>
      </html>
    )
  } catch {
    return c.text('Error loading document list', 500)
  }
})

export default app
