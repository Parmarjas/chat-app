from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Message, Profile, Group

class ProfileSerializer(serializers.ModelSerializer):
    friends = serializers.SerializerMethodField()
    
    class Meta:
        model = Profile
        fields = ['user', 'friends', 'bio', 'email', 'mobile_number']
        read_only_fields = ['user', 'friends']  # Make user and friends read-only for updates
    
    def get_friends(self, obj):
        # Return list of friend IDs from the JSONField
        return obj.friends if obj.friends else []
    
    def to_representation(self, instance):
        # Handle case where profile might not exist
        if not instance:
            return {
                'user': None,
                'friends': [],
                'bio': '',
                'email': '',
                'mobile_number': ''
            }
        return super().to_representation(instance)

class UserSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(required=False)
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'profile']
        read_only_fields = ['id', 'username']  # Make id and username read-only for updates

    def update(self, instance, validated_data):
        try:
            print(f"UserSerializer.update called with data: {validated_data}")
            profile_data = validated_data.pop('profile', None)
            print(f"Profile data: {profile_data}")
            
            user = super().update(instance, validated_data)
            print(f"User updated: {user}")
            
            if profile_data:
                try:
                    profile, created = Profile.objects.get_or_create(user=user)
                    print(f"Profile {'created' if created else 'retrieved'}: {profile}")
                    # Update profile fields
                    for attr, value in profile_data.items():
                        if hasattr(profile, attr) and attr not in ['user', 'friends']:
                            setattr(profile, attr, value)
                            print(f"Set {attr} = {value}")
                    profile.save()
                    print(f"Profile saved successfully: {profile}")
                    instance.refresh_from_db()
                except Exception as profile_error:
                    print(f"Error updating profile: {profile_error}")
                    import traceback
                    traceback.print_exc()
            return instance
        except Exception as e:
            print(f"Error in UserSerializer.update: {e}")
            import traceback
            traceback.print_exc()
            raise

class GroupSerializer(serializers.ModelSerializer):
    members = UserSerializer(many=True, read_only=True)
    member_ids = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), write_only=True, many=True, required=False, source='members'
    )

    class Meta:
        model = Group
        fields = ['id', 'name', 'members', 'member_ids']

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)
    poll = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = ['id', 'sender', 'receiver', 'content', 'imageUrl', 'documentUrl', 'documentName', 'timestamp', 'poll', 'pollVotes']

    def get_poll(self, obj):
        import json
        try:
            data = json.loads(obj.content)
            if isinstance(data, dict) and data.get('type') == 'poll':
                return {
                    'question': data.get('question'),
                    'options': data.get('options'),
                    'allowMultiple': data.get('allowMultiple', False)
                }
        except Exception:
            pass
        return None
