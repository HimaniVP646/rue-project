// ─────────────────────────────────────────────────────────────
// RUE — Recursive Understanding Engine
// ─────────────────────────────────────────────────────────────

const state = {
  exploredConcepts: new Set(), // Track all explored concept paths
};

let currentConcept = "Machine Learning";

// ─── On page load ───
window.addEventListener('DOMContentLoaded', () => {
  checkApiStatus();

  // Allow pressing Enter in the input
  document.getElementById('question-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAsk();
  });
});

// ─── Check if real AI is active ───
async function checkApiStatus() {
  try {
    const res = await fetch('/api-status');
    const data = await res.json();
    const badge = document.getElementById('api-badge');
    if (data.ai_enabled) {
      badge.textContent = '● LIVE AI';
      badge.className = 'api-badge live';
    }
  } catch (_) {}
}

// ─── Example pills ───
function setExample(text) {
  const input = document.getElementById('question-input');
  input.value = text;
  input.focus();
}

// ─────────────────────────────────────────────────────────────
// STEP 1: Handle the main question
// ─────────────────────────────────────────────────────────────
async function handleAsk() {
  const input = document.getElementById('question-input');
  const question = input.value.trim();
  if (!question) return;

  // Reset state for new question
  state.exploredConcepts.clear();

  // UI transitions
  setLoading(true);
  hideEmptyState();
  clearExploration();

  try {
    const data = await postJSON('/ask', { question });
    renderRootNode(question, data.answer, data.concepts);
  } catch (err) {
    showError('Could not get an answer. Please check the server is running.');
    console.error(err);
  } finally {
    setLoading(false);
  }
}

