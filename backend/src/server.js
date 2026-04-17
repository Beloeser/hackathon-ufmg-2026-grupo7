import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import bodyParser from 'body-parser'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Middlewares
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Rotas
app.get('/health', (req, res) => {
  res.json({ status: 'OK' })
})

// Importar rotas aqui
// import routes from './routes/index.js'
// app.use('/api', routes)

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})
