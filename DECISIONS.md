Reflection and Decision-Making Summary

This project required several key design and implementation decisions. Below, I explain what choices I made, why I made them, and what I plan to improve in the future. These decisions are based on my own understanding and experience, not on any predefined agenda.

The project consisted of two main tasks:

Capture user feedback and convert it into actionable insights.

Create a dashboard to visualize those insights and related statistics.

Feedback System

For the feedback mechanism, I deliberately chose a thumbs up/thumbs down system. The goal was to make the process as simple and intuitive as possible so that users would be more likely to participate. Complex feedback systems discourage users from sharing their opinions, but a one-click model keeps it fast and effortless.

I also added a feature that automatically regenerates a new answer when the user gives a thumbs down. This ensures that the system keeps improving its responses until the user is satisfied. Behind the scenes, the system can rotate between different models each time it regenerates a response. I integrated three models: Gemini, OpenAI, and Claude.
During testing, I used the OpenAI API key since Gemini was not functioning correctly at the time.

Additionally, I improved the chat naming feature. Instead of leaving new chats as “Untitled,” the system now dynamically updates the chat name based on what the user writes. This small change significantly enhances the user experience and makes chat sessions more organized and personalized.

Insights Dashboard

For the Feedback Insights Dashboard, I leveraged my previous experience developing similar dashboards both in college and in my current role. This background helped me identify which metrics would best represent user engagement and system performance.

The dashboard includes:

Total and positive feedback counts

Message volume

Key performance rate

Feedback trends

User satisfaction rate

Active conversation tracking

I also added a real-time alerts feature with threshold-based triggers. Alerts are essential for monitoring performance drops — for example, when satisfaction or positive feedback rates fall below a certain level. This allows proactive monitoring and quick corrective actions.

Reflection and Future Improvements

Overall, this system works amazingly well and effectively meets the project goals within the given timeframe. However, due to limited time, there are several enhancements I plan to add in the future to make the system even more robust and data-driven.

Future improvements include:

Advanced backend functionality such as a fallback mechanism for better reliability.

Prompt and model telemetry tracking, including:

Model versioning

Prompt version history

Latency measurement

Input/output token counts

A/B testing for prompt experiments to compare and analyze performance between variations.

CSV export capabilities for all insights, metrics, and experimental results.

These features will make the system more maintainable, transparent, and scalable, providing deeper visibility into performance metrics and user behavior.

Conclusion

In summary, I focused on simplicity, automation, and insightful analytics to ensure a great user experience and valuable feedback insights. The system’s current version demonstrates a solid foundation, and with the planned backend enhancements, it will evolve into a comprehensive and data-driven feedback ecosystem.