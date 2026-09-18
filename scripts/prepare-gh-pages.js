import fs from 'fs';
import path from 'path';

const distDir = path.resolve('dist');
const docsDir = path.resolve('docs');

function copyFolderSync(from, to) {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(to, { recursive: true });
  }
  const entries = fs.readdirSync(from, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(from, entry.name);
    const destPath = path.join(to, entry.name);
    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  if (fs.existsSync(distDir)) {
    // 1. Create 404.html from index.html in dist
    const indexPath = path.join(distDir, 'index.html');
    const notFoundPath = path.join(distDir, '404.html');
    if (fs.existsSync(indexPath)) {
      fs.copyFileSync(indexPath, notFoundPath);
      console.log('✓ Created dist/404.html for GitHub Pages SPA routing');
    }

    // 2. Create .nojekyll in dist
    const nojekyllPath = path.join(distDir, '.nojekyll');
    fs.writeFileSync(nojekyllPath, '');
    console.log('✓ Created dist/.nojekyll to prevent Jekyll asset filtering');

    // 3. Sync to docs directory for "Deploy from branch (/docs)" support
    copyFolderSync(distDir, docsDir);
    console.log('✓ Synced compiled build to docs/ folder for branch deployment');
  } else {
    console.warn('dist/ directory not found to prepare for GitHub Pages.');
  }
} catch (err) {
  console.error('Error preparing GitHub Pages build:', err);
  process.exit(1);
}
