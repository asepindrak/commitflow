# 🤝 Contributing to CommitFlow

Thank you for your interest in contributing to **CommitFlow** — an open-source AI-powered GitHub Insight & Project Management tool.  
We welcome all contributions, from small documentation fixes to major feature implementations.

---

## 🧭 Getting Started

1. **Fork** this repository and clone it locally:

   ```bash
   git clone https://github.com/asepindrak/commitflow.git
   cd commitflow
   ```

2. Create a new branch for your changes:

   ```bash
   git checkout -b feat/your-feature-name
   ```

3. Make your changes and ensure everything works:

   ```bash
   npm run lint
   npm run test
   ```

4. Commit your changes using Conventional Commits:

   ```bash
   feat: add new AI insight generator
   fix: resolve API token validation issue
   chore: update Docker build script
   ```

5. Push your branch and open a Pull Request (PR):
   ```bash
   git push origin feat/your-feature-name
   ```

---

## 🧱 Development Setup ✨

To run the project locally using Docker:

    ```bash
    ./scripts/build.dev.sh
    ```

Access the services:

- Frontend: http://localhost:3000

- Backend: http://localhost:8000

- pgAdmin: http://localhost:8080

If you’re running it for the first time, migrate the database:
`bash
    docker exec -it commitflow-api npx prisma db push
    `

---

## 🧠 Commit Message Convention ✨

We follow Conventional Commits:
| Type | Description |
| ----------- | ----------------------------------------------------- |
| `feat:` | A new feature |
| `fix:` | A bug fix |
| `docs:` | Documentation only changes |
| `style:` | Code style (formatting, etc.) |
| `refactor:` | Code changes that neither fix a bug nor add a feature |
| `perf:` | Performance improvements |
| `test:` | Adding or fixing tests |
| `chore:` | Maintenance or build tasks |

Example:
`bash
    feat: integrate GitHub API for contribution tracking
    `

## 🧪 Running Tests ✨

If tests are available, you can run them with:

    ```bash
    npm test
    ```

---

## 🧾 Submitting Issues ✨

When reporting a bug or suggesting a feature:

- Check if an issue already exists.
- Include steps to reproduce, expected behavior, and screenshots (if applicable).
- Use a clear and descriptive title.

## ❤️ Code of Conduct ✨

By contributing, you agree to follow our Code of Conduct

## 🌟 Thank You!

Your contributions make CommitFlow better for everyone.
We appreciate your time, effort, and ideas 💫.
