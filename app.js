/* ════════════════════════════════════════
   AI's Second Brain – app.js
   ════════════════════════════════════════ */

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL   = 'claude-opus-4-5';

// ── State ──────────────────────────────
let apiKey       = localStorage.getItem('sb_api_key') || '';
let notes        = JSON.parse(localStorage.getItem('sb_notes') || '[]');
let activeNoteId = null;
let flashcards   = [];
let fcIndex      = 0;
let quizData     = [];
let quizIndex    = 0;
let quizScore    = 0;
let chatHistory  = [];

// ── DOM refs ───────────────────────────
const $ = id => document.getElementById(id);

// ── Init ───────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (!apiKey) showApiModal();
  else         hideApiModal();

  setupSidebar();
  setupChat();
  setupNotes();
  setupFlashcards();
  setupQuiz();
  setupSummary();
  renderNotesList();

  $('saveKeyBtn').addEventListener('click', saveApiKey);
  $('apiKeyInput').addEventListener('keydown', e => { if (e.key === 'Enter') saveApiKey(); });
  $('clearBtn').addEventListener('click', clearCurrentTab);
});

// ── API Key ────────────────────────────
function saveApiKey() {
  const key = $('apiKeyInput').value.trim();
  if (!key.startsWith('sk-')) {
    alert('Please enter a valid Anthropic API key (starts with sk-)');
    return;
  }
  apiKey = key;
  localStorage.setItem('sb_api_key', key);
  hideApiModal();
}
function showApiModal() { $('apiModal').classList.remove('hidden'); }
function hideApiModal() { $('apiModal').classList.add('hidden'); }

// ── Claude API call ────────────────────
async function callClaude(messages, systemPrompt = '') {
  showLoading();
  try {
    const body = {
      model: MODEL,
      max_tokens: 1024,
      messages
    };
    if (systemPrompt) body.system = systemPrompt;

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401) { showApiModal(); throw new Error('Invalid API key'); }
      throw new Error(err.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data.content.map(b => b.text || '').join('');
  } finally {
    hideLoading();
  }
}

// ── Loading ────────────────────────────
function showLoading() { $('loadingOverlay').style.display = 'flex'; }
function hideLoading()  { $('loadingOverlay').style.display = 'none';  }

// ── Sidebar ────────────────────────────
function setupSidebar() {
  const sidebar  = $('sidebar');
  const main     = $('main');
  const ham      = $('hamburger');
  const close    = $('sidebarClose');

  ham.addEventListener('click', () => sidebar.classList.toggle('open'));
  close.addEventListener('click', () => sidebar.classList.remove('open'));

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (window.innerWidth <= 768) sidebar.classList.remove('open');
    });
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
  $(`tab-${tab}`).classList.add('active');
  const titles = { chat: 'Chat with AI', notes: 'Notes', flashcards: 'Flashcards', quiz: 'Quiz Me', summary: 'Summarize' };
  $('pageTitle').textContent = titles[tab] || tab;
}

function clearCurrentTab() {
  const active = document.querySelector('.tab-content.active')?.id;
  if (active === 'tab-chat') {
    chatHistory = [];
    $('chatMessages').innerHTML = '';
    appendAiMessage("Chat cleared. What are we studying?");
  } else if (active === 'tab-summary') {
    $('summaryInput').value = '';
    $('summaryOutput').innerHTML = '<p class="placeholder-text">Your summary will appear here…</p>';
    $('copySummaryBtn').style.display = 'none';
  }
}

// ══════════════════════════════════════
//  CHAT
// ══════════════════════════════════════
function setupChat() {
  const input   = $('chatInput');
  const sendBtn = $('sendBtn');

  sendBtn.addEventListener('click', sendChat);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
}

async function sendChat() {
  const input = $('chatInput');
  const text  = input.value.trim();
  if (!text) return;

  appendUserMessage(text);
  input.value = '';
  input.style.height = 'auto';
  chatHistory.push({ role: 'user', content: text });

  const system = `You are an expert AI Study Buddy called "Second Brain". 
You help students understand concepts, solve problems, and learn effectively.
Be clear, engaging, and use examples. Format math or code in plain text.
Keep answers focused and educational.`;

  try {
    const reply = await callClaude(chatHistory, system);
    appendAiMessage(reply);
    chatHistory.push({ role: 'assistant', content: reply });
  } catch (e) {
    appendAiMessage(`⚠️ Error: ${e.message}`);
  }
}

function appendUserMessage(text) {
  const msgs = $('chatMessages');
  msgs.innerHTML += `
    <div class="message user">
      <div class="message-avatar">👤</div>
      <div class="message-bubble">${escHtml(text)}</div>
    </div>`;
  msgs.scrollTop = msgs.scrollHeight;
}

