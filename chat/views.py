from __future__ import annotations

from typing import Any

from django.shortcuts import get_object_or_404
from django.db.models import QuerySet, Count, Q
from django.conf import settings
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Conversation, Message, Feedback
from .serializers import (
    ConversationSerializer,
    MessageSerializer,
    CreateMessageSerializer,
    FeedbackSerializer,
    CreateFeedbackSerializer,
)
from .services import ai_service


class ConversationListCreateView(APIView):
    def get(self, request: Request) -> Response:
        qs: QuerySet[Conversation] = Conversation.objects.all().order_by("-updated_at")
        # Manual pagination using limit/offset to align with plan
        try:
            limit = min(int(request.query_params.get("limit", 20)), 100)
        except ValueError:
            limit = 20
        try:
            offset = int(request.query_params.get("offset", 0))
        except ValueError:
            offset = 0
        items = qs[offset : offset + limit]
        data = ConversationSerializer(items, many=True).data
        return Response({"results": data, "count": qs.count(), "offset": offset, "limit": limit})

    def post(self, request: Request) -> Response:
        title = (request.data or {}).get("title")
        conv = Conversation.objects.create(title=title or None)
        return Response(ConversationSerializer(conv).data, status=status.HTTP_201_CREATED)


class ConversationDetailView(APIView):
    def get(self, request: Request, pk: int) -> Response:
        conv = get_object_or_404(Conversation, pk=pk)
        return Response(ConversationSerializer(conv).data)


class MessageListCreateView(APIView):
    def get(self, request: Request, pk: int) -> Response:
        conv = get_object_or_404(Conversation, pk=pk)
        try:
            since = int(request.query_params.get("since", 0))
        except ValueError:
            since = 0
        try:
            limit = min(int(request.query_params.get("limit", 50)), 200)
        except ValueError:
            limit = 50
        qs = conv.messages.all()
        if since:
            qs = qs.filter(sequence__gt=since)
        qs = qs.order_by("sequence")[:limit]
        results = list(qs)
        return Response({
            "results": MessageSerializer(results, many=True).data,
            "lastSeq": (results[-1].sequence if results else since),
        })

    def post(self, request: Request, pk: int) -> Response:
        conv = get_object_or_404(Conversation, pk=pk)
        serializer = CreateMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        text: str = serializer.validated_data["text"].strip()

        # Persist user message
        user_msg = Message.objects.create(conversation=conv, role=Message.ROLE_USER, text=text)

        # Auto-generate conversation title from first user message if untitled
        if not conv.title and conv.messages.count() == 1:
            # Take first 50 chars of the first message as title
            title = text[:50]
            if len(text) > 50:
                title += "..."
            conv.title = title
            conv.save(update_fields=['title'])

        # Build short history context (last 10 messages)
        history = list(
            conv.messages.order_by("-sequence").values("role", "text")[:10]
        )[::-1]

        try:
            reply = ai_service.generate_reply(history=history, prompt=text, timeout_s=10)
        except ai_service.AIServiceError as e:
            # Remove user message to keep integrity if AI fails? We keep it and surface 502.
            return Response({"detail": str(e)}, status=status.HTTP_502_BAD_GATEWAY)

        ai_msg = Message.objects.create(conversation=conv, role=Message.ROLE_AI, text=reply)
        return Response({
            "user_message": MessageSerializer(user_msg).data,
            "ai_message": MessageSerializer(ai_msg).data,
        }, status=status.HTTP_201_CREATED)


