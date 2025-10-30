from django.shortcuts import render
from django.http import JsonResponse   # ← add this line!


# Create your views here.
def home(request):
    return render(request, 'home.html')

def press_button(request):
    print("Button was pressed!")  # this will show in the Django terminal
    return JsonResponse({'message': 'Button press received!'})