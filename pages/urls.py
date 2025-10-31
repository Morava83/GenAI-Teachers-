from django.urls import path
from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("personalization/", views.personalization, name="personalization"),
    path("press/<int:num>/", views.press_button, name="press_button"),
]