class FeedbackView(APIView):
    """Submit or update feedback for an AI message"""
    def post(self, request: Request, message_id: int) -> Response:
        from .services import ai_service
        
        message = get_object_or_404(Message, pk=message_id, role=Message.ROLE_AI)
        serializer = CreateFeedbackSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        rating = serializer.validated_data["rating"]
        comment = serializer.validated_data.get("comment", "")
        
        # Check if changing from positive to negative (for auto-retry)
        existing_feedback = Feedback.objects.filter(message=message).first()
        was_positive = existing_feedback and existing_feedback.rating == Feedback.RATING_POSITIVE
        
        # Create or update feedback
        feedback, created = Feedback.objects.update_or_create(
            message=message,
            defaults={
                "rating": rating,
                "comment": comment,
            }
        )
        
        response_data = FeedbackSerializer(feedback).data
        
        # Auto-retry on negative feedback (new OR changed from positive)
        should_retry = rating == Feedback.RATING_NEGATIVE and (created or was_positive)
        if should_retry:
            try:
                conv = message.conversation
                
                # Check if we already created a revised response for this message
                already_revised = conv.messages.filter(
                    sequence__gt=message.sequence,
                    text__startswith="**[Revised Response]**"
                ).exists()
                
                if already_revised:
                    # Don't create duplicate revised responses
                    pass
                else:
                    # Get the user's original question (message before this AI response)
                    user_messages = list(
                        conv.messages.filter(
                            sequence__lt=message.sequence,
                            role=Message.ROLE_USER
                        ).order_by('-sequence')[:1]
                    )
                    
                    if user_messages:
                        original_question = user_messages[0].text
                        
                        # Build history for context
                        history = list(
                            conv.messages.filter(sequence__lt=message.sequence)
                            .order_by("-sequence").values("role", "text")[:10]
                        )[::-1]
                        
                        # Self-reflection prompt
                        retry_prompt = f"""The user gave negative feedback on my previous response. Let me try to provide a better answer.

Original question: {original_question}

Previous response that didn't satisfy: {message.text[:200]}...

User feedback: {comment if comment else "Not helpful"}

Let me provide a revised, more helpful response:"""
                        
                        # Generate improved response
                        revised_reply = ai_service.generate_reply(
                            history=history,
                            prompt=retry_prompt,
                            timeout_s=15
                        )
                        
                        # Create revised AI message
                        revised_msg = Message.objects.create(
                            conversation=conv,
                            role=Message.ROLE_AI,
                            text=f"**[Revised Response]**\n\n{revised_reply}\n\n*Is this better? Please let me know with feedback! 👍👎*"
                        )
                        
                        # Add revised message to response
                        response_data['revised_message'] = MessageSerializer(revised_msg).data
                    
            except Exception as e:
                # Log error but don't fail the feedback submission
                import logging
                logging.error(f"Auto-retry failed: {e}")
        
        return Response(
            response_data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK
        )


