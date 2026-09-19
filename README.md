# PDF QuickReplace 📄✨

A 100% free, private, browser-based PDF text editor and replacer. 

## Features
- **Zero Server Costs ($0/month)**: Runs entirely client-side using `pdf-lib` and `pdfjs-dist`.
- **Complete Privacy**: PDF files never leave the user's computer.
- **Multiple Find & Replace Rules**: Replace multiple words, names, dates, or prices simultaneously.
- **Visual PDF Preview**: Live canvas preview with page navigation, zoom, and highlighted match bounding boxes.
- **One-Click Instant Download**: Automatically packages and downloads the modified PDF directly into the user's browser.
- **Built-in Demo Invoice**: One-click demo test with pre-configured sample invoice and replacement rules.

---

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

3. **Build for production**:
   ```bash
   npm run build
   ```

---

## 100% Free Hosting & Deployment

Because this app is pure client-side static HTML/JS/CSS, you can host it anywhere for **$0 forever**:

### 1. Deploy on Vercel (Easiest)
1. Push this project to GitHub.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Select your GitHub repository. Vercel automatically detects Vite.
4. Click **Deploy**. Your site is live on a free `.vercel.app` URL with free HTTPS.

### 2. Deploy on GitHub Pages
1. Push your code to a GitHub repository.
2. In your repository, go to **Settings** > **Pages**.
3. Under **Build and deployment**, choose **GitHub Actions** and select the standard **Static HTML** or **Vite** template.
4. Your site will be published at `https://<your-username>.github.io/<repo-name>/`.

### 3. Deploy on Netlify
1. Run `npm run build`.
2. Go to [app.netlify.com/drop](https://app.netlify.com/drop) and drag-and-drop the `dist` folder.
3. Your site is online instantly with free SSL.