// ─────────────────────────────────────────────────────────────
// STEP 2: Handle a concept click
// ─────────────────────────────────────────────────────────────
async function handleConceptClick(concept, contextText, btn, childrenContainer, depth, breadcrumbPath) {
  currentConcept = concept;
  const conceptKey = breadcrumbPath.join('→') + '→' + concept;
  if (state.exploredConcepts.has(conceptKey)) return;
  state.exploredConcepts.add(conceptKey);

  // Mark button as explored
  btn.classList.add('explored');
  btn.disabled = true;

  // Show a small inline loader
  const loader = createInlineLoader();
  childrenContainer.appendChild(loader);

  try {
    const data = await postJSON('/explain', { concept, context: concept });
    loader.remove();
    renderChildNode(concept, data.explanation, data.sub_concepts, childrenContainer, depth, breadcrumbPath);

    // Scroll to the new node smoothly
    setTimeout(() => {
      childrenContainer.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  } catch (err) {
    loader.remove();
    console.error(err);
  }
}

// ─────────────────────────────────────────────────────────────
// RENDER: Root node (the first answer)
// ─────────────────────────────────────────────────────────────
function renderRootNode(question, answer, concepts) {
  addToHistory(question);
  currentConcept = question;
  const root = document.getElementById('exploration-root');
  const node = buildNodeCard({
    depth: 0,
    label: 'YOUR QUESTION',
    title: question,
    answer,
    concepts,
    breadcrumbPath: [question],
  });
  root.appendChild(node);
}

// ─────────────────────────────────────────────────────────────
// RENDER: Child node (a concept explanation)
// ─────────────────────────────────────────────────────────────
function renderChildNode(concept, explanation, subConcepts, container, depth, breadcrumbPath) {
  const newPath = [...breadcrumbPath, concept];
  const node = buildNodeCard({
    depth,
    label: `DEPTH ${depth}`,
    title: concept,
    answer: explanation,
    concepts: subConcepts,
    breadcrumbPath: newPath,
    parentPath: breadcrumbPath,
  });
  node.classList.add('child');
  container.appendChild(node);
}

// ─────────────────────────────────────────────────────────────
// BUILD: Node card DOM element
// ─────────────────────────────────────────────────────────────
function buildNodeCard({ depth, label, title, answer, concepts, breadcrumbPath, parentPath }) {
  const node = el('div', `exploration-node depth-${Math.min(depth, 4)}`);

  // ── Card shell ──
  const card = el('div', 'node-card');
  node.appendChild(card);

  // ── Breadcrumb (for child nodes) ──
  if (parentPath && parentPath.length > 0) {
    const breadcrumb = el('div', 'breadcrumb');
    parentPath.forEach((crumb, i) => {
      const item = el('span', 'breadcrumb-item');
      item.textContent = truncate(crumb, 30);
      breadcrumb.appendChild(item);
      if (i < parentPath.length - 1) {
        const sep = el('span', 'breadcrumb-sep');
        sep.textContent = '›';
        breadcrumb.appendChild(sep);
      }
    });
    const currentItem = el('span', 'breadcrumb-item current');
    currentItem.textContent = title;
    const finalSep = el('span', 'breadcrumb-sep');
    finalSep.textContent = '›';
    breadcrumb.appendChild(finalSep);
    breadcrumb.appendChild(currentItem);
    card.appendChild(breadcrumb);
  }

  // ── Header: depth badge + label ──
  const header = el('div', 'node-header');
  const labelWrap = el('div', 'node-label');
  const depthBadge = el('span', 'node-depth-badge');
  depthBadge.textContent = label;
  const titleSpan = el('span', 'node-title');
  titleSpan.textContent = depth === 0 ? 'INITIAL ANSWER' : 'CONCEPT EXPLANATION';
  labelWrap.appendChild(depthBadge);
  labelWrap.appendChild(titleSpan);
  header.appendChild(labelWrap);
  card.appendChild(header);

  // ── Concept/question title ──
  const conceptName = el('div', 'node-concept-name');
  conceptName.textContent = title;
  card.appendChild(conceptName);

  // ── Answer/explanation text ──
  const answerDiv = el('div', 'node-answer');
answerDiv.innerHTML = highlightConcepts(answer, concepts || []);
card.appendChild(answerDiv);

// Copy button
const copyBtn = el('button', 'copy-btn');
copyBtn.textContent = '📋 Copy';
copyBtn.onclick = () => {
  navigator.clipboard.writeText(answer);
  copyBtn.textContent = '✅ Copied!';
  setTimeout(() => copyBtn.textContent = '📋 Copy', 2000);
};
card.appendChild(copyBtn);

// Also highlight concepts in child explanations
if (depth > 0) {
  answerDiv.innerHTML = highlightConcepts(answer, concepts || []);
}

  // ── Concepts section ──
  if (concepts && concepts.length > 0) {
    const conceptsSection = el('div', 'concepts-section');
    const conceptsLabel = el('div', 'concepts-label');
    conceptsLabel.textContent = `◈ Click to explore (${concepts.length} concepts found)`;
    conceptsSection.appendChild(conceptsLabel);

    const grid = el('div', 'concepts-grid');
    const childrenContainer = el('div', 'node-children');

    concepts.forEach((concept) => {
      const btn = el('button', 'concept-btn');
      btn.textContent = concept;
      btn.title = `Explore: ${concept}`;
      btn.addEventListener('click', () => {
        handleConceptClick(concept, answer, btn, childrenContainer, depth + 1, breadcrumbPath);
      });
      grid.appendChild(btn);
    });

    conceptsSection.appendChild(grid);
    card.appendChild(conceptsSection);
    node.appendChild(childrenContainer);
  } else {
    // Terminal node — no more concepts
    const conceptsSection = el('div', 'concepts-section');
    const conceptsLabel = el('div', 'concepts-label');
    conceptsLabel.textContent = '✓ No further concepts to explore — you have reached full clarity at this level.';
    conceptsSection.appendChild(conceptsLabel);
    card.appendChild(conceptsSection);
  }

  return node;
}

// ─────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────
function el(tag, className = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  return element;
}

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function createInlineLoader() {
  const wrap = el('div', 'loading');
  wrap.style.padding = '24px';
  wrap.style.justifyContent = 'flex-start';
  const spinner = el('div', 'spinner');
  const text = el('span');
  text.textContent = 'Explaining concept...';
  wrap.appendChild(spinner);
  wrap.appendChild(text);
  return wrap;
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function setLoading(active) {
  const loader = document.getElementById('loading');
  const btn = document.getElementById('ask-btn');
  if (active) {
    loader.classList.remove('hidden');
    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Thinking...';
  } else {
    loader.classList.add('hidden');
    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'Explore';
  }
}

function hideEmptyState() {
  document.getElementById('empty-state').classList.add('hidden');
}

function clearExploration() {
  document.getElementById('exploration-root').innerHTML = '';
}

function showError(message) {
  const root = document.getElementById('exploration-root');
  root.innerHTML = `
    <div style="padding:40px;text-align:center;color:#ff6c9d;font-family:var(--font-mono);font-size:13px;border:1px solid rgba(255,108,157,0.2);border-radius:12px;background:rgba(255,108,157,0.05);">
      ⚠ ${message}
    </div>`;
}

// Multi-explanation panel
function loadExplanation(concept, type){
  document.getElementById("loading").style.display = "block";
  fetch("/multi_explain", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ concept, type })
  })
  .then(res => res.json())
  .then(data => {
    document.getElementById("explanation-test").innerText = data.result;
    document.getElementById("loading").style.display = "none";
  });
}

