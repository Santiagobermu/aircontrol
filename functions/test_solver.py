import json
from solver_engine import solve_schedule

def run_test():
    # 1. Mock controllers
    controllers = [
        {"id": "ATC-001", "name": "JZA", "skills": ["CTE", "TWR", "GND", "DEL"], "active": True, "trainingPreferred": True},
        {"id": "ATC-002", "name": "GMB", "skills": ["CTE", "TWR", "GND", "DEL"], "active": True, "trainingPreferred": False},
        {"id": "ATC-003", "name": "GGO", "skills": ["CTE", "TWR", "GND", "DEL"], "active": True, "trainingPreferred": False},
        {"id": "ATC-004", "name": "CSO", "skills": ["CTE", "TWR", "GND", "DEL"], "active": True, "trainingPreferred": False},
        {"id": "ATC-005", "name": "LSG", "skills": ["CTE", "TWR", "GND", "DEL"], "active": True, "trainingPreferred": False},
        {"id": "ATC-024", "name": "SBG", "skills": ["TWR", "GND", "DEL"], "active": True, "trainingPreferred": False},
        {"id": "ATC-035", "name": "ERC", "skills": ["GND", "DEL"], "active": True, "trainingPreferred": True},
        {"id": "ATC-050", "name": "VGR", "skills": ["DEL"], "active": True, "trainingPreferred": True}
    ]
    
    # 2. Mock exceptions
    exceptions = {
        "ATC-002": {"2026-07-03": "VACACIONES"}
    }
    
    # 3. Mock sequence pattern
    sequence_pattern = ["M", "T", "N", "DESCANSO", "DESCANSO", "M"]
    
    # 4. Mock days for a week
    days = [
        "2026-07-01", # Wednesday
        "2026-07-02", # Thursday
        "2026-07-03", # Friday
        "2026-07-04", # Saturday
        "2026-07-05", # Sunday
        "2026-07-06", # Monday
    ]
    
    # 5. Mock holidays
    holidays = ["2026-07-06"]  # Monday is a holiday
    
    # 6. Current schedule (some presets)
    current_schedule = {
        "2026-07-01": {
            "M": {
                "TWR-1": "ATC-001"  # Fix ATC-001 in TWR-1 on Wednesday morning
            }
        }
    }
    
    print("Running solver test...")
    result = solve_schedule(
        controllers=controllers,
        exceptions=exceptions,
        sequence_pattern=sequence_pattern,
        days=days,
        holidays=holidays,
        current_schedule=current_schedule
    )
    
    print("Status:", result["status"])
    print("Metrics:", json.dumps(result["metrics"], indent=2))
    
    # Check if ATC-001 is still assigned to TWR-1 on 2026-07-01
    val = result["schedule"]["2026-07-01"]["M"]["TWR-1"]
    print("Preset check (Should be ATC-001):", val)
    assert val == "ATC-001", "Preset not preserved!"
    
    # Check if Sunday (2026-07-05) has empty allocations
    sunday_m_twr1 = result["schedule"]["2026-07-05"]["M"].get("TWR-1")
    print("Sunday check (Should be None):", sunday_m_twr1)
    
    # Check if ATC-002 is assigned on 2026-07-03 (should not be because of VACACIONES)
    worked_on_vacation = False
    for s in ["A", "M", "T", "N"]:
        for slot, assigned in result["schedule"]["2026-07-03"][s].items():
            if assigned == "ATC-002":
                worked_on_vacation = True
                
    print("Vacation check (Should be False):", worked_on_vacation)
    assert not worked_on_vacation, "Controller worked on vacation!"
    
    print("Test passed successfully!")

if __name__ == "__main__":
    run_test()
