// Minimal client: conversations list, chat view, polling
import '../tailwind.css'
import { Chart, registerables } from 'chart.js'

// Register Chart.js components
Chart.register(...registerables)

type Conversation = { id: number; title: string | null; created_at: string; updated_at: string }
type Feedback = {
  id: number
  message: number
  rating: 'positive' | 'negative'
  comment: string | null
  created_at: string
}
type Message = {
  id: number
  conversation: number
  role: 'user' | 'ai'
  text: string
  created_at: string
  sequence: number
  feedback?: Feedback | null
  tempId?: string
  pending?: boolean
}
type Insights = {
  overview: {
    total_ai_messages: number
    total_feedback: number
    positive_feedback: number
    negative_feedback: number
    feedback_rate: number
    satisfaction_rate: number
    total_conversations: number
    avg_messages_per_conversation: number
    engagement_rate: number
    ai_messages_with_feedback: number
  }
  trends: {
    feedback_last_24h: number
    feedback_prev_24h: number
    positive_last_24h: number
    trend_direction: 'up' | 'down' | 'stable'
    trend_percentage: number
  }
  daily_feedback: Record<string, { positive: number; negative: number }>
  recent_feedback: Feedback[]
  top_conversations: Array<{
    id: number
    title: string
    message_count: number
    updated_at: string
  }>
}

const root = document.getElementById('root')!

const state = {
  conversations: [] as Conversation[],
  current: null as Conversation | null,
  messages: [] as Message[],
  lastSeq: 0,
  pollTimer: 0 as any,
  view: 'chat' as 'chat' | 'insights',
  insights: null as Insights | null,
  charts: {
    dailyTrend: null as Chart | null,
    satisfaction: null as Chart | null,
    engagement: null as Chart | null,
  },
}

