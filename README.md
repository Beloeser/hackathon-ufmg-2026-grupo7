# CoffeeBreakers

Plataforma com frontend React + Vite e backend Express com integração Python ML.

## Estrutura do Projeto

```
CoffeeBreakers/
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── components/      # Componentes reutilizáveis
│   │   ├── pages/           # Páginas da aplicação
│   │   ├── layouts/         # Layouts
│   │   ├── styles/          # Estilos modularizados
│   │   ├── hooks/           # Custom hooks
│   │   ├── services/        # Serviços de API
│   │   ├── utils/           # Utilitários
│   │   └── assets/          # Imagens e ícones
│   ├── public/              # Arquivos estáticos
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
│
└── backend/                 # Express + Python ML
    ├── src/
    │   ├── controllers/     # Lógica de negócio
    │   ├── models/          # Modelos de dados
    │   ├── routes/          # Definição de rotas
    │   ├── middleware/      # Middlewares
    │   ├── utils/           # Utilitários
    │   └── server.js        # Servidor principal
    ├── ml/                  # Scripts Python ML
    ├── scripts/             # Scripts auxiliares
    ├── package.json
    ├── requirements.txt
    └── .env.example
```

## Instalação

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
pip install -r requirements.txt
npm run dev
```

## Desenvolvimento

- Frontend roda em `http://localhost:5173`
- Backend roda em `http://localhost:3000`
- Proxy configurado para `/api` → `http://localhost:3000`
