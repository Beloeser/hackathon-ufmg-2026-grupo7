Link do video: https://drive.google.com/file/d/1N-l2bs1C6wZfjSH_cwqiBETqSDF5xFXr/view?usp=sharing
Link dos slides: https://canva.link/na8jfyo5bun4lqu

## Como rodar em uma maquina nova (do zero)

### 1) Pre-requisitos
- `Git`
- `Node.js` (recomendado: versao 18+)
- `npm`
- `Python` (opcional, mas recomendado para recursos de analise ML)

### 2) Clonar o repositorio
```bash
git clone <URL_DO_REPOSITORIO>
cd CoffeeBreakers
```

### 3) Backend
```bash
cd backend
npm install
```

Crie o arquivo `backend/.env` com, no minimo:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=<SUA_STRING_DO_MONGODB>
OPEN_AI_KEY=<SUA_CHAVE_DA_OPENAI>
```

Opcional: popular banco com dados de exemplo
```bash
npm run seed
```

Iniciar backend:
```bash
npm run dev
```

### 4) Frontend (em outro terminal)
```bash
cd frontend
npm install
npm run dev
```

### 5) Acessar aplicacao
- Frontend: `http://localhost:5173`
- Backend healthcheck: `http://localhost:3000/health`

