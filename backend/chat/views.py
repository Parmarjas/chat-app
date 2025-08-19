from django.contrib.auth import login, logout
from django.contrib.auth.models import User
from django.contrib.auth.hashers import check_password
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.http import JsonResponse
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import BasicAuthentication
from rest_framework.response import Response
from rest_framework.response import Response
from .models import Message, User, Profile
from .serializers import UserSerializer, MessageSerializer
from .serializers import UserSerializer

@method_decorator(csrf_exempt, name='dispatch')
class PollVoteView(APIView):
    def post(self, request):
        print(f"PollVoteView.post called")
        print(f"Request data: {request.data}")
        
        message_id = request.data.get('message_id')
        voter = request.data.get('voter')
        selected = request.data.get('selected')  # can be str or list
        
        print(f"Parsed data: message_id={message_id}, voter={voter}, selected={selected}")
        
        if not (message_id and voter and selected is not None):
            print(f"Validation failed: message_id={message_id}, voter={voter}, selected={selected}")
            return Response({'error': 'message_id, voter, and selected required'}, status=400)
        try:
            msg = Message.objects.get(pk=message_id)
            print(f"Found message: {msg.id}")
        except Message.DoesNotExist:
            print(f"Message not found: {message_id}")
            return Response({'error': 'Poll message not found'}, status=404)
        # pollVotes: {voter_username: [option_idx,...]} or [option_idx]
        votes = msg.pollVotes or {}
        # Support single/multi answer
        if isinstance(selected, int):
            selected = [selected]
        elif isinstance(selected, str):
            try:
                selected = [int(selected)]
            except Exception:
                print(f"Invalid selected option: {selected}")
                return Response({'error': 'Invalid selected option'}, status=400)
        elif isinstance(selected, list):
            selected = [int(i) for i in selected]
        
        print(f"Final selected: {selected}")
        votes[voter] = selected
        msg.pollVotes = votes
        msg.save()
        print(f"Vote saved successfully")
        return Response(MessageSerializer(msg).data)

class RegisterView(APIView):
    authentication_classes = []  # No authentication required for registration
    permission_classes = []      # No permissions required for registration
    
    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        if not username or not password:
            return Response({'error': 'Username and password required'}, status=400)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username already exists'}, status=400)
        user = User(username=username)
        user.set_password(password)
        user.save()
        return Response(UserSerializer(user).data)


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    authentication_classes = []  # No authentication required for login
    permission_classes = []      # No permissions required for login
    
    def post(self, request):
        print(f"LoginView.post called - Method: {request.method}")
        print(f"Request headers: {dict(request.headers)}")
        print(f"Request data: {request.data}")
        
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response({'error': 'Username and password required'}, status=400)
        
        try:
            user = User.objects.get(username=username)
            if user.check_password(password):
                # Log the user in (create session)
                login(request, user)
                return Response(UserSerializer(user).data)
            else:
                return Response({'error': 'Invalid password'}, status=400)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

@api_view(['POST'])
@csrf_exempt
def logout_view(request):
    """Logout the current user and clear session"""
    logout(request)
    return Response({'message': 'Logged out successfully'})

