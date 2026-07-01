import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import fuenteCheckHandler from './api/fuentes/check.js'
import libroAbiertoHandler from './api/materiales/libro-abierto.js'
import libroAbiertoPdfHandler from './api/materiales/libro-abierto-pdf.js'

const API_HANDLERS = {
  '/api/fuentes/check': fuenteCheckHandler,
  '/api/materiales/libro-abierto': libroAbiertoHandler,
  '/api/materiales/libro-abierto-pdf': libroAbiertoPdfHandler,
}

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