function appendAiMessage(text) {
  const msgs = $('chatMessages');
  msgs.innerHTML += `
    <div class="message ai">
      <div class="message-avatar">🧠</div>
      <div class="message-bubble">${escHtml(text)}</div>
    </div>`;
  msgs.scrollTop = msgs.scrollHeight;
}

// ══════════════════════════════════════
//  NOTES
// ══════════════════════════════════════
function setupNotes() {
  $('notesNewBtn').addEventListener('click', newNote);
  $('noteSaveBtn').addEventListener('click', saveNote);
  $('noteDeleteBtn').addEventListener('click', deleteNote);
  $('notesSummarizeBtn').addEventListener('click', summarizeNote);
}

function newNote() {
  activeNoteId = Date.now().toString();
  $('noteTitleInput').value = '';
  $('noteBodyInput').value  = '';
  $('aiSummaryBox').style.display = 'none';
  renderNotesList();
}

function saveNote() {
  const title = $('noteTitleInput').value.trim() || 'Untitled';
  const body  = $('noteBodyInput').value.trim();
  if (!body) return;

  if (!activeNoteId) activeNoteId = Date.now().toString();

  const idx = notes.findIndex(n => n.id === activeNoteId);
  const note = { id: activeNoteId, title, body, updated: Date.now() };
  if (idx >= 0) notes[idx] = note; else notes.unshift(note);
  localStorage.setItem('sb_notes', JSON.stringify(notes));
  renderNotesList();
}

function deleteNote() {
  notes = notes.filter(n => n.id !== activeNoteId);
  localStorage.setItem('sb_notes', JSON.stringify(notes));
  activeNoteId = null;
  $('noteTitleInput').value = '';
  $('noteBodyInput').value  = '';
  $('aiSummaryBox').style.display = 'none';
  renderNotesList();
}

function renderNotesList() {
  const list = $('notesList');
  if (!notes.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--text-muted);padding:8px 12px">No notes yet</p>';
    return;
  }
  list.innerHTML = notes.map(n => `
    <div class="note-list-item ${n.id === activeNoteId ? 'active' : ''}"
         onclick="openNote('${n.id}')">${escHtml(n.title)}</div>
  `).join('');
}

function openNote(id) {
  const note = notes.find(n => n.id === id);
  if (!note) return;
  activeNoteId = id;
  $('noteTitleInput').value = note.title;
  $('noteBodyInput').value  = note.body;
  $('aiSummaryBox').style.display = 'none';
  renderNotesList();
}

