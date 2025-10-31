from django.shortcuts import render
from django.http import JsonResponse

def index(request):
    return render(request, "index.html")

def personalization(request):
    return render(request, "personalization.html")

def press_button(request, num):
    print(f"Button {num} pressed!")   # ✅ This prints IN TERMINAL
    return JsonResponse({"pressed": num})
