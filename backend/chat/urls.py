from django.urls import path
from .views import RegisterView, LoginView, logout_view, UserListView, UserDetailView, MessageListView, SendMessageView, MessageDeleteView, PollVoteView, group_list, group_messages, CheckNewChatsView

from .views import add_group_member, remove_group_member, upload_image, friends_list, add_friend, RemoveFriendView, current_user

urlpatterns = [
    path('register/', RegisterView.as_view()),
    path('login/', LoginView.as_view()),
    path('logout/', logout_view),
    path('users/', UserListView.as_view()),
    path('users/<int:pk>/', UserDetailView.as_view()),
    path('users/<int:user_id>/add_friend/', add_friend),
    path('users/<int:user_id>/remove_friend/', RemoveFriendView.as_view()),
    path('messages/user1=<str:user1>&user2=<str:user2>/', MessageListView.as_view()),
    path('send/', SendMessageView.as_view()),
    path('messages/<int:pk>/', MessageDeleteView.as_view()),
    path('poll/vote/', PollVoteView.as_view()),
    path('check-new-chats/', CheckNewChatsView.as_view()),
    path('upload/', upload_image),
    path('groups/', group_list),
    path('groups/<int:pk>/add_member/', add_group_member),
    path('groups/<int:pk>/remove_member/', remove_group_member),
    path('group_messages/', group_messages),
    path('friends/', friends_list),
    path('current-user/', current_user),
]
