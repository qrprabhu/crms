from rest_framework import serializers

from .catalog import REPORT_CATALOG_BY_KEY


class ReportRequestSerializer(serializers.Serializer):
    report_key = serializers.ChoiceField(
        choices=[(key, key) for key in REPORT_CATALOG_BY_KEY.keys()],
        required=False,
    )
    reportKey = serializers.ChoiceField(
        choices=[(key, key) for key in REPORT_CATALOG_BY_KEY.keys()],
        required=False,
    )
    date_from = serializers.DateField(required=False, allow_null=True)
    date_to = serializers.DateField(required=False, allow_null=True)
    search = serializers.CharField(required=False, allow_blank=True, default="")
    page = serializers.IntegerField(required=False, min_value=1, default=1)
    page_size = serializers.IntegerField(required=False, min_value=1, max_value=100, default=25)

    def validate(self, attrs):
        report_key = attrs.get("report_key") or attrs.get("reportKey")
        if not report_key:
            raise serializers.ValidationError({"reportKey": "reportKey is required."})
        attrs["report_key"] = report_key
        if attrs.get("date_from") and attrs.get("date_to") and attrs["date_from"] > attrs["date_to"]:
            raise serializers.ValidationError({"date_to": "Date To must be on or after Date From."})
        return attrs


class ExportRequestSerializer(ReportRequestSerializer):
    export_format = serializers.ChoiceField(choices=[("csv", "csv"), ("xlsx", "xlsx")], required=False)
    fileFormat = serializers.ChoiceField(choices=[("csv", "csv"), ("xlsx", "xlsx")], required=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        export_format = attrs.get("export_format") or attrs.get("fileFormat") or "csv"
        attrs["export_format"] = export_format
        return attrs
