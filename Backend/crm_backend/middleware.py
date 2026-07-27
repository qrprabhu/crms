import traceback

from django.conf import settings
from django.http import JsonResponse


class ApiPathNormalizationMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.META.get("PATH_INFO", "")
        if (
            path.startswith("/api/")
            and path != "/api/"
            and not path.endswith("/")
            and "." not in path.rsplit("/", 1)[-1]
        ):
            normalized_path = f"{path}/"
            request.META["PATH_INFO"] = normalized_path
            request.path_info = normalized_path
            request.path = normalized_path

        return self.get_response(request)


class TenantMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        try:
            response = self.get_response(request)
        except Exception as exc:
            if settings.DEBUG and request.path.startswith("/api/"):
                return JsonResponse(
                    {
                        "detail": str(exc) or exc.__class__.__name__,
                        "exception_type": exc.__class__.__name__,
                        "path": request.path,
                        "traceback": traceback.format_exc(),
                    },
                    status=500,
                )
            raise
        return response
