"""
URL configuration for crm_backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from django.http import JsonResponse
from crm_backend.email_views import send_email_view
from crm_backend.import_views import import_file_view
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

schema_view = get_schema_view(
    openapi.Info(
        title="CRM Backend API",
        default_version='v1',
        description="API documentation for the CRM backend.",
        terms_of_service="https://www.google.com/policies/terms/",
        contact=openapi.Contact(email="admin@crm.com"),
        license=openapi.License(name="BSD License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)


def health_check_view(_request):
    return JsonResponse({
        "status": "ok",
        "service": "crm-backend",
        "debug": settings.DEBUG,
    })

urlpatterns = [
    path('health/', health_check_view, name='health-check'),
    path('api/auth/', include('authentication.urls')),
    path('api/', include('leads.urls')),
    path('api/', include('accounts.urls')),
    path('api/', include('contacts.urls')),
    path('api/', include('deals.urls')),
    path('api/', include('campaigns.urls')),
    path('api/', include('inventory.urls')),
    path('api/', include('support.urls')),
    path('api/', include('services.urls')),
    path('api/', include('integrations.urls')),
    path('api/', include('notes.urls')),
    path('api/', include('activities.urls')),
    path('api/', include('project.urls')),
    path('api/', include('projectdesk.urls')),
    path('api/', include('documents.urls')),
    path('api/', include('reports.urls')),
    path('api/send-email', send_email_view, name='send-email'),
    path('api/imports', import_file_view, name='import-file'),
    
    # Swagger documentation URLs
    path('swagger<format>/', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
