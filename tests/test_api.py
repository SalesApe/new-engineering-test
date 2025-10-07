import json

import pytest

from chat.models import Conversation, Message


@pytest.mark.django_db
def test_create_conversation(client):
    url = "/api/conversations/"
    resp = client.post(url, data=json.dumps({"title": "My Chat"}), content_type="application/json")
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "My Chat"


@pytest.mark.django_db
def test_message_flow_with_mocked_gemini(client, monkeypatch):
    # Create conversation
    resp = client.post("/api/conversations/", data=json.dumps({}), content_type="application/json")
    conv = resp.json()

    # Mock gemini
    from chat.services import gemini

    def fake_generate_reply(history, prompt, timeout_s=10):
        assert prompt == "Hello"
        assert history == []
        assert timeout_s == 10
        return "Hi there!"

    monkeypatch.setattr(gemini, "generate_reply", fake_generate_reply)

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
def test_history_sent_to_gemini_excludes_new_message(client, monkeypatch):
    conv = Conversation.objects.create(title="History Test")
    Message.objects.create(conversation=conv, role=Message.ROLE_USER, text="Earlier question")
    Message.objects.create(conversation=conv, role=Message.ROLE_AI, text="Earlier answer")

    from chat.services import gemini

    captured = {}

    def fake_generate_reply(history, prompt, timeout_s=10):
        captured["history"] = history
        captured["prompt"] = prompt
        captured["timeout_s"] = timeout_s
        return "Second answer"

    monkeypatch.setattr(gemini, "generate_reply", fake_generate_reply)

    url = f"/api/conversations/{conv.id}/messages/"
    send = client.post(url, data=json.dumps({"text": "Latest question"}), content_type="application/json")
    assert send.status_code == 201

    assert captured["prompt"] == "Latest question"
    assert captured["timeout_s"] == 10
    assert captured["history"] == [
        {"role": "user", "text": "Earlier question"},
        {"role": "ai", "text": "Earlier answer"},
    ]
