from django.urls import path

from .views import (
    AnalyticsDashboardView,
    ExportReportView,
    GenerateReportView,
    HomeDashboardView,
    MyRequestsDashboardView,
    ReportCatalogView,
)


urlpatterns = [
    path("dashboard/home/", HomeDashboardView.as_view(), name="dashboard-home"),
    path("dashboard/analytics/", AnalyticsDashboardView.as_view(), name="dashboard-analytics"),
    path("dashboard/my-requests/", MyRequestsDashboardView.as_view(), name="dashboard-my-requests"),
    path("reports/catalog/", ReportCatalogView.as_view(), name="reports-catalog"),
    path("reports/generate/", GenerateReportView.as_view(), name="reports-generate"),
    path("reports/export/", ExportReportView.as_view(), name="reports-export"),
    path("reports/download/", ExportReportView.as_view(), name="reports-download"),
]
