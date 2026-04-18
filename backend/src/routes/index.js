import express from 'express'
import authRoutes from './authRoutes.js'
import {
  analisarContratoSelecionado,
  listarContratosEmAndamento,
} from '../controllers/analiseController.js'
import {
  getDashboardAnalytics,
  getCaseComparisons,
  getLawyerPerformance,
} from '../controllers/dashboardController.js'

const router = express.Router()

router.use('/', authRoutes)
router.get('/analise/contratos-em-andamento', listarContratosEmAndamento)
router.post('/analise/analisar-contrato', analisarContratoSelecionado)

// Admin Dashboard Routes
router.get('/admin/dashboard/analytics', getDashboardAnalytics)
router.get('/admin/dashboard/comparisons', getCaseComparisons)
router.get('/admin/dashboard/lawyer-performance', getLawyerPerformance)

export default router
