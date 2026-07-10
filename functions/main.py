from firebase_functions import https_fn, scheduler_fn
from firebase_admin import initialize_app
import json
from solver_engine import solve_schedule

@https_fn.on_request()
def solve_schedule_api(req: https_fn.Request) -> https_fn.Response:
    from firebase_admin import _apps, initialize_app
    if not _apps:
        initialize_app()
    # Manage CORS options requests
    if req.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '3600'
        }
        return https_fn.Response('', status=204, headers=headers)

    headers = {
        'Access-Control-Allow-Origin': '*'
    }

    try:
        data = req.get_json() or {}
        
        controllers = data.get('controllers', [])
        exceptions = data.get('exceptions', {})
        sequence_pattern = data.get('sequencePattern', [])
        days = data.get('days', [])
        holidays = data.get('holidays', [])
        current_schedule = data.get('schedule', {})
        requests_list = data.get('requests', [])
        
        if not controllers or not days:
            return https_fn.Response(
                json.dumps({"error": "Missing controllers or days lists"}),
                status=400,
                headers=headers,
                mimetype='application/json'
            )
            
        result = solve_schedule(
            controllers=controllers,
            exceptions=exceptions,
            sequence_pattern=sequence_pattern,
            days=days,
            holidays=holidays,
            current_schedule=current_schedule,
            requests=requests_list
        )
        
        return https_fn.Response(
            json.dumps(result),
            status=200,
            headers=headers,
            mimetype='application/json'
        )
        
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        return https_fn.Response(
            json.dumps({"error": str(e), "traceback": tb}),
            status=500,
            headers=headers,
            mimetype='application/json'
        )

@https_fn.on_request()
def sync_notams_api(req: https_fn.Request) -> https_fn.Response:
    from firebase_admin import _apps, initialize_app
    if not _apps:
        initialize_app()
        
    # Manage CORS
    if req.method == 'OPTIONS':
        headers = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '3600'
        }
        return https_fn.Response('', status=204, headers=headers)
        
    headers = {
        'Access-Control-Allow-Origin': '*'
    }
    
    try:
        import sys
        import os
        # Add current directory to path just in case
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from notams_parser import sync_skbo_notams
        
        result = sync_skbo_notams()
        return https_fn.Response(
            json.dumps(result),
            status=200,
            headers=headers,
            mimetype='application/json'
        )
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        return https_fn.Response(
            json.dumps({"error": str(e), "traceback": tb}),
            status=500,
            headers=headers,
            mimetype='application/json'
        )

@scheduler_fn.on_schedule(schedule="30 5 * * *", timezone="America/Bogota")
def scheduled_sync_notams(event: scheduler_fn.ScheduledEvent) -> None:
    from firebase_admin import _apps, initialize_app
    if not _apps:
        initialize_app()
        
    try:
        import sys
        import os
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from notams_parser import sync_skbo_notams
        
        result = sync_skbo_notams()
        print(f"Scheduled NOTAM sync succeeded: {result}")
    except Exception as e:
        print(f"Scheduled NOTAM sync failed: {e}")