class UserListView(generics.ListAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer

@method_decorator(csrf_exempt, name='dispatch')
class UserDetailView(generics.RetrieveUpdateAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    authentication_classes = []  # Disable authentication temporarily
    permission_classes = []  # Disable permissions temporarily
    
    def update(self, request, *args, **kwargs):
        try:
            print(f"UserDetailView.update called")
            print(f"Request user: {request.user}")
            print(f"Request data: {request.data}")
            
            # Get the user instance
            user = self.get_object()
            print(f"Target user: {user}")
            
            # Temporarily allow all updates for debugging
            print("Allowing profile update for debugging")
            
            # Ensure the user has a profile
            try:
                profile = user.profile
                print(f"User profile exists: {profile}")
            except Profile.DoesNotExist:
                profile = Profile.objects.create(user=user)
                print(f"Created profile: {profile}")
            
            result = super().update(request, *args, **kwargs)
            print(f"Update result: {result}")
            return result
        except Exception as e:
            print(f"Error updating user profile: {e}")
            import traceback
            traceback.print_exc()
            return Response({'error': f'Failed to update profile: {str(e)}'}, status=500)

class MessageListView(APIView):
    def get(self, request, user1, user2):
        if not user1 or not user2:
            return Response({'error': 'user1 and user2 required'}, status=400)
        
        try:
            user1_obj = User.objects.get(username=user1)
            user2_obj = User.objects.get(username=user2)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)
        
        # Helper function to check if message is deleted for a user
        def is_deleted_for_user(msg, user_id):
            if not msg.deleted_for_users:
                return False
            return str(user_id) in msg.deleted_for_users.split(',')
        
        messages = Message.objects.filter(
            (Q(sender__username=user1) & Q(receiver__username=user2)) |
            (Q(sender__username=user2) & Q(receiver__username=user1))
        ).filter(
            # Filter out messages deleted for everyone
            deleted_for_everyone=False
        ).order_by('timestamp')
        
        # Filter out messages deleted for the requesting user (in Python)
        messages = [msg for msg in messages if not is_deleted_for_user(msg, user1_obj.id)]
        
        return Response(MessageSerializer(messages, many=True).data)

class CheckNewChatsView(APIView):
    def get(self, request):
        username = request.query_params.get('username')
        if not username:
            return Response({'error': 'username required'}, status=400)
        
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)
        
        # Helper function to check if message is deleted for a user
        def is_deleted_for_user(msg, user_id):
            if not msg.deleted_for_users:
                return False
            return str(user_id) in msg.deleted_for_users.split(',')
        
        # Get all users who have sent messages to this user
        message_senders = Message.objects.filter(
            receiver=user,
            deleted_for_everyone=False
        )
        # Filter in Python
        message_senders = [msg for msg in message_senders if not is_deleted_for_user(msg, user.id)]
        sender_ids = list(set([msg.sender.id for msg in message_senders]))
        
        # Get all users who have received messages from this user
        message_receivers = Message.objects.filter(
            sender=user,
            deleted_for_everyone=False
        ).values_list('receiver', flat=True).distinct()
        
        # Combine and get unique user IDs
        all_chat_user_ids = set(sender_ids + list(message_receivers))
        
        # Get user objects
        chat_users = User.objects.filter(id__in=all_chat_user_ids)
        
        return Response(UserSerializer(chat_users, many=True).data)

class MessageDeleteView(APIView):
    def delete(self, request, pk):
        delete_type = request.query_params.get('type', 'for_me')  # 'for_me' or 'for_everyone'
        username = request.query_params.get('username')
        
        if not username:
            return Response({'error': 'username required'}, status=400)
        
        try:
            msg = Message.objects.get(pk=pk)
            user = User.objects.get(username=username)
        except (Message.DoesNotExist, User.DoesNotExist):
            return Response({'error': 'Message or user not found'}, status=404)
        
        # Check if this is a group message or regular message
        is_group_message = msg.group is not None
        
        if is_group_message:
            # Group message logic
            is_sender = msg.sender == user
            is_group_member = msg.group.members.filter(id=user.id).exists()
            
            if not (is_sender or is_group_member):
                return Response({'error': 'You can only delete messages from groups you are a member of'}, status=403)
        else:
            # Regular message logic
            is_sender = msg.sender == user
            is_receiver = msg.receiver == user
            
            if not (is_sender or is_receiver):
                return Response({'error': 'You can only delete messages you sent or received'}, status=403)
        
        if delete_type == 'for_me':
            # Add user to deleted_for_users list
            deleted_users = msg.deleted_for_users.split(',') if msg.deleted_for_users else []
            deleted_users = [uid.strip() for uid in deleted_users if uid.strip()]  # Remove empty strings
            
            if str(user.id) not in deleted_users:
                deleted_users.append(str(user.id))
                msg.deleted_for_users = ','.join(deleted_users)
                msg.save()
            return Response({'success': 'Message deleted for you'})
        
        elif delete_type == 'for_everyone':
            # Only sender can delete for everyone
            if msg.sender != user:
                return Response({'error': 'Only the sender can delete messages for everyone'}, status=403)
            
            # Mark as deleted for everyone
            msg.deleted_for_everyone = True
            msg.save()
            return Response({'success': 'Message deleted for everyone'})
        
        else:
            return Response({'error': 'Invalid delete type'}, status=400)

class SendMessageView(APIView):
    def post(self, request):
        import json
        sender_username = request.data.get('sender')
        receiver_username = request.data.get('receiver')
        msg_type = request.data.get('type')
        content = request.data.get('content', '')
        imageUrl = request.data.get('imageUrl', '')

        if not (sender_username and receiver_username):
            return Response({'error': 'sender and receiver required'}, status=400)
        try:
            sender = User.objects.get(username=sender_username)
            receiver = User.objects.get(username=receiver_username)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=404)

        # Auto-create chat relationship: Ensure both users have profiles
        from .models import Profile
        sender_profile, created = Profile.objects.get_or_create(user=sender)
        receiver_profile, created = Profile.objects.get_or_create(user=receiver)
        documentUrl = request.data.get('documentUrl', '')
        documentName = request.data.get('documentName', '')
        if msg_type == 'poll':
            poll = request.data.get('poll')
            if not poll or not poll.get('question') or not poll.get('options'):
                return Response({'error': 'Poll question and options required'}, status=400)
            content = json.dumps({'type': 'poll', 'question': poll['question'], 'options': poll['options'], 'allowMultiple': poll.get('allowMultiple', False)})
            msg = Message.objects.create(sender=sender, receiver=receiver, content=content)
        else:
            if not (content or imageUrl or documentUrl):
                return Response({'error': 'content, imageUrl, or documentUrl required'}, status=400)
            msg = Message.objects.create(sender=sender, receiver=receiver, content=content, imageUrl=imageUrl, documentUrl=documentUrl, documentName=documentName)
        
        # Return both the message and user info for auto-adding to friends list
        response_data = {
            'message': MessageSerializer(msg).data,
            'sender_info': UserSerializer(sender).data,
            'receiver_info': UserSerializer(receiver).data
        }
        return Response(response_data, status=201)



        

