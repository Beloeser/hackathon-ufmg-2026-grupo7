import User from '../models/UserModel.js'

export const login = async (req, res) => {
  try {
    const { email, password } = req.body ?? {}

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'email e senha são obrigatórios.'
      })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const user = await User.findOne({ email: normalizedEmail })

    if (!user || user.password !== String(password)) {
      return res.status(401).json({
        success: false,
        message: 'Credenciais inválidas.'
      })
    }

    return res.status(200).json({
      success: true,
      message: 'Login realizado com sucesso.',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao processar login.'
    })
  }
}
