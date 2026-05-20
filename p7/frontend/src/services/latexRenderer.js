import katex from 'katex';

let renderCache = new Map();
const MAX_CACHE_SIZE = 100;

export const renderToSvg = (latex, options = {}) => {
  try {
    const html = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
      strict: false,
      trust: true,
      output: 'html',
      ...options,
    });

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const mathElement = tempDiv.querySelector('.katex');
    if (!mathElement) return null;

    const svgContent = generateSvgFromDom(mathElement);
    return svgContent;
  } catch (error) {
    console.error('SVG render error:', error);
    return null;
  }
};

const generateSvgFromDom = (element) => {
  const rect = element.getBoundingClientRect();
  const width = Math.ceil(rect.width * 2) + 20;
  const height = Math.ceil(rect.height * 2) + 20;

  const serializer = new XMLSerializer();
  const clonedElement = element.cloneNode(true);
  
  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" 
         width="${width}" 
         height="${height}" 
         viewBox="0 0 ${width} ${height}"
         style="background: white;">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" 
             style="transform: scale(2); transform-origin: top left; padding: 10px;">
          ${serializer.serializeToString(clonedElement)}
        </div>
      </foreignObject>
    </svg>
  `.trim();

  return svgString;
};

export const downloadSvg = (latex, filename = 'formula.svg') => {
  const svg = renderToSvg(latex);
  if (!svg) return false;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
};

export const downloadPng = (latex, filename = 'formula.png', scale = 3) => {
  return new Promise((resolve, reject) => {
    try {
      const html = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: true,
        strict: false,
        trust: true,
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.fontSize = `${20 * scale}px`;
      document.body.appendChild(tempDiv);

      const katexElem = tempDiv.querySelector('.katex');
      const rect = katexElem.getBoundingClientRect();
      
      canvas.width = rect.width + 40;
      canvas.height = rect.height + 40;

      const svgString = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml" style="padding: 20px; background: white;">
              ${html}
            </div>
          </foreignObject>
        </svg>
      `;

      const img = new Image();
      img.onload = () => {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        
        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          document.body.removeChild(tempDiv);
          resolve(true);
        }, 'image/png');
      };
      img.onerror = () => {
        document.body.removeChild(tempDiv);
        reject(new Error('Image load failed'));
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
    } catch (error) {
      console.error('PNG export error:', error);
      reject(error);
    }
  });
};

export const clearRenderCache = () => {
  renderCache.clear();
};

const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/\n/g, '<br/>');
};

export const renderLatex = (latex, options = {}) => {
  const cacheKey = `${latex}-${JSON.stringify(options)}`;
  
  if (renderCache.has(cacheKey)) {
    return renderCache.get(cacheKey);
  }

  try {
    const result = katex.renderToString(latex, {
      throwOnError: false,
      displayMode: true,
      strict: false,
      trust: true,
      ...options,
    });
    
    if (renderCache.size >= MAX_CACHE_SIZE) {
      const firstKey = renderCache.keys().next().value;
      renderCache.delete(firstKey);
    }
    renderCache.set(cacheKey, result);
    
    return result;
  } catch (error) {
    return `<span class="katex-error">${escapeHtml(error.message)}</span>`;
  }
};

export const extractLatexBlocks = (content) => {
  const blocks = [];
  const regex = /\$\$([\s\S]*?)\$\$|\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const latex = match[1] || match[2] || match[3] || '';
    blocks.push({
      start: match.index,
      end: match.index + match[0].length,
      latex: latex.trim(),
      raw: match[0],
      displayMode: !match[3],
    });
  }

  return blocks;
};

let debounceTimer = null;
let lastRenderedContent = '';

export const renderContentWithLatex = (content, force = false) => {
  if (!force && content === lastRenderedContent && renderCache.size > 0) {
    return null;
  }
  
  const blocks = extractLatexBlocks(content);
  let html = '';
  let lastIndex = 0;

  blocks.forEach((block) => {
    html += escapeHtml(content.slice(lastIndex, block.start));
    html += `<div class="latex-block" data-start="${block.start}" data-end="${block.end}">`;
    html += renderLatex(block.latex, { displayMode: block.displayMode });
    html += '</div>';
    lastIndex = block.end;
  });

  html += escapeHtml(content.slice(lastIndex));
  lastRenderedContent = content;
  
  return html;
};

export const debouncedRender = (content, callback, delay = 300) => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  debounceTimer = setTimeout(() => {
    const html = renderContentWithLatex(content);
    if (html !== null && callback) {
      callback(html);
    }
  }, delay);
};

export const cancelDebouncedRender = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
};

export const validateLatexBlocks = (content) => {
  const blocks = extractLatexBlocks(content);
  const errors = [];

  blocks.forEach((block) => {
    try {
      katex.renderToString(block.latex, {
        throwOnError: true,
        strict: true
      });
    } catch (error) {
      const errorStart = block.start + (error.position || 0);
      errors.push({
        start: block.start,
        end: block.end,
        errorStart: errorStart,
        message: error.message,
        latex: block.latex,
        raw: block.raw
      });
    }
  });

  return errors;
};
