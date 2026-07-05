import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import fuenteCheckHandler from './api/fuentes/check.js'
import educandoHandler from './api/materiales/educando.js'
import libroAbiertoHandler from './api/materiales/libro-abierto.js'
import libroAbiertoPdfHandler from './api/materiales/libro-abierto-pdf.js'
import aiGenerateHandler from './api/ai/generate.js'

const API_HANDLERS = {
  '/api/fuentes/check': fuenteCheckHandler,
  '/api/materiales/educando': educandoHandler,
  '/api/materiales/libro-abierto': libroAbiertoHandler,
  '/api/materiales/libro-abierto-pdf': libroAbiertoPdfHandler,
}

const EDGE_API_HANDLERS = {
  '/api/ai/generate': aiGenerateHandler,
}

const readRawBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })

function attachJsonHelpers(res) {
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (payload) => {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
    }
    res.end(JSON.stringify(payload))
  }
}

function docenteosApiDevPlugin() {
  return {
    name: 'docenteos-api-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]
        const edgeHandler = EDGE_API_HANDLERS[url]
        if (edgeHandler) {
          try {
            const body = req.method === 'GET' || req.method === 'HEAD'
              ? undefined
              : await readRawBody(req)
            const reqUrl = new URL(req.url || '/', 'http://localhost')
            const request = new Request(reqUrl.toString(), {
              method: req.method,
              headers: req.headers,
              body,
              duplex: body ? 'half' : undefined,
            })
            const response = await edgeHandler(request)
            res.statusCode = response.status
            response.headers.forEach((value, key) => {
              res.setHeader(key, value)
            })
            if (!response.body) {
              res.end()
              return
            }
            Readable.fromWeb(response.body).pipe(res)
          } catch (error) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json; charset=utf-8')
            res.end(JSON.stringify({
              error: 'Error ejecutando API local de IA',
              detail: error?.message || String(error),
            }))
          }
          return
        }

        const handler = API_HANDLERS[url]
        if (!handler) {
          next()
          return
        }

        try {
          const reqUrl = new URL(req.url || '/', 'http://localhost')
          req.query = Object.fromEntries(reqUrl.searchParams.entries())
          req.body = req.method === 'GET' ? {} : await readBody(req)
          attachJsonHelpers(res)
          await handler(req, res)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({
            error: 'Error ejecutando API local',
            detail: error?.message || String(error),
          }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), docenteosApiDevPlugin()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('firebase')) return 'firebase'
            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor'
            if (id.includes('react-router')) return 'router'
            if (id.includes('lucide-react')) return 'icons'
            return 'vendor'
          },
        },
      },
    },
  }
})
