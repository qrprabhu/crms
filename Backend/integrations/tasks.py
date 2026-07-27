from __future__ import annotations

from functools import wraps

from .models import BCCDropboxSetting, EmailParserInbox, EmailProviderIntegration, VisitorLeadEvent
from .services import convert_visitor_event, ingest_parser_message, process_bcc_payload, run_provider_sync


def _fallback_task(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)

    def delay(*args, **kwargs):
        return func(*args, **kwargs)

    wrapper.delay = delay
    wrapper.apply_async = lambda args=None, kwargs=None, **_: func(*(args or ()), **(kwargs or {}))
    return wrapper


try:
    from celery import shared_task
except ImportError:  # pragma: no cover
    def shared_task(*decorator_args, **decorator_kwargs):
        if decorator_args and callable(decorator_args[0]) and not decorator_kwargs:
            return _fallback_task(decorator_args[0])

        def decorator(func):
            return _fallback_task(func)

        return decorator


@shared_task
def provider_sync_task(provider_integration_id: int, sync_type: str = "incremental_sync", triggered_by_id: int | None = None):
    provider = EmailProviderIntegration.objects.get(pk=provider_integration_id)
    triggered_by = provider.created_by.__class__.objects.filter(pk=triggered_by_id).first() if triggered_by_id else None
    return run_provider_sync(provider_integration=provider, sync_type=sync_type, triggered_by=triggered_by).id


@shared_task
def parser_ingest_task(parser_inbox_id: int, payload: dict):
    parser_inbox = EmailParserInbox.objects.get(pk=parser_inbox_id)
    return ingest_parser_message(parser_inbox=parser_inbox, payload=payload).get("event").id


@shared_task
def bcc_processing_task(setting_id: int, payload: dict):
    setting = BCCDropboxSetting.objects.get(pk=setting_id)
    return process_bcc_payload(setting=setting, payload=payload).get("event").id


@shared_task
def visitor_event_processing_task(visitor_event_id: int):
    visitor_event = VisitorLeadEvent.objects.select_related("portal__setting").get(pk=visitor_event_id)
    result = convert_visitor_event(visitor_event=visitor_event)
    event = result.get("event")
    return event.id if event else None