# --- Group API ---
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from django.core.files.storage import default_storage
from django.conf import settings
from rest_framework.response import Response
from .models import Group
from .serializers import GroupSerializer

@api_view(['POST'])
def add_group_member(request, pk):
    try:
        group = Group.objects.get(pk=pk)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    username = request.data.get('username')
    if not username:
        return Response({'error': 'Username required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    group.members.add(user)
    group.save()
    return Response({'success': True})

@api_view(['POST'])
def remove_group_member(request, pk):
    try:
        group = Group.objects.get(pk=pk)
    except Group.DoesNotExist:
        return Response({'error': 'Group not found'}, status=status.HTTP_404_NOT_FOUND)
    username = request.data.get('username')
    if not username:
        return Response({'error': 'Username required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
    group.members.remove(user)
    group.save()
    return Response({'success': True})

@api_view(['GET', 'POST'])
def group_messages(request):
    from .models import Group
    if request.method == 'GET':
        group_id = request.query_params.get('group_id')
        username = request.query_params.get('username')  # Add username parameter
        
        if not group_id:
            return Response({'error': 'group_id required'}, status=400)
        if not username:
            return Response({'error': 'username required'}, status=400)
            
        try:
            group = Group.objects.get(pk=group_id)
            user = User.objects.get(username=username)
        except (Group.DoesNotExist, User.DoesNotExist):
            return Response({'error': 'Group or user not found'}, status=404)
        
        # Helper function to check if message is deleted for a user
        def is_deleted_for_user(msg, user_id):
            if not msg.deleted_for_users:
                return False
            return str(user_id) in msg.deleted_for_users.split(',')
            
        # Filter out messages deleted for everyone and deleted for this user
        messages = group.messages.filter(
            deleted_for_everyone=False
        ).order_by('timestamp')
        
        # Filter out messages deleted for this user (in Python)
        messages = [msg for msg in messages if not is_deleted_for_user(msg, user.id)]
        
        return Response(MessageSerializer(messages, many=True).data)
    elif request.method == 'POST':
        sender_username = request.data.get('sender')
        group_id = request.data.get('group_id')
        content = request.data.get('content', '')
        imageUrl = request.data.get('imageUrl', '')
        documentUrl = request.data.get('documentUrl', '')
        documentName = request.data.get('documentName', '')
        poll = request.data.get('poll')
        if not (sender_username and group_id):
            return Response({'error': 'sender and group_id required'}, status=400)
        try:
            sender = User.objects.get(username=sender_username)
            group = Group.objects.get(pk=group_id)
        except (User.DoesNotExist, Group.DoesNotExist):
            return Response({'error': 'Sender or group not found'}, status=404)
        if poll:
            import json
            content = json.dumps({'type': 'poll', **poll})
        if not (content or imageUrl or documentUrl):
            return Response({'error': 'content, imageUrl, or documentUrl required'}, status=400)
        msg = Message.objects.create(
            sender=sender, group=group, content=content,
            imageUrl=imageUrl, documentUrl=documentUrl, documentName=documentName
        )
        return Response(MessageSerializer(msg).data, status=201)

@api_view(['GET', 'POST'])
def group_list(request):
    if request.method == 'GET':
        groups = Group.objects.all()
        serializer = GroupSerializer(groups, many=True)
        return Response(serializer.data)
    elif request.method == 'POST':
        serializer = GroupSerializer(data=request.data)
        if serializer.is_valid():
            group = Group.objects.create(name=serializer.validated_data['name'])
            members = request.data.get('member_ids', [])
            group.members.set(members)
            group.save()
            return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_image(request):
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({'error': 'No file uploaded'}, status=400)
    file_path = default_storage.save(f'chat_uploads/{file_obj.name}', file_obj)
    file_url = request.build_absolute_uri(settings.MEDIA_URL + file_path.split('media/')[-1])
    return Response({'url': file_url})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def friends_list(request):
    # Ensure user has a profile
    profile, created = Profile.objects.get_or_create(user=request.user)
    # Get friend user objects from the list of friend IDs
    friend_users = User.objects.filter(id__in=profile.friends)
    # Clean up the profile.friends list if there are stale IDs
    existing_ids = set(user.id for user in friend_users)
    if set(profile.friends) != existing_ids:
        profile.friends = list(existing_ids)
        profile.save()
    return Response(UserSerializer(friend_users, many=True).data)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    """Get the current authenticated user's data"""
    print(f"current_user called - user: {request.user}")
    return Response(UserSerializer(request.user).data)

@csrf_exempt
def add_friend(request, user_id):
    print(f"DEBUG: add_friend called with user_id: {user_id}")
    print(f"DEBUG: Request method: {request.method}")
    print(f"DEBUG: Request body: {request.body}")
    print(f"DEBUG: Request headers: {dict(request.headers)}")
    
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    # Check if user is authenticated
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Authentication required'}, status=401)
    
    try:
        # Get the authenticated user
        current_user = request.user
        # Get the user to be added as friend
        friend_user = User.objects.get(id=user_id)
        
        # Ensure both users have profiles
        current_profile, created = Profile.objects.get_or_create(user=current_user)
        friend_profile, created = Profile.objects.get_or_create(user=friend_user)
        
        # Add friend to current user's friends list
        if friend_user.id not in current_profile.friends:
            current_profile.friends.append(friend_user.id)
            current_profile.save()
        
        # Add current user to friend's friends list (mutual friendship)
        if current_user.id not in friend_profile.friends:
            friend_profile.friends.append(current_user.id)
            friend_profile.save()
        
        return JsonResponse({
            'message': 'Friend added successfully', 
            'user_id': user_id,
            'friend_username': friend_user.username
        })
        
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    except Exception as e:
        print(f"DEBUG: Error in add_friend: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

class RemoveFriendView(APIView):
    authentication_classes = []  # Disable authentication temporarily
    permission_classes = []      # Disable permissions temporarily
    
    @method_decorator(csrf_exempt, name='dispatch')
    def post(self, request, user_id):
        try:
            print(f"remove_friend called with user_id: {user_id}")
            print(f"request.user: {request.user}")
            print(f"request.user.is_authenticated: {request.user.is_authenticated}")
            print(f"request.session: {dict(request.session)}")
            print(f"request.data: {request.data}")
            
            # Get the current user - try multiple methods
            current_user = None
            
            # Method 1: Try to get from authenticated user
            if request.user.is_authenticated:
                current_user = request.user
                print(f"Using authenticated user: {current_user}")
            
            # Method 2: Try to get from session
            if not current_user and 'user_id' in request.session:
                try:
                    current_user = User.objects.get(id=request.session['user_id'])
                    print(f"Using user from session: {current_user}")
                except User.DoesNotExist:
                    pass
            
            # Method 3: Try to get from request data
            if not current_user and request.data:
                try:
                    if 'user_id' in request.data:
                        current_user = User.objects.get(id=request.data['user_id'])
                        print(f"Using user from request data: {current_user}")
                except User.DoesNotExist:
                    pass
            
            # Method 4: Use first user as fallback
            if not current_user:
                try:
                    current_user = User.objects.first()
                    print(f"Using first user as fallback: {current_user}")
                except:
                    return Response({'error': 'No users found in database'}, status=404)
            
            if not current_user:
                return Response({'error': 'Could not determine current user'}, status=400)
            
            # Get the friend user
            try:
                friend_user = User.objects.get(id=user_id)
                print(f"Friend user: {friend_user}")
            except User.DoesNotExist:
                return Response({'error': f'Friend user with ID {user_id} not found'}, status=404)
            
            # Ensure current user has a profile
            profile, created = Profile.objects.get_or_create(user=current_user)
            print(f"Current user profile: {profile}, friends: {profile.friends}")
            
            # Check if friend is in the friends list
            if friend_user.id in profile.friends:
                profile.friends.remove(friend_user.id)
                profile.save()
                print(f"Friend {friend_user.username} removed successfully from {current_user.username}'s friends list")
                
                # Also remove current user from friend's friends list (mutual removal)
                friend_profile, created = Profile.objects.get_or_create(user=friend_user)
                if current_user.id in friend_profile.friends:
                    friend_profile.friends.remove(current_user.id)
                    friend_profile.save()
                    print(f"Current user {current_user.username} removed from {friend_user.username}'s friends list")
                
                return Response({'message': 'Friend removed successfully'})
            else:
                print(f"Friend {friend_user.username} not in {current_user.username}'s friends list")
                return Response({'error': 'User is not in your friends list'}, status=400)
                
        except Exception as e:
            print(f"Error in remove_friend: {e}")
            import traceback
            traceback.print_exc()
            return Response({'error': f'Server error: {str(e)}'}, status=500)
