def custom_response(success=True, message="", data=None, status_code=200):
    response = {
        "success": success,
        "message": message
    }
    if data is not None:
        response["data"] = data
    return response

# Also could override simplejwt views, or just use utility responses.