function selectExplain(btn){
  document.querySelectorAll(".multi-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}
function newChat() {
  // Smooth scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Clear input
  const input = document.getElementById('question-input');
  input.value = '';
  input.focus();

  // Clear exploration tree with fade out
  const root = document.getElementById('exploration-root');
  if (root.children.length > 0) {
    root.style.transition = 'opacity 0.3s';
    root.style.opacity = 0;
    setTimeout(() => {
      clearExploration();
      root.style.opacity = 1;
    }, 300);
  }

  // Reset multi-explanation box
  const multiOutput = document.getElementById('explanation-test');
  multiOutput.innerText = 'Explanation will appear here ✨';

  // Reset explored concepts
  state.exploredConcepts.clear();

  // Hide loading if visible
  document.getElementById('loading').classList.add('hidden');

  // Show empty state again with fade
  const emptyState = document.getElementById('empty-state');
  emptyState.style.opacity = 0;
  emptyState.classList.remove('hidden');
  setTimeout(() => {
    emptyState.style.transition = 'opacity 0.3s';
    emptyState.style.opacity = 1;
  }, 50);

  // Remove active state from multi buttons
  document.querySelectorAll(".multi-btn").forEach(b => b.classList.remove("active"));
}
// Enable pulse animation on New Chat button
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('new-chat-btn');
  if (btn) {
    btn.classList.add('pulse'); // add pulse class defined in CSS
  }
});
// ─── HISTORY ───
const history = [];

function addToHistory(question) {
  const item = {
    question,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    id: Date.now()
  };
  history.unshift(item);
  renderHistory();
}

function renderHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  if (history.length === 0) {
    list.innerHTML = '<div style="padding:16px;color:var(--text-dim);font-size:12px;font-family:var(--font-mono);text-align:center;">No history yet</div>';
    return;
  }
  history.forEach((item, i) => {
    const div = document.createElement('div');
    div.className = 'history-item' + (i === 0 ? ' active' : '');
    div.innerHTML = `
      <div class="history-question">${item.question}</div>
      <div class="history-time">${item.time}</div>
    `;
    div.onclick = () => {
      document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
      div.classList.add('active');
      document.getElementById('question-input').value = item.question;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    list.appendChild(div);
  });
}

function clearHistory() {
  history.length = 0;
  renderHistory();
}

// Initialize empty history
renderHistory();
function highlightConcepts(text, concepts) {
  let result = text;
  concepts.forEach(concept => {
    // Match the concept and also partial word matches
    const escaped = concept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    result = result.replace(regex, `<span class="highlight-word" data-concept="${concept}">$1</span>`);
  });
  return result;
}