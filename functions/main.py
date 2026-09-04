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

@scheduler_fn.on_schedule(schedule="45 1,5,9,13,17,21 * * *", timezone="America/Bogota")
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

@https_fn.on_request()
def send_push_notification_api(req: https_fn.Request) -> https_fn.Response:
    from firebase_admin import _apps, initialize_app, firestore, messaging
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
        data = req.get_json() or {}
        title = data.get('title', 'AirControl SKBO')
        body = data.get('body', 'Nueva actualización en tus turnos o solicitudes.')
        target_ids = list(data.get('controllerIds', []))
        if data.get('controllerId'):
            target_ids.append(data.get('controllerId'))
            
        custom_data = data.get('data', {})
        string_data = {str(k): str(v) for k, v in custom_data.items()}
        
        raw_tokens = list(data.get('tokens', []))
        
        # Consultar tokens de controladores objetivo en Firestore
        db = firestore.client()
        for cid in target_ids:
            if not cid:
                continue
            doc_ref = db.collection('controllers').document(str(cid))
            doc_snap = doc_ref.get()
            if doc_snap.exists:
                cdata = doc_snap.to_dict() or {}
                controller_tokens = cdata.get('fcmTokens', [])
                if isinstance(controller_tokens, list):
                    raw_tokens.extend(controller_tokens)
                    
        tokens = list(set([t for t in raw_tokens if t and isinstance(t, str)]))
        
        if not tokens:
            return https_fn.Response(
                json.dumps({"success": False, "message": "No se encontraron tokens FCM activos para los destinatarios."}),
                status=200,
                headers=headers,
                mimetype='application/json'
            )
            
        notification = messaging.Notification(
            title=title,
            body=body
        )
        
        message = messaging.MulticastMessage(
            notification=notification,
            data=string_data,
            tokens=tokens
        )
        
        response = messaging.send_each_for_multicast(message)
        
        return https_fn.Response(
            json.dumps({
                "success": True,
                "successCount": response.success_count,
                "failureCount": response.failure_count,
                "totalTokens": len(tokens)
            }),
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
