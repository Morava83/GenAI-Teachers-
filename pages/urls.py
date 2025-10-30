# pages/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),  # homepage
    path('press/', views.press_button, name='press_button'),
]