class InsightsView(APIView):
    """Get feedback insights and statistics"""
    def get(self, request: Request) -> Response:
        from django.utils import timezone
        from datetime import timedelta
        from django.db.models import Avg, Count, F, ExpressionWrapper, fields
        
        # Overall statistics
        total_ai_messages = Message.objects.filter(role=Message.ROLE_AI).count()
        total_feedback = Feedback.objects.count()
        positive_feedback = Feedback.objects.filter(rating=Feedback.RATING_POSITIVE).count()
        negative_feedback = Feedback.objects.filter(rating=Feedback.RATING_NEGATIVE).count()
        
        # Calculate feedback rate and satisfaction rate
        feedback_rate = (total_feedback / total_ai_messages * 100) if total_ai_messages > 0 else 0
        satisfaction_rate = (positive_feedback / total_feedback * 100) if total_feedback > 0 else 0
        
        # Total conversations and messages
        total_conversations = Conversation.objects.count()
        total_messages = Message.objects.count()
        avg_messages_per_conv = (total_messages / total_conversations) if total_conversations > 0 else 0
        
        # Engagement metrics
        conversations_with_feedback = Feedback.objects.values('message__conversation').distinct().count()
        engagement_rate = (conversations_with_feedback / total_conversations * 100) if total_conversations > 0 else 0
        
        # Response time analysis (time between user message and AI response)
        ai_messages_with_feedback = Message.objects.filter(
            role=Message.ROLE_AI,
            feedback__isnull=False
        ).count()
        
        # Recent feedback
        recent_feedback = Feedback.objects.select_related('message', 'message__conversation').order_by('-created_at')[:20]
        
        # Feedback over time (last 7 days)
        seven_days_ago = timezone.now() - timedelta(days=7)
        daily_feedback = {}
        for i in range(7):
            date = (timezone.now() - timedelta(days=i)).date()
            daily_feedback[str(date)] = {
                'positive': Feedback.objects.filter(
                    rating=Feedback.RATING_POSITIVE,
                    created_at__date=date
                ).count(),
                'negative': Feedback.objects.filter(
                    rating=Feedback.RATING_NEGATIVE,
                    created_at__date=date
                ).count(),
            }
        
        # Most active conversations
        active_conversations = Conversation.objects.annotate(
            message_count=Count('messages')
        ).order_by('-message_count')[:5]
        
        # Recent trend (last 24 hours vs previous 24 hours)
        now = timezone.now()
        last_24h = now - timedelta(hours=24)
        prev_24h = now - timedelta(hours=48)
        
        feedback_last_24h = Feedback.objects.filter(created_at__gte=last_24h).count()
        feedback_prev_24h = Feedback.objects.filter(
            created_at__gte=prev_24h, 
            created_at__lt=last_24h
        ).count()
        
        positive_last_24h = Feedback.objects.filter(
            created_at__gte=last_24h,
            rating=Feedback.RATING_POSITIVE
        ).count()
        
        trend_direction = "up" if feedback_last_24h > feedback_prev_24h else "down" if feedback_last_24h < feedback_prev_24h else "stable"
        trend_percentage = 0
        if feedback_prev_24h > 0:
            trend_percentage = ((feedback_last_24h - feedback_prev_24h) / feedback_prev_24h * 100)
        
        return Response({
            "overview": {
                "total_ai_messages": total_ai_messages,
                "total_feedback": total_feedback,
                "positive_feedback": positive_feedback,
                "negative_feedback": negative_feedback,
                "feedback_rate": round(feedback_rate, 2),
                "satisfaction_rate": round(satisfaction_rate, 2),
                "total_conversations": total_conversations,
                "avg_messages_per_conversation": round(avg_messages_per_conv, 1),
                "engagement_rate": round(engagement_rate, 2),
                "ai_messages_with_feedback": ai_messages_with_feedback,
            },
            "trends": {
                "feedback_last_24h": feedback_last_24h,
                "feedback_prev_24h": feedback_prev_24h,
                "positive_last_24h": positive_last_24h,
                "trend_direction": trend_direction,
                "trend_percentage": round(trend_percentage, 1),
            },
            "daily_feedback": daily_feedback,
            "recent_feedback": FeedbackSerializer(recent_feedback, many=True).data,
            "top_conversations": [
                {
                    "id": conv.id,
                    "title": conv.title or "Untitled",
                    "message_count": conv.message_count,
                    "updated_at": conv.updated_at,
                }
                for conv in active_conversations
            ],
        })


class AlertsView(APIView):
    """Check and send alerts for satisfaction dips"""
    def post(self, request: Request) -> Response:
        from .services.alerts import AlertService
        
        result = AlertService.check_and_send_alerts()
        return Response(result)
    
    def get(self, request: Request) -> Response:
        """Get alert settings"""
        import os
        
        return Response({
            "slack_webhook_configured": bool(os.environ.get("SLACK_WEBHOOK_URL")),
            "satisfaction_threshold": float(os.environ.get("SATISFACTION_ALERT_THRESHOLD", "50")),
            "negative_spike_threshold": int(os.environ.get("NEGATIVE_SPIKE_THRESHOLD", "3")),
            "alerts_enabled": bool(os.environ.get("SLACK_WEBHOOK_URL")),
        })
