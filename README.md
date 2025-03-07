# React Graph

A tool to explore GitHub repositories with interactive React Flow diagrams and AI-powered Q&A.

## Features

- **Visualize** repository architecture using **React Flow**
- **Index** codebases and **query** them with natural language via AI chat
- **Seamless GitHub integration** for authenticated repository access

## Prerequisites

- **Node.js** (>=18.x)
- **npm** (>=9.x)
- **GitHub account** for authentication
- **API keys** for Google Generative AI and Hugging Face (see Setup)

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/akshatgoel07/react-graph/
cd react-graph
```

### 2. Install dependencies (in root folder)

```bash
pnpm install
```

### 3. Set environment variables

#### Backend
Create `backend/.env` and add:

```ini
GEMINI_API_KEY=your_google_gemini_key
HF_API_KEY=your_hugging_face_key
PORT=3001
```

#### Frontend
Create `frontend/.env.local` and add:

```ini

NEXT_PUBLIC_GITHUB_CLIENT_ID=your_github_client_id
NEXT_PUBLIC_GITHUB_ID=your_github_id
NEXT_PUBLIC_GITHUB_SECRET=your_github_secret
NEXT_PUBLIC_NEXTAUTH_URL=http://localhost:3000
```

### 4. Run the development servers

```bash
pnpm dev
```

- **Backend:** http://localhost:3001
- **Frontend:** http://localhost:3000

## Usage

1. Open **[http://localhost:3000](http://localhost:3000)** in your browser.
2. Sign in with **GitHub**.
3. Select a repository from your list.
4. Click **"Index Now"** to process the codebase.
5. Explore the **React Flow diagram** and ask questions in the chat (e.g., "How does routing work?").

## Project Structure

```
react-graph/
│── backend/              # Node.js/Express server
│   ├── server.js        # Main API server
│   ├── rag-service.js   # Retrieval-Augmented Generation logic
│
│── frontend/             # Next.js/React application
│   ├── pages/           # Routing and main entry (index.jsx)
│   ├── components/      # Reusable UI components
│   ├── utils/           # API helpers
```

## Contributing

1. **Fork** the repository.
2. **Create a branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Commit changes**:
   ```bash
   git commit -m "Add your feature"
   ```
4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```
5. **Open a Pull Request**.
6. **Report bugs** or **suggest features** in the **Issues** tab.
7. Keep code **modular** and follow existing patterns.

---

🚀 Happy Coding!
