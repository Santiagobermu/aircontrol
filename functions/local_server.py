from flask import Flask, request, jsonify
from flask_cors import CORS
from solver_engine import solve_schedule

app = Flask(__name__)
# Enable CORS for local Vite development server
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "healthy"}), 200

@app.route('/solve', methods=['POST'])
def solve():
    try:
        data = request.json or {}
        
        controllers = data.get('controllers', [])
        exceptions = data.get('exceptions', {})
        sequence_pattern = data.get('sequencePattern', [])
        days = data.get('days', [])
        holidays = data.get('holidays', [])
        current_schedule = data.get('schedule', {})
        requests_list = data.get('requests', [])
        
        if not controllers or not days:
            return jsonify({"error": "Missing controllers or days lists"}), 400
            
        result = solve_schedule(
            controllers=controllers,
            exceptions=exceptions,
            sequence_pattern=sequence_pattern,
            days=days,
            holidays=holidays,
            current_schedule=current_schedule,
            requests=requests_list
        )
        
        return jsonify(result), 200
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/sync_notams_api', methods=['GET', 'POST'])
def sync_notams():
    try:
        from notams_parser import sync_skbo_notams
        result = sync_skbo_notams()
        return jsonify(result), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("Starting local server (Solver + NOTAMs) on http://localhost:8080")
    app.run(host='0.0.0.0', port=8080, debug=True)
