// Exemplo de controller
export const getExample = (req, res) => {
  try {
    res.json({ message: 'Exemplo de resposta' })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}

export const postExample = (req, res) => {
  try {
    const data = req.body
    res.json({ message: 'Dados recebidos', data })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
}
