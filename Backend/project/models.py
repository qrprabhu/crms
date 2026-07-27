from django.db import models


STATUS_CHOICES = [
    ('Planning', 'Planning'),
    ('Active', 'Active'),
    ('On Hold', 'On Hold'),
    ('Delayed', 'Delayed'),
    ('Completed', 'Completed'),
    ('Cancelled', 'Cancelled'),
]

PRIORITY_CHOICES = [
    ('Low', 'Low'),
    ('Medium', 'Medium'),
    ('High', 'High'),
    ('Critical', 'Critical'),
]

TASK_STATUS_CHOICES = [
    ('Not Started', 'Not Started'),
    ('In Progress', 'In Progress'),
    ('On Hold', 'On Hold'),
    ('Completed', 'Completed'),
]

ISSUE_STATUS_CHOICES = [
    ('Open', 'Open'),
    ('Resolved', 'Resolved'),
    ('Closed', 'Closed'),
]

PHASE_STATUS_CHOICES = [
    ('Pending', 'Pending'),
    ('In Progress', 'In Progress'),
    ('Completed', 'Completed'),
]

SEVERITY_CHOICES = [
    ('Low', 'Low'),
    ('Medium', 'Medium'),
    ('High', 'High'),
    ('Critical', 'Critical'),
]


class Project(models.Model):
    project_code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    account_name = models.CharField(max_length=255, blank=True)
    contact_name = models.CharField(max_length=255, blank=True)
    deal_name = models.CharField(max_length=255, blank=True)
    source_module = models.CharField(max_length=50, blank=True)
    source_record_id = models.PositiveIntegerField(null=True, blank=True)
    source_record_label = models.CharField(max_length=255, blank=True)
    owner = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Planning')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='Medium')
    progress = models.PositiveIntegerField(default=0)
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    estimated_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['priority']),
            models.Index(fields=['owner']),
            models.Index(fields=['source_module', 'source_record_id']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.project_code} - {self.name}"

    @property
    def team_count(self):
        return self.members.count()

    @property
    def logged_hours(self):
        result = self.time_logs.aggregate(total=models.Sum('hours'))
        return float(result['total'] or 0)


class ProjectTask(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    owner = models.CharField(max_length=255, blank=True)
    assigned_by = models.CharField(max_length=255, blank=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=TASK_STATUS_CHOICES, default='Not Started')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='Medium')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class ProjectPhase(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='phases')
    name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=PHASE_STATUS_CHOICES, default='Pending')
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return self.name


class ProjectIssue(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='issues')
    title = models.CharField(max_length=255)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='Medium')
    owner = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=ISSUE_STATUS_CHOICES, default='Open')
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class ProjectMember(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='members')
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class ProjectFile(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='files')
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=100, blank=True)
    uploaded_by = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    file_url = models.URLField(blank=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return self.name


class ProjectNote(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='notes')
    content = models.TextField()
    created_by = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Note on {self.project.name}"


class ProjectTimeLog(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='time_logs')
    member = models.CharField(max_length=255, blank=True)
    task = models.CharField(max_length=255, blank=True)
    date = models.DateField(null=True, blank=True)
    hours = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.member} - {self.hours}h"