async function summarizeNote() {
  const body = $('noteBodyInput').value.trim();
  if (!body) { alert('Write some notes first!'); return; }

  try {
    const reply = await callClaude([{
      role: 'user',
      content: `Summarize these study notes concisely in 3-5 bullet points:\n\n${body}`
    }]);
    $('aiSummaryText').textContent = reply;
    $('aiSummaryBox').style.display = 'block';
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

// ══════════════════════════════════════
//  FLASHCARDS
// ══════════════════════════════════════
function setupFlashcards() {
  $('generateFlashcardsBtn').addEventListener('click', generateFlashcards);
  $('prevCard').addEventListener('click', () => { fcIndex = (fcIndex - 1 + flashcards.length) % flashcards.length; showCard(); });
  $('nextCard').addEventListener('click', () => { fcIndex = (fcIndex + 1) % flashcards.length; showCard(); });
}

async function generateFlashcards() {
  const input = $('flashcardInput').value.trim();
  if (!input) return;

  const system = `You are a flashcard generator. Always respond with ONLY valid JSON — no markdown, no explanation.`;
  const prompt = `Create 6 flashcards about: "${input}"
Return ONLY a JSON array like:
[{"front":"Question or term","back":"Answer or definition"},...]`;

  try {
    const reply = await callClaude([{ role: 'user', content: prompt }], system);
    const clean = reply.replace(/```json|```/g, '').trim();
    flashcards = JSON.parse(clean);
    fcIndex = 0;
    $('flashcardDeck').style.display = 'flex';
    showCard();
  } catch (e) {
    alert(`Couldn't generate flashcards: ${e.message}`);
  }
}

function showCard() {
  const card = flashcards[fcIndex];
  if (!card) return;
  $('flashcardFront').textContent = card.front;
  $('flashcardBack').textContent  = card.back;
  $('flashcard').classList.remove('flipped');
  $('cardCounter').textContent = `${fcIndex + 1} / ${flashcards.length}`;
}

window.flipCard = function() {
  $('flashcard').classList.toggle('flipped');
};

// ══════════════════════════════════════
//  QUIZ
// ══════════════════════════════════════
function setupQuiz() {
  $('startQuizBtn').addEventListener('click', startQuiz);
  $('quizNextBtn').addEventListener('click', nextQuestion);
  $('retryQuizBtn').addEventListener('click', () => {
    $('quizResults').style.display = 'none';
    $('quizSetup').style.display   = 'flex';
  });
}

async function startQuiz() {
  const topic = $('quizTopicInput').value.trim();
  const count = parseInt($('quizCount').value);
  if (!topic) return;

  const system = `You are a quiz generator. Always respond with ONLY valid JSON.`;
  const prompt = `Create ${count} multiple-choice questions about: "${topic}"
Return ONLY a JSON array:
[{
  "question":"...",
  "choices":["A","B","C","D"],
  "correct":0,
  "explanation":"..."
},...]
"correct" is the 0-based index of the right answer.`;

  try {
    const reply = await callClaude([{ role: 'user', content: prompt }], system);
    const clean = reply.replace(/```json|```/g, '').trim();
    quizData  = JSON.parse(clean);
    quizIndex = 0;
    quizScore = 0;

    $('quizSetup').style.display   = 'none';
    $('quizArea').style.display    = 'flex';
    $('quizResults').style.display = 'none';
    renderQuestion();
  } catch (e) {
    alert(`Couldn't generate quiz: ${e.message}`);
  }
}

function renderQuestion() {
  const q = quizData[quizIndex];
  if (!q) return;

  const pct = ((quizIndex) / quizData.length) * 100;
  $('progressFill').style.width = pct + '%';
  $('quizProgress').textContent  = `Question ${quizIndex + 1} / ${quizData.length}`;
  $('quizQuestion').textContent  = q.question;
  $('quizFeedback').style.display = 'none';
  $('quizNextBtn').style.display  = 'none';

  $('quizChoices').innerHTML = q.choices.map((c, i) => `
    <button class="choice-btn" onclick="answerQuestion(${i})">${escHtml(c)}</button>
  `).join('');
}

window.answerQuestion = function(idx) {
  const q    = quizData[quizIndex];
  const btns = $('quizChoices').querySelectorAll('.choice-btn');
  btns.forEach(b => b.disabled = true);
  btns[q.correct].classList.add('correct');

  const fb = $('quizFeedback');
  if (idx === q.correct) {
    quizScore++;
    btns[idx].classList.add('correct');
    fb.className = 'quiz-feedback correct';
    fb.textContent = `✓ Correct! ${q.explanation || ''}`;
  } else {
    btns[idx].classList.add('wrong');
    fb.className = 'quiz-feedback wrong';
    fb.textContent = `✗ Incorrect. ${q.explanation || ''}`;
  }
  fb.style.display = 'block';
  $('quizNextBtn').style.display = 'block';
};

function nextQuestion() {
  quizIndex++;
  if (quizIndex >= quizData.length) {
    showResults();
  } else {
    renderQuestion();
  }
}

function showResults() {
  $('quizArea').style.display    = 'none';
  $('quizResults').style.display = 'flex';
  const pct = Math.round((quizScore / quizData.length) * 100);
  const emoji = pct >= 80 ? '🏆' : pct >= 50 ? '📚' : '💪';
  $('scoreText').textContent = `${emoji} ${quizScore} / ${quizData.length} correct (${pct}%)`;
  $('progressFill').style.width = '100%';
}

// ══════════════════════════════════════
//  SUMMARIZE
// ══════════════════════════════════════
function setupSummary() {
  $('summarizeBtn').addEventListener('click', summarize);
  $('copySummaryBtn').addEventListener('click', () => {
    navigator.clipboard.writeText($('summaryOutput').textContent);
    $('copySummaryBtn').textContent = '✓ Copied!';
    setTimeout(() => { $('copySummaryBtn').textContent = '📋 Copy'; }, 2000);
  });
}

async function summarize() {
  const text  = $('summaryInput').value.trim();
  const style = $('summaryStyle').value;
  if (!text) return;

  const styleInstructions = {
    concise:  'Summarize in 2-3 concise sentences.',
    bullet:   'Summarize as 5-7 clear bullet points.',
    detailed: 'Write a detailed summary covering all key points.',
    eli5:     'Explain this like I\'m 5 years old, simply and clearly.'
  };

  try {
    const reply = await callClaude([{
      role: 'user',
      content: `${styleInstructions[style]}\n\nText:\n${text}`
    }]);
    $('summaryOutput').textContent = reply;
    $('copySummaryBtn').style.display = 'block';
  } catch (e) {
    $('summaryOutput').textContent = `Error: ${e.message}`;
  }
}

// ── Utilities ──────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
