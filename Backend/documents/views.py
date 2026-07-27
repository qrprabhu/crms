from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Document, DocumentVersion
from .serializers import (
    DocumentCreateSerializer,
    DocumentDetailSerializer,
    DocumentListSerializer,
    DocumentUpdateSerializer,
    DocumentVersionSerializer,
)


class DocumentViewSet(viewsets.ModelViewSet):
    permission_classes = [AllowAny]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ["document_type", "related_module", "related_id"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "updated_at", "title"]
    ordering = ["-created_at"]

    def get_queryset(self):
        return Document.objects.filter(is_active=True).select_related("uploaded_by")

    def get_serializer_class(self):
        if self.action == "list":
            return DocumentListSerializer
        if self.action in {"update", "partial_update"}:
            return DocumentUpdateSerializer
        if self.action == "create":
            return DocumentCreateSerializer
        return DocumentDetailSerializer

    def create(self, request, *args, **kwargs):
        serializer = DocumentCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        uploaded_by = request.user if hasattr(request.user, "pk") and request.user.pk else None
        document = serializer.save(uploaded_by=uploaded_by)
        return Response(
            DocumentDetailSerializer(document, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        document = self.get_object()
        serializer = DocumentUpdateSerializer(document, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)

        new_file = request.data.get("file")
        if new_file:
            # Archive the current file as a DocumentVersion before overwriting
            DocumentVersion.objects.create(
                document=document,
                file=document.file,
                version_number=document.version,
            )
            serializer.save(version=document.version + 1)
        else:
            serializer.save()

        return Response(DocumentDetailSerializer(document, context={"request": request}).data)

    def destroy(self, request, *args, **kwargs):
        document = self.get_object()
        document.is_active = False
        document.save(update_fields=["is_active"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="versions")
    def versions(self, request, pk=None):
        document = self.get_object()
        qs = DocumentVersion.objects.filter(document=document)
        return Response(DocumentVersionSerializer(qs, many=True, context={"request": request}).data)
