from django.urls import path, include, re_path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    CheckEmailView, LoginView, SendOTPView,
    VerifyOTPView, ForgotPasswordView, ResetPasswordView,
    ChangePasswordView, ModulePermissionsView,
    UserListView, UserManagementViewSet,
)

router = DefaultRouter()
router.register(r"manage-users", UserManagementViewSet, basename="manage-users")

urlpatterns = [
    re_path(r'^check-email/?$', CheckEmailView.as_view(), name='check-email'),
    re_path(r'^login/?$', LoginView.as_view(), name='login'),
    re_path(r'^send-otp/?$', SendOTPView.as_view(), name='send-otp'),
    re_path(r'^verify-otp/?$', VerifyOTPView.as_view(), name='verify-otp'),
    re_path(r'^forgot-password/?$', ForgotPasswordView.as_view(), name='forgot-password'),
    re_path(r'^reset-password/?$', ResetPasswordView.as_view(), name='reset-password'),
    re_path(r'^change-password/?$', ChangePasswordView.as_view(), name='change-password'),
    re_path(r'^my-modules/?$', ModulePermissionsView.as_view(), name='my-modules'),
    re_path(r'^token/refresh/?$', TokenRefreshView.as_view(), name='token_refresh'),
    re_path(r'^users/?$', UserListView.as_view(), name='user-list'),   # legacy
    path('', include(router.urls)),
]
