from django.contrib import admin

# Register your models here.
from .models import Message, Group, Profile
admin.site.register(Message)
admin.site.register(Group)
admin.site.register(Profile)
