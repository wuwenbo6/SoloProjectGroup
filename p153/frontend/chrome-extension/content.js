const UYGHUR_PATTERN = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\u00A0]/;
const API_BASE_URL = 'http://localhost:8000';

let isExtensionEnabled = true;
let highlightColor = '#fff3cd';
let bubbleTimeout = null;

chrome.storage.sync.get(['enabled', 'highlightColor'], (result) => {
  isExtensionEnabled = result.enabled !== false;
  highlightColor = result.highlightColor || '#fff3cd';
  if (isExtensionEnabled) {
    processPage();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleExtension') {
    isExtensionEnabled = request.enabled;
    if (isExtensionEnabled) {
      processPage();
    } else {
      removeHighlights();
    }
  } else if (request.action === 'translate') {
    translateText(request.text).then(result => sendResponse(result));
    return true;
  }
});

function detectUyghurText(text) {
  if (!text || text.trim().length < 2) return false;
  const uyghurCount = (text.match(UYGHUR_PATTERN) || []).length;
  return uyghurCount / text.length > 0.3;
}

function createBubble(element, originalText, translatedText) {
  removeBubble();
  
  const bubble = document.createElement('div');
  bubble.id = 'translation-bubble';
  bubble.className = 'translation-bubble';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'bubble-close';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    removeBubble();
  };
  
  const header = document.createElement('div');
  header.className = 'bubble-header';
  
  const originalDiv = document.createElement('div');
  originalDiv.className = 'original-text';
  originalDiv.textContent = originalText;
  
  const arrow = document.createElement('div');
  arrow.className = 'bubble-arrow';
  arrow.textContent = '→';
  
  const translatedDiv = document.createElement('div');
  translatedDiv.className = 'translated-text';
  translatedDiv.textContent = translatedText;
  
  header.appendChild(originalDiv);
  header.appendChild(arrow);
  header.appendChild(translatedDiv);
  
  const feedbackDiv = document.createElement('div');
  feedbackDiv.className = 'feedback-section';
  
  const ratingLabel = document.createElement('span');
  ratingLabel.textContent = '翻译质量：';
  
  const ratingDiv = document.createElement('div');
  ratingDiv.className = 'rating-stars';
  
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('span');
    star.className = 'star';
    star.textContent = '★';
    star.dataset.rating = i;
    star.onclick = () => submitFeedback(originalText, translatedText, i);
    ratingDiv.appendChild(star);
  }
  
  feedbackDiv.appendChild(ratingLabel);
  feedbackDiv.appendChild(ratingDiv);
  
  bubble.appendChild(closeBtn);
  bubble.appendChild(header);
  bubble.appendChild(feedbackDiv);
  
  document.body.appendChild(bubble);
  
  const rect = element.getBoundingClientRect();
  
  let top = rect.bottom + 8;
  let left = rect.left;
  
  requestAnimationFrame(() => {
    const bubbleRect = bubble.getBoundingClientRect();
    
    if (left + bubbleRect.width > window.innerWidth) {
      left = Math.max(10, window.innerWidth - bubbleRect.width - 10);
    }
    
    if (top + bubbleRect.height > window.innerHeight) {
      top = Math.max(10, rect.top - bubbleRect.height - 8);
    }
    
    if (top < 10) top = 10;
    if (left < 10) left = 10;
    
    bubble.style.top = `${top}px`;
    bubble.style.left = `${left}px`;
  });
  
  bubble.addEventListener('mouseenter', () => {
    if (bubbleTimeout) {
      clearTimeout(bubbleTimeout);
      bubbleTimeout = null;
    }
  });
  
  bubble.addEventListener('mouseleave', () => {
    bubbleTimeout = setTimeout(removeBubble, 500);
  });
}

function removeBubble() {
  const bubble = document.getElementById('translation-bubble');
  if (bubble) {
    bubble.remove();
  }
}

function submitFeedback(originalText, translatedText, rating) {
  fetch(`${API_BASE_URL}/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      original_text: originalText,
      translated_text: translatedText,
      rating: rating,
      source_type: 'chrome_extension'
    })
  }).catch(err => console.error('Feedback submission failed:', err));
  
  const stars = document.querySelectorAll('.rating-stars .star');
  stars.forEach((star, index) => {
    star.classList.toggle('active', index < rating);
  });
}

async function translateText(text) {
  try {
    const response = await fetch(`${API_BASE_URL}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: text,
        source_lang: 'ug',
        target_lang: 'zh'
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.error('Translation error:', error);
  }
  
  return { translated_text: `[翻译服务不可用] ${text}` };
}

function highlightElement(element) {
  const wrapper = document.createElement('span');
  wrapper.className = 'ug-highlight';
  wrapper.style.setProperty('background-color', highlightColor, 'important');
  
  const originalText = element.textContent.trim();
  wrapper.dataset.originalText = originalText;
  
  const clone = element.cloneNode(true);
  wrapper.appendChild(clone);
  
  wrapper.addEventListener('mouseenter', async () => {
    wrapper.style.setProperty('background-color', '#ffeb3b', 'important');
  });
  
  wrapper.addEventListener('mouseleave', () => {
    wrapper.style.setProperty('background-color', highlightColor, 'important');
    bubbleTimeout = setTimeout(removeBubble, 500);
  });
  
  wrapper.addEventListener('click', async () => {
    const result = await translateText(originalText);
    createBubble(wrapper, originalText, result.translated_text);
  });
  
  element.parentNode.replaceChild(wrapper, element);
  return wrapper;
}

function removeHighlights() {
  document.querySelectorAll('.ug-highlight').forEach(highlight => {
    const parent = highlight.parentNode;
    while (highlight.firstChild) {
      parent.insertBefore(highlight.firstChild, highlight);
    }
    parent.removeChild(highlight);
  });
  removeBubble();
}

function processTextNodes(node) {
  const textNodes = [];
  const walker = document.createTreeWalker(
    node,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );
  
  let currentNode;
  while (currentNode = walker.nextNode()) {
    textNodes.push(currentNode);
  }
  
  textNodes.forEach(textNode => {
    const text = textNode.textContent;
    if (detectUyghurText(text) && text.trim().length > 0) {
      const parent = textNode.parentNode;
      if (parent && !parent.closest('.ug-highlight') && 
          !parent.closest('#translation-bubble') &&
          parent.tagName !== 'SCRIPT' && 
          parent.tagName !== 'STYLE') {
        
        const span = document.createElement('span');
        span.textContent = text;
        parent.replaceChild(span, textNode);
        highlightElement(span);
      }
    }
  });
}

function processPage() {
  processTextNodes(document.body);
  
  const observer = new MutationObserver((mutations) => {
    if (!isExtensionEnabled) return;
    
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          processTextNodes(node);
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

document.addEventListener('mouseup', () => {
  if (!isExtensionEnabled) return;
  
  const selection = window.getSelection();
  const text = selection.toString().trim();
  
  if (detectUyghurText(text) && text.length > 1) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    const tempElement = {
      getBoundingClientRect: () => rect,
      textContent: text
    };
    
    (async () => {
      const result = await translateText(text);
      createBubble({
        getBoundingClientRect: () => rect
      }, text, result.translated_text);
    })();
  }
});
