from django.urls import path, re_path
from . import views

urlpatterns = [
    path("api/generate", views.generate_problem, name="generate_problem"),
    path("api/health", views.health_check, name="health_check"),
    re_path(r'^.*$', views.react_app, name="react_app"),
]
