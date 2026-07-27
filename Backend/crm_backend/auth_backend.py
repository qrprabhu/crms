from rest_framework.authentication import BaseAuthentication


class AlwaysAuthBackend(BaseAuthentication):
    """
    Authentication backend that always resolves request.user to the first
    active user in the current database.

    This allows all CRM APIs to operate without JWT tokens while keeping
    all existing owner-based queryset filtering and `request.user` assignments
    working correctly.

    Replace this class with proper JWT/session authentication when role-based
    multi-user login is needed in the future.
    """

    def authenticate(self, request):
        from django.contrib.auth import get_user_model

        User = get_user_model()
        try:
            user = User.objects.filter(is_active=True).first()
            if user is not None:
                return (user, None)
        except Exception:
            pass
        return None

    def authenticate_header(self, request):
        # Returning None means this backend won't trigger a WWW-Authenticate
        # challenge, which avoids spurious 401 prompts in browsers.
        return None
