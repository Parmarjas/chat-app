from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver

from django.db.models import JSONField

class Profile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    bio = models.TextField(blank=True, default='')
    email = models.EmailField(blank=True, default='')
    mobile_number = models.CharField(max_length=20, blank=True, default='')
    friends = models.JSONField(default=list, blank=True)  # List of friend user IDs

    def __str__(self):
        return f"Profile of {self.user.username}"

# Signal to automatically create a Profile when a User is created
@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        Profile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    try:
        instance.profile.save()
    except Profile.DoesNotExist:
        Profile.objects.create(user=instance)


        
class Group(models.Model):
    name = models.CharField(max_length=100)
    members = models.ManyToManyField(User, related_name='chat_groups')

    def __str__(self):
        return self.name

class Message(models.Model):
    sender = models.ForeignKey(User, related_name='sent_messages', on_delete=models.CASCADE)
    receiver = models.ForeignKey(User, related_name='received_messages', on_delete=models.CASCADE, null=True, blank=True)
    group = models.ForeignKey(Group, related_name='messages', on_delete=models.CASCADE, null=True, blank=True)
    content = models.TextField(blank=True)
    imageUrl = models.URLField(blank=True, null=True)
    documentUrl = models.URLField(blank=True, null=True)
    documentName = models.CharField(max_length=255, blank=True, null=True)
    pollVotes = JSONField(blank=True, null=True, default=dict)
    timestamp = models.DateTimeField(auto_now_add=True)
    # Track deleted messages
    deleted_for_users = models.TextField(blank=True, default="")  # Comma-separated user IDs
    deleted_for_everyone = models.BooleanField(default=False)  # True if deleted for everyone

    def __str__(self):
        if self.group:
            return f"{self.sender.username} to group {self.group.name}: {self.content[:20]}"
        elif self.receiver:
            return f"{self.sender.username} to {self.receiver.username}: {self.content[:20]}"
        else:
            return f"{self.sender.username}: {self.content[:20]}"
