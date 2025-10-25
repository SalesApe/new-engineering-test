from rest_framework import serializers

from .models import Conversation, Message, Feedback


class ConversationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conversation
        fields = ["id", "title", "created_at", "updated_at"]


class FeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feedback
        fields = ["id", "message", "rating", "comment", "created_at"]
        read_only_fields = ["id", "created_at"]


class MessageSerializer(serializers.ModelSerializer):
    feedback = FeedbackSerializer(read_only=True)

    class Meta:
        model = Message
        fields = ["id", "conversation", "role", "text", "created_at", "sequence", "feedback"]
        read_only_fields = ["id", "created_at", "sequence", "conversation", "role"]


class CreateMessageSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=1000, allow_blank=False, trim_whitespace=True)

    def validate_text(self, value: str) -> str:
        text = value.strip()
        if not text:
            raise serializers.ValidationError("Message text cannot be empty.")
        return text


class CreateFeedbackSerializer(serializers.Serializer):
    rating = serializers.ChoiceField(choices=["positive", "negative"])
    comment = serializers.CharField(required=False, allow_blank=True, max_length=500)

