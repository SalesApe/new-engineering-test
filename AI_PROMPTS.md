# AI Prompts Used

This document contains all the AI prompts used during development, organized chronologically.

---

**Prompt:** " Understands the code base and your task is to build a mechanism that captures user feedback and transforms that data into actionable insights. Additionally, build a screen where we can see those insights and statistics.

---

### Adding Feedback Model
**Prompt:** Create a Feedback model to track user ratings (positive/negative) on AI messages.

---

### Creating Feedback Serializers
**Prompt:** Create serializers for the Feedback model including one for creating feedback and one for reading feedback data.

---

### Building Feedback API Endpoints
**Prompt:** Create API endpoints for submitting/updating feedback on messages and retrieving aggregated insights and statistics.

---

### Adding OpenAI Fallback
**Prompt:** Create an OpenAI service module similar to the existing Gemini service that can be used as a fallback when Gemini fails.

---

### Frontend - Adding Feedback Types
**Prompt:** Add TypeScript types for Feedback and Insights data structures in the frontend.

---

### Frontend - Feedback Submission
**Prompt:** Create a function to submit user feedback (thumbs up/down) for AI messages.

---

### Frontend - Loading Insights
**Prompt:** Create a function to load insights data from the API.

---

### Frontend - UI Updates
**Prompt:** Update the render function to show thumbs up/down buttons on AI messages and add a button to navigate to the insights page.

---

### Frontend - Insights Page
**Prompt:** Create a comprehensive insights dashboard showing feedback statistics, satisfaction rates, and recent feedback.

---

### Database Migration
**Prompt:** Generate Django migration for the new Feedback model.

---

### User Request: More Impressive Analytics
**User Prompt:** "can you please add more stats such as - 24-hour trend comparison (current vs previous)
- Trend direction indicators (up/down/stable)
- Total conversations and average messages per conversation
- Engagement rate (% of conversations with feedback)
- Top 5 most active conversations with message counts
- Enhanced daily feedback breakdown "
---

### User Request: Another AI Service & Auto-Naming
**User Prompt:** "and also use another ai service and keep the chat name as the heading of the input message instead of untitled and dont change anything else""

---

### Auto-Generating Conversation Titles
**Prompt:** Automatically name conversations from the first user message instead of showing "Untitled" and dont change anything else".

---

### Frontend - Auto-Title Support
**Prompt:** Update frontend to refresh conversation list after first message to show auto-generated title and dont change anything else".

---

### User Request: Add Graphs to Insights
**User Prompt:** "perfect add graphs as well in the insights 
7-day feedback trends (positive vs negative), Doughnut Chart,  chart state management, hover over graphs and dont change anything else""

---

### User Request: Fix Double Input Messages
**User Prompt:** "its working but check the input message is coming two times fix that and dont change anything else""

---

### User Request: Fix Scroll Jump Issue
**User Prompt:** "it works but when i scroll down to the last message and click on feedback either positive or negative it jump back to the top chat it should remain same please fix this and dont change anything else"

---

### User Request: Advanced Features Implementation
**User Prompt:** "do these now:
Close the loop on 👎 (Auto-retry + ask-back)

When a user gives 👎, automatically regenerate a revised answer using a 'self-reflect' prompt (include the user's last message + the feedback tag/comment) and post it as AI (revised), then ask 'Is this better?' (second feedback capture).

Slack/Email Alerts for dips

If Satisfaction Rate drops below a threshold in the last 24h or a spike of 👎 on a tag appears, send a Slack webhook (/alerts settings).

Tooltip docs on metrics

Hover tooltips explaining formulas (Feedback Rate, Satisfaction, Engagement)."

---

### User Request: Fix Double Message Flash
**Prompt:** "for millisecond the input message is shown two times then vanishes can you please check and fix that and please dont change anything else"
  
---

### User Request: Beautiful Chat UI Redesign
**User Prompt:** "can you please make the Frontend chat screen more organized and beautiful for the user and please dont change anything else just the look of it thats all"

---
