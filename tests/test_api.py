import json
import pytest
from django.urls import reverse


@pytest.mark.django_db
def test_create_conversation(client):
    url = "/api/conversations/"
    resp = client.post(url, data=json.dumps({"title": "My Chat"}), content_type="application/json")
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My Chat"


@pytest.mark.django_db
def test_message_flow_with_mocked_ai(client, monkeypatch):
    # Create conversation
    resp = client.post("/api/conversations/", data=json.dumps({}), content_type="application/json")
    conv = resp.json()

    # Mock ai_service
    from chat.services import ai_service

    def fake_generate_reply(history, prompt, timeout_s=10):
        assert prompt == "Hello"
        return "Hi there!"

    monkeypatch.setattr(ai_service, "generate_reply", fake_generate_reply)

    # Send message
    url = f"/api/conversations/{conv['id']}/messages/"
    send = client.post(url, data=json.dumps({"text": "Hello"}), content_type="application/json")
    assert send.status_code == 201
    payload = send.json()
    assert payload["user_message"]["role"] == "user"
    assert payload["ai_message"]["role"] == "ai"

    # List messages with since
    list_url = f"/api/conversations/{conv['id']}/messages/?since=0"
    messages = client.get(list_url)
    assert messages.status_code == 200
    data = messages.json()
    assert len(data["results"]) == 2


@pytest.mark.django_db
def test_feedback_submission(client, monkeypatch):
    # Create conversation
    resp = client.post("/api/conversations/", data=json.dumps({}), content_type="application/json")
    conv = resp.json()

    # Mock ai_service
    from chat.services import ai_service

    def fake_generate_reply(history, prompt, timeout_s=10):
        return "Test response"

    monkeypatch.setattr(ai_service, "generate_reply", fake_generate_reply)

    # Send message to get an AI response
    url = f"/api/conversations/{conv['id']}/messages/"
    send = client.post(url, data=json.dumps({"text": "Hello"}), content_type="application/json")
    ai_message = send.json()["ai_message"]

    # Submit positive feedback
    feedback_url = f"/api/messages/{ai_message['id']}/feedback/"
    feedback_resp = client.post(
        feedback_url,
        data=json.dumps({"rating": "positive"}),
        content_type="application/json"
    )
    assert feedback_resp.status_code == 201
    feedback_data = feedback_resp.json()
    assert feedback_data["rating"] == "positive"
    assert feedback_data["message"] == ai_message["id"]

    # Update feedback to negative
    feedback_resp2 = client.post(
        feedback_url,
        data=json.dumps({"rating": "negative", "comment": "Not helpful"}),
        content_type="application/json"
    )
    assert feedback_resp2.status_code == 200
    feedback_data2 = feedback_resp2.json()
    assert feedback_data2["rating"] == "negative"
    assert feedback_data2["comment"] == "Not helpful"


@pytest.mark.django_db
def test_insights_endpoint(client, monkeypatch):
    # Create conversation
    resp = client.post("/api/conversations/", data=json.dumps({}), content_type="application/json")
    conv = resp.json()

    # Mock ai_service
    from chat.services import ai_service

    def fake_generate_reply(history, prompt, timeout_s=10):
        return "Test response"

    monkeypatch.setattr(ai_service, "generate_reply", fake_generate_reply)

    # Send message and get AI response
    url = f"/api/conversations/{conv['id']}/messages/"
    send = client.post(url, data=json.dumps({"text": "Hello"}), content_type="application/json")
    ai_message = send.json()["ai_message"]

    # Submit feedback
    feedback_url = f"/api/messages/{ai_message['id']}/feedback/"
    client.post(
        feedback_url,
        data=json.dumps({"rating": "positive"}),
        content_type="application/json"
    )

    # Get insights
    insights_url = "/api/insights/"
    insights_resp = client.get(insights_url)
    assert insights_resp.status_code == 200
    insights_data = insights_resp.json()
    
    assert "overview" in insights_data
    assert insights_data["overview"]["total_ai_messages"] == 1
    assert insights_data["overview"]["total_feedback"] == 1
    assert insights_data["overview"]["positive_feedback"] == 1
    assert insights_data["overview"]["satisfaction_rate"] == 100.0
    assert "daily_feedback" in insights_data
    assert "recent_feedback" in insights_data
