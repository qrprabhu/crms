from django.contrib import admin
from .models import (
    Project, ProjectTask, ProjectPhase, ProjectIssue,
    ProjectMember, ProjectFile, ProjectNote, ProjectTimeLog,
)


class ProjectTaskInline(admin.TabularInline):
    model = ProjectTask
    extra = 0


class ProjectPhaseInline(admin.TabularInline):
    model = ProjectPhase
    extra = 0


class ProjectIssueInline(admin.TabularInline):
    model = ProjectIssue
    extra = 0


class ProjectMemberInline(admin.TabularInline):
    model = ProjectMember
    extra = 0


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['project_code', 'name', 'owner', 'status', 'priority', 'progress', 'due_date']
    list_filter = ['status', 'priority']
    search_fields = ['project_code', 'name', 'owner', 'account_name']
    inlines = [ProjectTaskInline, ProjectPhaseInline, ProjectIssueInline, ProjectMemberInline]


@admin.register(ProjectTask)
class ProjectTaskAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'owner', 'status', 'priority', 'due_date']
    list_filter = ['status', 'priority']
    search_fields = ['title', 'owner']


@admin.register(ProjectPhase)
class ProjectPhaseAdmin(admin.ModelAdmin):
    list_display = ['name', 'project', 'status', 'due_date']
    list_filter = ['status']


@admin.register(ProjectIssue)
class ProjectIssueAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'severity', 'owner', 'status', 'due_date']
    list_filter = ['status', 'severity']


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display = ['name', 'project', 'role', 'email']


@admin.register(ProjectFile)
class ProjectFileAdmin(admin.ModelAdmin):
    list_display = ['name', 'project', 'type', 'uploaded_by', 'uploaded_at']


@admin.register(ProjectNote)
class ProjectNoteAdmin(admin.ModelAdmin):
    list_display = ['project', 'created_by', 'created_at']


@admin.register(ProjectTimeLog)
class ProjectTimeLogAdmin(admin.ModelAdmin):
    list_display = ['member', 'project', 'task', 'date', 'hours']
