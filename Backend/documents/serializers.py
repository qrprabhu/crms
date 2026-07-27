from rest_framework import serializers

from .models import Document, DocumentVersion


class DocumentVersionSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = DocumentVersion
        fields = ["id", "version_number", "file_url", "file_name", "uploaded_at"]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return str(obj.file) if obj.file else None

    def get_file_name(self, obj):
        return obj.file.name.split("/")[-1] if obj.file else None


class DocumentListSerializer(serializers.ModelSerializer):
    uploaded_by_email = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "title",
            "document_type",
            "related_module",
            "related_id",
            "uploaded_by",
            "uploaded_by_email",
            "file_url",
            "file_name",
            "version",
            "created_at",
            "updated_at",
        ]

    def get_uploaded_by_email(self, obj):
        return obj.uploaded_by.email if obj.uploaded_by else None

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return str(obj.file) if obj.file else None

    def get_file_name(self, obj):
        return obj.file_name


class DocumentDetailSerializer(DocumentListSerializer):
    versions = DocumentVersionSerializer(many=True, read_only=True)

    class Meta(DocumentListSerializer.Meta):
        fields = DocumentListSerializer.Meta.fields + ["description", "is_active", "versions"]


class DocumentCreateSerializer(serializers.ModelSerializer):
    # Accept any free-form string so users can type a custom type when
    # selecting "other". The model choices are advisory only (not a DB
    # constraint), so we bypass DRF's choice validation here.
    document_type = serializers.CharField(max_length=100, default="other")

    class Meta:
        model = Document
        fields = ["title", "description", "file", "document_type", "related_module", "related_id"]

    def validate_file(self, value):
        max_mb = 50
        if value.size > max_mb * 1024 * 1024:
            raise serializers.ValidationError(f"File size must not exceed {max_mb} MB.")
        return value


class DocumentUpdateSerializer(serializers.ModelSerializer):
    file = serializers.FileField(required=False)
    # Same free-form override as DocumentCreateSerializer
    document_type = serializers.CharField(max_length=100, required=False)

    class Meta:
        model = Document
        fields = ["title", "description", "file", "document_type", "related_module", "related_id"]
