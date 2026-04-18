import express from 'express'
import authRoutes from './authRoutes.js'
import caseRoutes from './caseRoutes.js'
import chatRoutes from './chatRoutes.js'
import {
  analisarContratoSelecionado,
  listarContratosEmAndamento,
} from '../controllers/analiseController.js'
import { postChatMessage } from '../controllers/chatController.js'
import {
  getDashboardAnalytics,
  getCaseComparisons,
  getLawyerPerformance,
} from '../controllers/dashboardController.js'

const router = express.Router()

router.use('/auth', authRoutes)
router.use('/', authRoutes)
router.use('/cases', caseRoutes)
router.use('/chat', chatRoutes)
router.get('/analise/contratos-em-andamento', listarContratosEmAndamento)
router.post('/analise/analisar-contrato', analisarContratoSelecionado)
router.post('/chat', postChatMessage)

// Admin Dashboard Routes
router.get('/admin/dashboard/analytics', getDashboardAnalytics)
router.get('/admin/dashboard/comparisons', getCaseComparisons)
router.get('/admin/dashboard/lawyer-performance', getLawyerPerformance)

export default router
