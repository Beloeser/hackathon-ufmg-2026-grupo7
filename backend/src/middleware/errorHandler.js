export const errorHandler = (err, req, res, next) => {
  console.error(err.stack)
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500
    }
  })
}

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: {
      message: 'Rota não encontrada',
      status: 404
    }
  })
}