async function api<T>(url: string, opts: RequestInit = {}): Promise<T> {
  const resp = await fetch(`/api/${url}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
  })
  if (!resp.ok) throw new Error(await resp.text())
  return resp.json()
}

async function loadConversations() {
  const data = await api<{ results: Conversation[]; count: number }>(`conversations/?limit=50`)
  state.conversations = data.results
  if (!state.current && state.conversations.length) state.current = state.conversations[0]
  render()
}

async function createConversation(title?: string) {
  const data = await api<Conversation>('conversations/', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
  state.conversations.unshift(data)
  state.current = data
  state.messages = []
  state.lastSeq = 0
  render()
}

async function loadMessages() {
  if (!state.current) return
  const data = await api<{ results: Message[]; lastSeq: number }>(
    `conversations/${state.current.id}/messages/?since=${state.lastSeq}`
  )
  if (data.results.length) {
    // Filter out any messages that already exist (prevent duplicates)
    const newMessages = data.results.filter(
      (newMsg) => !state.messages.some((existingMsg) => existingMsg.id === newMsg.id)
    )
    if (newMessages.length > 0) {
      state.messages.push(...newMessages)
      state.lastSeq = data.lastSeq
      render()
      scrollChatToBottom()
    }
  }
}

let isSending = false

async function sendMessage(text: string) {
  if (isSending) return
  
  isSending = true
  
  // Add optimistic user message immediately for better UX
  const tempId = `tmp-${Date.now()}`
  const optimisticUserMsg: Message = {
    id: -1,
    conversation: state.current?.id || -1,
    role: 'user',
    text,
    created_at: new Date().toISOString(),
    sequence: state.lastSeq + 1,
    tempId,
    pending: true,
  }
  
  // If no conversation exists, create one first
  if (!state.current) {
    try {
      // Auto-create a conversation with the message text as title (truncated)
      const title = text.length > 30 ? text.substring(0, 30) + '...' : text
      await createConversation(title)
      // Update the conversation ID in the optimistic message
      optimisticUserMsg.conversation = state.current!.id
    } catch (err) {
      console.error('Failed to create conversation:', err)
      isSending = false
      alert('Failed to create conversation. Please try again.')
      return
    }
  }
  
  // Add optimistic user message to the UI
  state.messages.push(optimisticUserMsg)
  render()
  scrollChatToBottom()
  
  // Temporarily pause polling to avoid race conditions
  stopPolling()

  try {
    // Show AI is typing indicator
    const aiTypingMsg: Message = {
      id: -2,
      conversation: state.current!.id,
      role: 'ai',
      text: 'Thinking...',
      created_at: new Date().toISOString(),
      sequence: state.lastSeq + 2,
      tempId: 'typing-indicator',
      pending: true,
    }
    state.messages.push(aiTypingMsg)
    render()
    scrollChatToBottom()
    
    const res = await api<{ user_message: Message; ai_message: Message }>(
      `conversations/${state.current!.id}/messages/`,
      {
        method: 'POST',
        body: JSON.stringify({ text }),
      }
    )
    
    // Remove optimistic messages and typing indicator
    state.messages = state.messages.filter(m => 
      !m.tempId && m.id !== res.user_message.id && m.id !== res.ai_message.id
    )
    
    // Add real messages
    state.messages.push(res.user_message, res.ai_message)
    
    // Update lastSeq to the AI message sequence (highest)
    state.lastSeq = res.ai_message.sequence
    
    // Refresh conversation list if this was the first message (title may have been auto-generated)
    const wasFirstMessage = state.messages.filter(m => m.role === 'user').length === 1
    if (wasFirstMessage) {
      loadConversations()
    }
    
    render()
    scrollChatToBottom()
  } catch (err) {
    // No need to remove optimistic message since we never added it
    render()
    alert('Failed to send message. Please try again.')
  } finally {
    isSending = false
    // Restart polling after message is sent
    startPolling()
  }
}

async function submitFeedback(messageId: number, rating: 'positive' | 'negative') {
  try {
    const response = await api<Feedback & { revised_message?: Message }>(`messages/${messageId}/feedback/`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    })
    
    // Update the message with feedback
    const msg = state.messages.find((m) => m.id === messageId)
    if (msg) {
      msg.feedback = response
      
      // If there's a revised message (from negative feedback), add it
      if (response.revised_message) {
        // Check if not already added
        const exists = state.messages.find((m) => m.id === response.revised_message!.id)
        if (!exists) {
          state.messages.push(response.revised_message)
          state.lastSeq = response.revised_message.sequence
          // Scroll to bottom to show the revised message
          render()
          scrollChatToBottom()
          return
        }
      }
      
      // Save scroll position before render (for non-revised feedback)
      const chatScroll = document.getElementById('chat-scroll')
      const scrollTop = chatScroll?.scrollTop || 0
      
      render()
      
      // Restore scroll position after render
      requestAnimationFrame(() => {
        const chatScrollAfter = document.getElementById('chat-scroll')
        if (chatScrollAfter) {
          chatScrollAfter.scrollTop = scrollTop
        }
      })
    }
  } catch (err) {
    alert('Failed to submit feedback. Please try again.')
  }
}

async function loadInsights() {
  try {
    state.insights = await api<Insights>('insights/')
    render()
  } catch (err) {
    alert('Failed to load insights.')
  }
}

function startPolling() {
  stopPolling()
  state.pollTimer = setInterval(loadMessages, 5000) // Increased polling interval for better performance
}
function stopPolling() {
  if (state.pollTimer) clearInterval(state.pollTimer)
}

function scrollChatToBottom() {
  const c = document.getElementById('chat-scroll')
  if (c) c.scrollTop = c.scrollHeight
}

function render() {
  if (state.view === 'insights') {
    renderInsights()
    return
  }

  root.innerHTML = `
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <div class="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-4 gap-6 p-6">
      <!-- Sidebar -->
      <aside class="md:col-span-1 space-y-4">
        <!-- Header -->
        <div class="text-center mb-2">
          <h1 class="text-2xl font-bold text-gray-800">🤖 AI Chat</h1>
          <p class="text-xs text-gray-500 mt-1">Powered by AI</p>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex flex-col gap-3">
          <button id="new-conv" class="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-5 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
            ✨ New Conversation
          </button>
          <button id="view-insights" class="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white px-5 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
            📊 Insights Dashboard
          </button>
        </div>
        
        <!-- Conversations List -->
        <div class="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div class="bg-gradient-to-r from-gray-50 to-gray-100 px-4 py-3 border-b border-gray-200">
            <h2 class="font-semibold text-gray-700 text-sm">Recent Conversations</h2>
          </div>
          <ul class="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            ${state.conversations.length === 0 ? '<li class="p-4 text-center text-gray-400 text-sm">No conversations yet</li>' : state.conversations
              .map(
                (c) => `
              <li class="hover:bg-gray-50 transition-colors ${state.current?.id === c.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}">
                <button data-cid="${c.id}" class="w-full text-left p-3">
                  <div class="font-medium text-gray-800 text-sm mb-1 line-clamp-2">${escapeHtml(c.title ?? 'Untitled')}</div>
                  <div class="text-xs text-gray-500 flex items-center gap-1">
                    <span>🕐</span>
                    <span>${new Date(c.updated_at).toLocaleDateString()} ${new Date(c.updated_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                  </div>
                </button>
              </li>
            `
              )
              .join('')}
          </ul>
        </div>
      </aside>
      
      <!-- Main Chat Area -->
      <main class="md:col-span-3 flex flex-col h-[85vh]">
        <!-- Chat Header -->
        <div class="bg-white rounded-t-xl shadow-lg border border-gray-200 px-6 py-4 border-b">
          <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span class="text-2xl">💬</span>
            <span>${state.current?.title || 'Select a conversation'}</span>
          </h2>
          <p class="text-xs text-gray-500 mt-1">Chat with your AI assistant</p>
        </div>
        
        <!-- Messages Area -->
        <div id="chat-scroll" class="flex-1 overflow-auto bg-gradient-to-b from-gray-50 to-white p-6 space-y-4 shadow-lg border-x border-gray-200">
          ${state.messages.length === 0 ? `
            <div class="flex flex-col items-center justify-center h-full text-gray-400">
              <div class="text-6xl mb-4">💬</div>
              <p class="text-lg font-semibold">Start a conversation!</p>
              <p class="text-sm mt-2">Send a message to begin chatting with your AI assistant</p>
            </div>
          ` : state.messages
            .map(
              (m) => `
            <div class="flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in">
              <div class="max-w-[80%] ${m.role === 'user' ? 'order-1' : ''}">
                <div class="flex items-center gap-2 mb-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center text-lg ${m.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'}">
                    ${m.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <span class="text-xs font-semibold ${m.role === 'user' ? 'text-blue-700' : 'text-purple-700'}">${m.role === 'user' ? 'You' : 'AI Assistant'}</span>
                  <span class="text-xs text-gray-400">${new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}</span>
                </div>
                <div class="${m.role === 'user' 
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-sm px-5 py-3 shadow-md' 
                  : 'bg-white border-2 border-gray-200 rounded-2xl rounded-tl-sm px-5 py-3 shadow-md'}">
                  <div class="whitespace-pre-wrap text-sm leading-relaxed ${m.role === 'user' ? 'text-white' : 'text-gray-800'}">${escapeHtml(m.text)}</div>
                  ${m.role === 'ai' && m.id > 0 ? `
                    <div class="mt-3 pt-3 border-t border-gray-200 flex gap-3 items-center">
                      <span class="text-xs text-gray-500 font-medium">Was this helpful?</span>
                      <button data-feedback="${m.id}" data-rating="positive" 
                        class="feedback-btn px-3 py-1 rounded-full text-lg transition-all transform hover:scale-110 ${m.feedback?.rating === 'positive' ? 'bg-green-100 opacity-100 shadow-sm' : 'opacity-40 hover:opacity-100 hover:bg-green-50'}"
                        title="Thumbs up">👍</button>
                      <button data-feedback="${m.id}" data-rating="negative" 
                        class="feedback-btn px-3 py-1 rounded-full text-lg transition-all transform hover:scale-110 ${m.feedback?.rating === 'negative' ? 'bg-red-100 opacity-100 shadow-sm' : 'opacity-40 hover:opacity-100 hover:bg-red-50'}"
                        title="Thumbs down">👎</button>
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
        
        <!-- Input Area -->
        <form id="composer" class="bg-white rounded-b-xl shadow-lg border border-gray-200 border-t-2 p-5">
          <div class="flex gap-3 items-end">
            <textarea id="input" class="flex-1 resize-none border-2 border-gray-300 rounded-xl px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none text-sm" rows="3" placeholder="💭 Type your message... (max 1000 chars)"></textarea>
            <button class="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all transform hover:scale-105 flex items-center gap-2" type="submit">
              <span>Send</span>
              <span>✉️</span>
            </button>
          </div>
          <div class="mt-2 text-xs text-gray-400 flex items-center gap-2">
            <span>💡 Tip: Rate AI responses to help improve the assistant</span>
          </div>
        </form>
      </main>
    </div>
  </div>`

  document.getElementById('new-conv')?.addEventListener('click', () => {
    createConversation()
  })
  document.getElementById('view-insights')?.addEventListener('click', () => {
    state.view = 'insights'
    loadInsights()
  })
  document.querySelectorAll('[data-cid]')?.forEach((el) => {
    el.addEventListener('click', () => {
      const cid = Number((el as HTMLElement).dataset.cid)
      const c = state.conversations.find((x) => x.id === cid) || null
      state.current = c
      state.messages = []
      state.lastSeq = 0
      render()
      loadMessages()
    })
  })
  document.querySelectorAll('[data-feedback]')?.forEach((el) => {
    el.addEventListener('click', () => {
      const msgId = Number((el as HTMLElement).dataset.feedback)
      const rating = (el as HTMLElement).dataset.rating as 'positive' | 'negative'
      submitFeedback(msgId, rating)
    })
  })
  const form = document.getElementById('composer') as HTMLFormElement
  form?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const input = document.getElementById('input') as HTMLTextAreaElement
    const text = input.value.trim()
    if (!text) return
    if (text.length > 1000) {
      alert('Message too long')
      return
    }
    input.value = ''
    // Send message even if no conversation exists yet
    await sendMessage(text)
  })
}

function destroyCharts() {
  // Destroy existing charts before creating new ones
  if (state.charts.dailyTrend) {
    state.charts.dailyTrend.destroy()
    state.charts.dailyTrend = null
  }
  if (state.charts.satisfaction) {
    state.charts.satisfaction.destroy()
    state.charts.satisfaction = null
  }
  if (state.charts.engagement) {
    state.charts.engagement.destroy()
    state.charts.engagement = null
  }
}

function createCharts(insights: Insights) {
  // Destroy old charts first
  destroyCharts()

  // 1. Daily Trend Line Chart
  const dailyCanvas = document.getElementById('dailyTrendChart') as HTMLCanvasElement
  if (dailyCanvas) {
    const sortedDates = Object.keys(insights.daily_feedback).sort()
    const labels = sortedDates.map(date => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }))
    const positiveData = sortedDates.map(date => insights.daily_feedback[date].positive)
    const negativeData = sortedDates.map(date => insights.daily_feedback[date].negative)

    state.charts.dailyTrend = new Chart(dailyCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Positive Feedback',
            data: positiveData,
            borderColor: 'rgb(34, 197, 94)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.4,
            fill: true,
          },
          {
            label: 'Negative Feedback',
            data: negativeData,
            borderColor: 'rgb(239, 68, 68)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            tension: 0.4,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    })
  }

  // 2. Satisfaction Doughnut Chart
  const satisfactionCanvas = document.getElementById('satisfactionChart') as HTMLCanvasElement
  if (satisfactionCanvas) {
    state.charts.satisfaction = new Chart(satisfactionCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Positive 👍', 'Negative 👎'],
        datasets: [
          {
            data: [insights.overview.positive_feedback, insights.overview.negative_feedback],
            backgroundColor: [
              'rgb(34, 197, 94)',
              'rgb(239, 68, 68)',
            ],
            borderWidth: 2,
            borderColor: '#fff',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
          },
          title: {
            display: false,
          },
        },
      },
    })
  }

  // 3. Engagement Bar Chart
  const engagementCanvas = document.getElementById('engagementChart') as HTMLCanvasElement
  if (engagementCanvas) {
    state.charts.engagement = new Chart(engagementCanvas, {
      type: 'bar',
      data: {
        labels: ['Feedback Rate', 'Satisfaction Rate', 'Engagement Rate'],
        datasets: [
          {
            label: 'Percentage',
            data: [
              insights.overview.feedback_rate,
              insights.overview.satisfaction_rate,
              insights.overview.engagement_rate,
            ],
            backgroundColor: [
              'rgba(147, 51, 234, 0.8)',
              'rgba(34, 197, 94, 0.8)',
              'rgba(99, 102, 241, 0.8)',
            ],
            borderColor: [
              'rgb(147, 51, 234)',
              'rgb(34, 197, 94)',
              'rgb(99, 102, 241)',
            ],
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
          title: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%'
              },
            },
          },
        },
      },
    })
  }
}

function renderInsights() {
  const insights = state.insights
  root.innerHTML = `
  <div class="mx-auto max-w-7xl p-4">
    <div class="mb-6 flex justify-between items-center">
      <h1 class="text-4xl font-bold">📊 Feedback Insights Dashboard</h1>
      <div class="flex gap-2">
        <button id="check-alerts" class="btn bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded">🔔 Check Alerts</button>
        <button id="back-to-chat" class="btn bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded">← Back to Chat</button>
      </div>
    </div>
    
    <!-- Alert Status Banner -->
    <div id="alert-banner" class="hidden mb-4 p-4 rounded-lg border-2"></div>
    ${!insights ? '<div class="text-center py-8">Loading insights...</div>' : `
    
    <!-- Trends Section -->
    <div class="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-6 mb-6">
      <h2 class="text-2xl font-bold mb-4 text-blue-900">📈 24-Hour Trend</h2>
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <h3 class="text-sm text-blue-700 mb-1">Feedback (Last 24h)</h3>
          <p class="text-3xl font-bold text-blue-900">${insights.trends.feedback_last_24h}</p>
        </div>
        <div>
          <h3 class="text-sm text-blue-700 mb-1">Positive Feedback</h3>
          <p class="text-3xl font-bold text-green-600">${insights.trends.positive_last_24h}</p>
        </div>
        <div>
          <h3 class="text-sm text-blue-700 mb-1">Previous 24h</h3>
          <p class="text-3xl font-bold text-gray-600">${insights.trends.feedback_prev_24h}</p>
        </div>
        <div>
          <h3 class="text-sm text-blue-700 mb-1">Trend</h3>
          <p class="text-3xl font-bold ${insights.trends.trend_direction === 'up' ? 'text-green-600' : insights.trends.trend_direction === 'down' ? 'text-red-600' : 'text-gray-600'}">
            ${insights.trends.trend_direction === 'up' ? '↗' : insights.trends.trend_direction === 'down' ? '↘' : '→'} ${Math.abs(insights.trends.trend_percentage).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
    
    <!-- Key Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white border-2 border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition" title="Total number of AI responses generated">
        <h3 class="text-sm text-gray-600 mb-2 font-semibold flex items-center gap-1">
          Total AI Messages
          <span class="text-xs text-gray-400 cursor-help" title="Count of all AI-generated responses">ℹ️</span>
        </h3>
        <p class="text-4xl font-bold text-blue-600">${insights.overview.total_ai_messages}</p>
      </div>
      <div class="bg-white border-2 border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition">
        <h3 class="text-sm text-gray-600 mb-2 font-semibold flex items-center gap-1">
          Feedback Rate
          <span class="text-xs text-gray-400 cursor-help" title="Formula: (Total Feedback / Total AI Messages) × 100&#10;&#10;Shows what % of AI responses received user feedback">ℹ️</span>
        </h3>
        <p class="text-4xl font-bold text-purple-600">${insights.overview.feedback_rate}%</p>
        <p class="text-xs text-gray-500 mt-1">${insights.overview.total_feedback} submissions</p>
      </div>
      <div class="bg-white border-2 border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition">
        <h3 class="text-sm text-gray-600 mb-2 font-semibold flex items-center gap-1">
          Satisfaction Rate
          <span class="text-xs text-gray-400 cursor-help" title="Formula: (Positive Feedback / Total Feedback) × 100&#10;&#10;Shows what % of feedback is positive&#10;Green ≥70% | Yellow 50-69% | Red <50%">ℹ️</span>
        </h3>
        <p class="text-4xl font-bold ${insights.overview.satisfaction_rate >= 70 ? 'text-green-600' : insights.overview.satisfaction_rate >= 50 ? 'text-yellow-600' : 'text-red-600'}">${insights.overview.satisfaction_rate}%</p>
        <p class="text-xs text-gray-500 mt-1">👍 ${insights.overview.positive_feedback} / 👎 ${insights.overview.negative_feedback}</p>
      </div>
      <div class="bg-white border-2 border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition">
        <h3 class="text-sm text-gray-600 mb-2 font-semibold flex items-center gap-1">
          Engagement Rate
          <span class="text-xs text-gray-400 cursor-help" title="Formula: (Conversations with Feedback / Total Conversations) × 100&#10;&#10;Shows what % of conversations have at least one feedback">ℹ️</span>
        </h3>
        <p class="text-4xl font-bold text-indigo-600">${insights.overview.engagement_rate}%</p>
        <p class="text-xs text-gray-500 mt-1">${insights.overview.total_conversations} conversations</p>
      </div>
    </div>
    
    <!-- Additional Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-5">
        <h3 class="text-sm text-green-700 mb-2 font-semibold">Avg Messages/Conversation</h3>
        <p class="text-3xl font-bold text-green-800">${insights.overview.avg_messages_per_conversation}</p>
      </div>
      <div class="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-5">
        <h3 class="text-sm text-yellow-700 mb-2 font-semibold">Total Conversations</h3>
        <p class="text-3xl font-bold text-yellow-800">${insights.overview.total_conversations}</p>
      </div>
      <div class="bg-gradient-to-br from-pink-50 to-pink-100 border border-pink-200 rounded-lg p-5">
        <h3 class="text-sm text-pink-700 mb-2 font-semibold">AI Messages with Feedback</h3>
        <p class="text-3xl font-bold text-pink-800">${insights.overview.ai_messages_with_feedback}</p>
      </div>
    </div>
    
    <!-- Charts Section -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      <!-- Daily Trend Line Chart -->
      <div class="bg-white border-2 border-gray-200 rounded-lg p-5 shadow-sm col-span-2">
        <h2 class="text-xl font-bold mb-4">📈 Feedback Trends (Last 7 Days)</h2>
        <div style="height: 300px;">
          <canvas id="dailyTrendChart"></canvas>
        </div>
      </div>
      
      <!-- Satisfaction Doughnut Chart -->
      <div class="bg-white border-2 border-gray-200 rounded-lg p-5 shadow-sm">
        <h2 class="text-xl font-bold mb-4">😊 Satisfaction Breakdown</h2>
        <div style="height: 300px;">
          <canvas id="satisfactionChart"></canvas>
        </div>
      </div>
    </div>
    
    <!-- Engagement Bar Chart -->
    <div class="bg-white border-2 border-gray-200 rounded-lg p-5 shadow-sm mb-6">
      <h2 class="text-xl font-bold mb-4">📊 Key Performance Rates</h2>
      <div style="height: 300px;">
        <canvas id="engagementChart"></canvas>
      </div>
    </div>
    
    <!-- Top Conversations -->
    ${insights.top_conversations && insights.top_conversations.length > 0 ? `
    <div class="bg-white border-2 border-gray-200 rounded-lg p-5 mb-6 shadow-sm">
      <h2 class="text-2xl font-bold mb-4">🔥 Most Active Conversations</h2>
      <div class="space-y-3">
        ${insights.top_conversations.map((conv, idx) => `
          <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
            <div class="flex items-center gap-3">
              <span class="text-2xl font-bold text-gray-400">#${idx + 1}</span>
              <div>
                <p class="font-semibold text-gray-900">${escapeHtml(conv.title)}</p>
                <p class="text-xs text-gray-500">${new Date(conv.updated_at).toLocaleString()}</p>
              </div>
            </div>
            <span class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">${conv.message_count} messages</span>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}
    
    <!-- Recent Feedback -->
    <div class="bg-white border-2 border-gray-200 rounded-lg p-5 shadow-sm">
      <h2 class="text-2xl font-bold mb-4">💬 Recent Feedback</h2>
      <div class="space-y-3">
        ${insights.recent_feedback.length === 0 ? '<p class="text-gray-500 text-center py-8">No feedback yet. Start chatting to see insights!</p>' : insights.recent_feedback
          .map(
            (f) => `
          <div class="border-b pb-3 hover:bg-gray-50 p-2 rounded transition">
            <div class="flex items-center gap-3">
              <span class="text-2xl">${f.rating === 'positive' ? '👍' : '👎'}</span>
              <div class="flex-1">
                <span class="text-sm font-semibold text-gray-700">Message #${f.message}</span>
                <span class="text-sm text-gray-500"> • ${new Date(f.created_at).toLocaleString()}</span>
                ${f.comment ? `<p class="text-sm mt-1 text-gray-600 italic">"${escapeHtml(f.comment)}"</p>` : ''}
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
    `}
  </div>`

  document.getElementById('back-to-chat')?.addEventListener('click', () => {
    state.view = 'chat'
    destroyCharts()
    render()
  })
  
  document.getElementById('check-alerts')?.addEventListener('click', async () => {
    const banner = document.getElementById('alert-banner')
    if (!banner) return
    
    banner.textContent = '⏳ Checking alerts...'
    banner.className = 'mb-4 p-4 rounded-lg border-2 bg-blue-50 border-blue-200 text-blue-900'
    banner.classList.remove('hidden')
    
    try {
      const result = await api<{
        alerts_sent: Array<{ type: string; message: string }>;
        alert_count: number;
      }>('alerts/', { method: 'POST' })
      
      if (result.alert_count > 0) {
        banner.innerHTML = `
          <div class="font-bold mb-2">🚨 ${result.alert_count} Alert(s) Sent!</div>
          ${result.alerts_sent.map(alert => `
            <div class="text-sm mt-1">• ${alert.message}</div>
          `).join('')}
        `
        banner.className = 'mb-4 p-4 rounded-lg border-2 bg-red-50 border-red-300 text-red-900'
      } else {
        banner.textContent = '✅ All good! No alerts triggered. Satisfaction is within acceptable range.'
        banner.className = 'mb-4 p-4 rounded-lg border-2 bg-green-50 border-green-200 text-green-900'
      }
    } catch (err) {
      banner.textContent = '❌ Failed to check alerts. Make sure SLACK_WEBHOOK_URL is configured in .env'
      banner.className = 'mb-4 p-4 rounded-lg border-2 bg-gray-50 border-gray-200 text-gray-700'
    }
  })
  
  // Create charts after DOM is rendered
  if (insights) {
    // Use setTimeout to ensure canvas elements are ready
    setTimeout(() => createCharts(insights), 0)
  }
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string
  )
}

// Boot
;(async function init() {
  // Inject Tailwind (built via PostCSS)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = '/static/app/style.css'
  document.head.appendChild(link)
  await loadConversations()
  await loadMessages()
  startPolling()
})()
