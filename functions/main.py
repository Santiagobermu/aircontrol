from firebase_functions import https_fn
from firebase_admin import initialize_app
import json
from solver_engine import solve_schedule

initialize_app()

@https_fn.on_request()
def solve_schedule_api(req: https_fn.Request) -> https_fn.Response:
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
            current_schedule=current_schedule
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
