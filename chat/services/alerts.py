from __future__ import annotations

import os
import json
from typing import Dict, Any
from datetime import timedelta
from django.utils import timezone


class AlertService:
    """Service for sending alerts about satisfaction dips"""
    
    @staticmethod
    def check_and_send_alerts() -> Dict[str, Any]:
        """Check metrics and send alerts if thresholds are breached"""
        from ..models import Feedback, Message
        
        alerts_sent = []
        
        # Get settings from environment
        slack_webhook = os.environ.get("SLACK_WEBHOOK_URL")
        satisfaction_threshold = float(os.environ.get("SATISFACTION_ALERT_THRESHOLD", "50"))
        negative_spike_threshold = int(os.environ.get("NEGATIVE_SPIKE_THRESHOLD", "3"))
        
        # Check last 24 hours
        now = timezone.now()
        last_24h = now - timedelta(hours=24)
        
        # Calculate satisfaction rate in last 24h
        recent_feedback = Feedback.objects.filter(created_at__gte=last_24h)
        total_recent = recent_feedback.count()
        
        if total_recent > 0:
            positive_recent = recent_feedback.filter(rating=Feedback.RATING_POSITIVE).count()
            satisfaction_rate = (positive_recent / total_recent) * 100
            negative_count = total_recent - positive_recent
            
            # Alert 1: Satisfaction rate dropped below threshold
            if satisfaction_rate < satisfaction_threshold:
                alert_msg = {
                    "type": "satisfaction_low",
                    "message": f"⚠️ Satisfaction Rate Alert: {satisfaction_rate:.1f}% (Threshold: {satisfaction_threshold}%)",
                    "details": {
                        "satisfaction_rate": satisfaction_rate,
                        "threshold": satisfaction_threshold,
                        "positive": positive_recent,
                        "negative": negative_count,
                        "total": total_recent,
                        "period": "last 24 hours"
                    }
                }
                
                if slack_webhook:
                    AlertService._send_slack_alert(slack_webhook, alert_msg)
                
                alerts_sent.append(alert_msg)
            
            # Alert 2: Spike in negative feedback
            if negative_count >= negative_spike_threshold:
                alert_msg = {
                    "type": "negative_spike",
                    "message": f"⚠️ Negative Feedback Spike: {negative_count} thumbs down in last 24h (Threshold: {negative_spike_threshold})",
                    "details": {
                        "negative_count": negative_count,
                        "threshold": negative_spike_threshold,
                        "period": "last 24 hours"
                    }
                }
                
                if slack_webhook:
                    AlertService._send_slack_alert(slack_webhook, alert_msg)
                
                alerts_sent.append(alert_msg)
        
        return {
            "alerts_sent": alerts_sent,
            "alert_count": len(alerts_sent),
            "checked_at": now.isoformat()
        }
    
    @staticmethod
    def _send_slack_alert(webhook_url: str, alert: Dict[str, Any]) -> bool:
        """Send alert to Slack webhook"""
        try:
            import requests
            
            # Format Slack message
            slack_message = {
                "text": alert["message"],
                "blocks": [
                    {
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": "🚨 AI Chat Alert"
                        }
                    },
                    {
                        "type": "section",
                        "text": {
                            "type": "mrkdwn",
                            "text": alert["message"]
                        }
                    },
                    {
                        "type": "section",
                        "fields": [
                            {
                                "type": "mrkdwn",
                                "text": f"*Type:*\n{alert['type']}"
                            },
                            {
                                "type": "mrkdwn",
                                "text": f"*Period:*\n{alert['details'].get('period', 'N/A')}"
                            }
                        ]
                    }
                ]
            }
            
            # Add details based on alert type
            if alert['type'] == 'satisfaction_low':
                slack_message["blocks"].append({
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Satisfaction:*\n{alert['details']['satisfaction_rate']:.1f}%"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Threshold:*\n{alert['details']['threshold']}%"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Positive:*\n{alert['details']['positive']} 👍"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Negative:*\n{alert['details']['negative']} 👎"
                        }
                    ]
                })
            
            response = requests.post(webhook_url, json=slack_message, timeout=10)
            return response.status_code == 200
            
        except Exception as e:
            import logging
            logging.error(f"Failed to send Slack alert: {e}")
            return False

