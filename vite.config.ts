import { defineConfig, type Plugin } from 'vite'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Só em desenvolvimento: o editor de câmeras (?edit=1) grava src/shots.json direto no projeto
const saveShots = (): Plugin => ({
  name: 'save-shots',
  configureServer(server) {
    server.middlewares.use('/__save-shots', (req, res) => {
      if (req.method !== 'POST') return res.end()
      let body = ''
      req.on('data', (c) => (body += c))
      req.on('end', () => {
        try {
          const data = JSON.parse(body)
          writeFileSync(resolve(__dirname, 'src/shots.json'), JSON.stringify(data, null, 2) + '\n')
          res.end('ok')
        } catch (e) {
          res.statusCode = 400
          res.end(String(e))
        }
      })
    })
  },
})

export default defineConfig({ plugins: [saveShots()] })
