# Deploy Blackjack to GitHub Pages

This project is configured for `https://imniveth.github.io/blackjack/`.

## Steps

1. Extract this ZIP on your computer.
2. In the `ImNiveth/blackjack` GitHub repository, upload/commit the **contents** of the extracted folder (including the `.github` folder), not the ZIP file itself. Replace the existing `index.html` with this project's `index.html` and make sure `src/`, `package.json`, and `package-lock.json` are in the repository root.
3. Open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
4. Commit/push the files to the `main` branch.
5. Open **Actions** and wait for **Deploy to GitHub Pages** to finish successfully.
6. Visit `https://imniveth.github.io/blackjack/`.

The workflow installs dependencies, runs `npm run build`, and deploys the generated `dist/` folder. Do not manually publish the raw `src/` folder.
