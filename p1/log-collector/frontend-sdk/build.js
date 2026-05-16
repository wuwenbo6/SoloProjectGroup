const fs = require('fs');
const path = require('path');
const uglify = require('uglify-js');

const files = [
  'src/core/storage.js',
  'src/core/collector.js',
  'src/core/reporter.js',
  'src/index.js'
];

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

let content = '';
files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    content += fs.readFileSync(filePath, 'utf8') + '\n';
  }
});

fs.writeFileSync(path.join(distDir, 'log-sdk.js'), content, 'utf8');

const result = uglify.minify(content, {
  compress: {
    drop_console: false
  },
  output: {
    comments: false
  }
});

if (!result.error) {
  fs.writeFileSync(path.join(distDir, 'log-sdk.min.js'), result.code, 'utf8');
}

const dtsPath = path.join(__dirname, 'log-sdk.d.ts');
if (fs.existsSync(dtsPath)) {
  fs.copyFileSync(dtsPath, path.join(distDir, 'log-sdk.d.ts'));
}

console.log('Build completed!');
console.log('Output:', distDir);
