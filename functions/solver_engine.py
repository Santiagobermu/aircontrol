import math
from datetime import datetime, timedelta
from ortools.sat.python import cp_model

def is_colombian_holiday(date_str, holidays_list):
    """
    Returns True if the date is a holiday or Sunday.
    """
    if date_str in holidays_list:
        return True
    
    # Check if Sunday
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        if dt.weekday() == 6:  # 6 is Sunday in Python (Monday is 0)
            return True
    except ValueError:
        pass
    
    return False

def get_days_elapsed(date_str):
    """
    Calculates elapsed days from anchor date 2026-05-25.
    """
    anchor = datetime.strptime('2026-05-25', '%Y-%m-%d')
    target = datetime.strptime(date_str, '%Y-%m-%d')
    return (target - anchor).days

def get_sequence_day_index(controller_index, date_str):
    """
    Returns the index in the sequence pattern (0 to 5) for a controller index and date.
    """
    elapsed = get_days_elapsed(date_str)
    offset = controller_index % 6
    return ((elapsed + offset) % 6 + 6) % 6

def get_week_days_of_date(date_str):
    """
    Returns the 7 dates (Monday to Sunday) of the week containing date_str.
    """
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    weekday = dt.weekday()  # 0: Mon, ..., 6: Sun
    monday = dt - timedelta(days=weekday)
    return [(monday + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]

def has_certification(controller, position):
    """
    Checks if a controller has the required certification/skills for a position.
    """
    pos_prefix = position.split('-')[0]  # e.g., 'CTE' from 'CTE-1'
    
    if pos_prefix == 'ENT':
        return controller.get('trainingPreferred', False)
    
    if pos_prefix in ['INS', 'CAE', 'CHEC']:
        return True  # Any controller can be assigned to these
    
    skills = controller.get('skills', [])
    return pos_prefix in skills

def solve_schedule(controllers, exceptions, sequence_pattern, days, holidays, current_schedule):
    """
    Solves the monthly roster using Google OR-Tools CP-SAT.
    """
    model = cp_model.CpModel()
    
    shifts_list = ['A', 'M', 'T', 'N']
    
    # Standard operational requirements for non-holiday days
    standard_slots = {
        'A': ['TWR-1', 'GND-1', 'DEL-1'],
        'M': ['TWR-1', 'TWR-2', 'GND-1', 'GND-2', 'DEL-1', 'DEL-2', 'FIC-1', 'FIC-2', 'CTE-1'],
        'T': ['TWR-1', 'TWR-2', 'GND-1', 'GND-2', 'DEL-1', 'DEL-2', 'FIC-1', 'FIC-2', 'CTE-1'],
        'N': ['TWR-1', 'TWR-2', 'GND-1', 'GND-2', 'DEL-1', 'DEL-2', 'FIC-1', 'FIC-2', 'CTE-1']
    }
    
    # 1. Discover all slots for each day and shift
    day_shift_slots = {}
    for d in days:
        day_shift_slots[d] = {}
        is_h = is_colombian_holiday(d, holidays)
        for s in shifts_list:
            # If not holiday, standard slots are required. If holiday, no slots are required by default.
            slots = list(standard_slots[s]) if not is_h else []
            # Keep preset assignments (even on holidays or custom positions)
            preset_slots = current_schedule.get(d, {}).get(s, {}) if current_schedule else {}
            for slot_key, assigned_c_id in preset_slots.items():
                if assigned_c_id and slot_key not in slots:
                    slots.append(slot_key)
            day_shift_slots[d][s] = slots

    # 2. Decision Variables: x[(c_id, d, s, slot)] -> 0 or 1
    # Also create unassigned[d, s, slot] to allow partial solutions if short-staffed
    x = {}
    unassigned = {}
    
    controllers_by_id = {c['id']: c for c in controllers}
    controller_ids = [c['id'] for c in controllers]
    
    for d in days:
        is_h = is_colombian_holiday(d, holidays)
        for s in shifts_list:
            for slot in day_shift_slots[d][s]:
                # Boolean variable for unassigned slot
                unassigned[d, s, slot] = model.NewBoolVar(f"unassigned_{d}_{s}_{slot}")
                
                # Check preset assignment
                preset_c_id = None
                if current_schedule and d in current_schedule and s in current_schedule[d]:
                    preset_c_id = current_schedule[d][s].get(slot)
                
                for c in controllers:
                    c_id = c['id']
                    
                    # Verify skills and exceptions
                    has_skill = has_certification(c, slot)
                    is_operative = exceptions.get(c_id, {}).get(d, 'OPERATIVO') == 'OPERATIVO'
                    
                    if has_skill and is_operative and c.get('active', True):
                        if preset_c_id:
                            # If slot is preset to this controller, fix to 1. Otherwise fix to 0.
                            val = 1 if preset_c_id == c_id else 0
                            x[c_id, d, s, slot] = model.NewIntVar(val, val, f"x_{c_id}_{d}_{s}_{slot}")
                        else:
                            # Standard optimization variable
                            if is_h:
                                # On holidays, we do not auto-assign new shifts (only keep presets)
                                x[c_id, d, s, slot] = model.NewIntVar(0, 0, f"x_{c_id}_{d}_{s}_{slot}")
                            else:
                                # Regular day variable
                                x[c_id, d, s, slot] = model.NewBoolVar(f"x_{c_id}_{d}_{s}_{slot}")
                    else:
                        # Controller not qualified, inactive, or has exception (Vacation, Leave, Sick)
                        # Fix to 1 if preset despite exception (override), otherwise fix to 0
                        val = 1 if preset_c_id == c_id else 0
                        x[c_id, d, s, slot] = model.NewIntVar(val, val, f"x_{c_id}_{d}_{s}_{slot}")

    # 3. Rule: Cover each required slot
    # Sum(x[c, d, s, slot]) + unassigned[d, s, slot] == 1
    for d in days:
        for s in shifts_list:
            for slot in day_shift_slots[d][s]:
                model.Add(sum(x[c_id, d, s, slot] for c_id in controller_ids) + unassigned[d, s, slot] == 1)

    # 4. Rule: At most one slot assignment per shift per controller
    for c_id in controller_ids:
        for d in days:
            for s in shifts_list:
                model.Add(sum(x[c_id, d, s, slot] for slot in day_shift_slots[d][s]) <= 1)

    # 5. Rule: Maximum of 12 hours (2 shifts) per day per controller
    for c_id in controller_ids:
        for d in days:
            model.Add(sum(x[c_id, d, s, slot] for s in shifts_list for slot in day_shift_slots[d][s]) <= 2)

    # 6. Rule: No dobles (supplementary shifts) on Sundays/Holidays
    for d in days:
        if is_colombian_holiday(d, holidays):
            for c_id in controller_ids:
                model.Add(sum(x[c_id, d, s, slot] for s in shifts_list for slot in day_shift_slots[d][s]) <= 1)

    # 7. Rule: Double shifts must be consecutive (M+T or T+N)
    for c_id in controller_ids:
        for d in days:
            # Cannot work M and N on the same day
            m_shifts = sum(x[c_id, d, 'M', slot] for slot in day_shift_slots[d]['M'])
            n_shifts = sum(x[c_id, d, 'N', slot] for slot in day_shift_slots[d]['N'])
            model.Add(m_shifts + n_shifts <= 1)
            
            # Cannot work A (Madrugada) and any other shift on the same day
            a_shifts = sum(x[c_id, d, 'A', slot] for slot in day_shift_slots[d]['A'])
            other_shifts = sum(x[c_id, d, s, slot] for s in ['M', 'T', 'N'] for slot in day_shift_slots[d][s])
            model.Add(a_shifts + other_shifts <= 1)

    # 8. Rule: Transition Rest Periods (N -> M and T -> A)
    # Cannot work M on day d if worked N on day d-1
    # Cannot work A on day d if worked T on day d-1
    for c_id in controller_ids:
        for i in range(1, len(days)):
            d_prev = days[i-1]
            d_curr = days[i]
            
            n_prev = sum(x[c_id, d_prev, 'N', slot] for slot in day_shift_slots[d_prev]['N'])
            m_curr = sum(x[c_id, d_curr, 'M', slot] for slot in day_shift_slots[d_curr]['M'])
            model.Add(n_prev + m_curr <= 1)
            
            t_prev = sum(x[c_id, d_prev, 'T', slot] for slot in day_shift_slots[d_prev]['T'])
            a_curr = sum(x[c_id, d_curr, 'A', slot] for slot in day_shift_slots[d_curr]['A'])
            model.Add(t_prev + a_curr <= 1)

    # 9. Rule: Weekly Rest Window (Mon-Sat, or Tue-Sat if Monday is a holiday)
    # We group days into weeks
    weeks = {}
    for d in days:
        week_days = get_week_days_of_date(d)
        monday_str = week_days[0]
        if monday_str not in weeks:
            weeks[monday_str] = week_days

    for monday_str, week_days in weeks.items():
        is_monday_h = is_colombian_holiday(monday_str, holidays)
        start_idx = 1 if is_monday_h else 0  # Skip Monday if holiday
        
        # Enforce rests within the Mon-Sat (or Tue-Sat) window
        window_days = [week_days[i] for i in range(start_idx, 6) if week_days[i] in days]
        max_days_allowed = 3 if is_monday_h else 4 # Ventana de 5 dias (max 3 trab) o 6 dias (max 4 trab)
        
        if len(window_days) > max_days_allowed:
            for c_id in controller_ids:
                # worked_days[d] is 1 if controller works at least one shift on day d
                worked_days = []
                for wd in window_days:
                    w_var = model.NewBoolVar(f"worked_{c_id}_{wd}")
                    day_shifts = [x[c_id, wd, s, slot] for s in shifts_list for slot in day_shift_slots[wd][s]]
                    if day_shifts:
                        # w_var == Max(day_shifts)
                        model.AddMaxConstraint(w_var, day_shifts)
                        worked_days.append(w_var)
                
                if worked_days:
                    model.Add(sum(worked_days) <= max_days_allowed)

    # 10. Rule: Limit of 8 double shifts per month
    # A double shift occurs when sum(shifts on day d) == 2
    for c_id in controller_ids:
        double_shift_vars = []
        for d in days:
            day_shifts = [x[c_id, d, s, slot] for s in shifts_list for slot in day_shift_slots[d][s]]
            if day_shifts:
                is_double_var = model.NewBoolVar(f"is_double_{c_id}_{d}")
                sum_shifts = sum(day_shifts)
                
                # is_double_var == 1 if and only if sum_shifts == 2
                model.Add(sum_shifts == 2).OnlyEnforceIf(is_double_var)
                model.Add(sum_shifts <= 1).OnlyEnforceIf(is_double_var.Not())
                double_shift_vars.append(is_double_var)
        
        if double_shift_vars:
            model.Add(sum(double_shift_vars) <= 8)

    # 11. Objective Function Elements
    # A. Unassigned penalty (avoiding empty slots)
    sum_unassigned = sum(unassigned[d, s, slot] for d in days for s in shifts_list for slot in day_shift_slots[d][s])
    
    # B. Workload fairness (Minimizing max_total - min_total shifts)
    total_assigned = {}
    for c_id in controller_ids:
        total_assigned[c_id] = sum(x[c_id, d, s, slot] for d in days for s in shifts_list for slot in day_shift_slots[d][s])
        
    min_total = model.NewIntVar(0, len(days) * 2, "min_total")
    max_total = model.NewIntVar(0, len(days) * 2, "max_total")
    
    for c_id in controller_ids:
        model.Add(total_assigned[c_id] >= min_total)
        model.Add(total_assigned[c_id] <= max_total)
        
    fairness_diff = max_total - min_total

    # C. Minimize double shifts
    all_double_shifts = []
    for c_id in controller_ids:
        for d in days:
            day_shifts = [x[c_id, d, s, slot] for s in shifts_list for slot in day_shift_slots[d][s]]
            if day_shifts:
                is_double_var = model.NewBoolVar(f"is_double_obj_{c_id}_{d}")
                sum_shifts = sum(day_shifts)
                model.Add(sum_shifts == 2).OnlyEnforceIf(is_double_var)
                model.Add(sum_shifts <= 1).OnlyEnforceIf(is_double_var.Not())
                all_double_shifts.append(is_double_var)
                
    sum_doubles = sum(all_double_shifts) if all_double_shifts else 0

    # D. Soft sequence pattern matching (Maximizing alignment)
    # We penalize mismatches
    mismatches = []
    
    for c_idx, c in enumerate(controllers):
        c_id = c['id']
        for d in days:
            # Sequence pattern on non-holidays
            if is_colombian_holiday(d, holidays):
                continue
                
            seq_idx = get_sequence_day_index(c_idx, d)
            pref = sequence_pattern[seq_idx] if seq_idx < len(sequence_pattern) else 'DESCANSO'
            
            day_shifts = [x[c_id, d, s, slot] for s in shifts_list for slot in day_shift_slots[d][s]]
            if not day_shifts:
                continue
                
            sum_shifts = sum(day_shifts)
            is_mismatch = model.NewBoolVar(f"mismatch_{c_id}_{d}")
            
            if pref == 'DESCANSO':
                # Mismatch if they work
                model.Add(sum_shifts == 0).OnlyEnforceIf(is_mismatch.Not())
                model.Add(sum_shifts >= 1).OnlyEnforceIf(is_mismatch)
            elif pref == 'M':
                # Mismatch if M is not worked
                m_shifts = sum(x[c_id, d, 'M', slot] for slot in day_shift_slots[d]['M'])
                model.Add(m_shifts == 1).OnlyEnforceIf(is_mismatch.Not())
                model.Add(m_shifts == 0).OnlyEnforceIf(is_mismatch)
            elif pref == 'T':
                # Mismatch if T is not worked
                t_shifts = sum(x[c_id, d, 'T', slot] for slot in day_shift_slots[d]['T'])
                model.Add(t_shifts == 1).OnlyEnforceIf(is_mismatch.Not())
                model.Add(t_shifts == 0).OnlyEnforceIf(is_mismatch)
            elif pref == 'N':
                # Mismatch if N is not worked
                n_shifts = sum(x[c_id, d, 'N', slot] for slot in day_shift_slots[d]['N'])
                model.Add(n_shifts == 1).OnlyEnforceIf(is_mismatch.Not())
                model.Add(n_shifts == 0).OnlyEnforceIf(is_mismatch)
            elif pref == 'M+T':
                # Mismatch if they don't work both M and T
                m_shifts = sum(x[c_id, d, 'M', slot] for slot in day_shift_slots[d]['M'])
                t_shifts = sum(x[c_id, d, 'T', slot] for slot in day_shift_slots[d]['T'])
                model.Add(m_shifts + t_shifts == 2).OnlyEnforceIf(is_mismatch.Not())
                model.Add(m_shifts + t_shifts <= 1).OnlyEnforceIf(is_mismatch)
            elif pref == 'T+N':
                # Mismatch if they don't work both T and N
                t_shifts = sum(x[c_id, d, 'T', slot] for slot in day_shift_slots[d]['T'])
                n_shifts = sum(x[c_id, d, 'N', slot] for slot in day_shift_slots[d]['N'])
                model.Add(t_shifts + n_shifts == 2).OnlyEnforceIf(is_mismatch.Not())
                model.Add(t_shifts + n_shifts <= 1).OnlyEnforceIf(is_mismatch)
            else:
                # Any other pattern value, no mismatch rule defined
                model.Add(is_mismatch == 0)
                
            mismatches.append(is_mismatch)

    sum_mismatches = sum(mismatches) if mismatches else 0

    # Hierarchical minimization objective function:
    # 1. Primary: Keep required slots filled (weight: 1,000,000)
    # 2. Secondary: Balance shift counts (weight: 10,000)
    # 3. Tertiary: Minimize double shifts (weight: 100)
    # 4. Quaternary: Follow sequence pattern (weight: 1)
    model.Minimize(
        1000000 * sum_unassigned +
        10000 * fairness_diff +
        100 * sum_doubles +
        1 * sum_mismatches
    )

    # Solve the model
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 15.0  # Limit to 15 seconds
    
    status = solver.Solve(model)
    
    status_label = "INFEASIBLE"
    if status == cp_model.OPTIMAL:
        status_label = "OPTIMAL"
    elif status == cp_model.FEASIBLE:
        status_label = "FEASIBLE"
        
    # Reconstruct schedule output
    solution_schedule = {}
    for d in days:
        solution_schedule[d] = {}
        for s in shifts_list:
            solution_schedule[d][s] = {}
            for slot in day_shift_slots[d][s]:
                assigned_c_id = None
                for c_id in controller_ids:
                    # Check if variable exists and is 1
                    var_key = (c_id, d, s, slot)
                    if var_key in x and solver.Value(x[var_key]) == 1:
                        assigned_c_id = c_id
                        break
                solution_schedule[d][s][slot] = assigned_c_id

    return {
        "status": status_label,
        "schedule": solution_schedule,
        "metrics": {
            "unassigned_slots": int(solver.Value(sum_unassigned)) if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else -1,
            "fairness_diff": int(solver.Value(fairness_diff)) if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else -1,
            "double_shifts": int(solver.Value(sum_doubles)) if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else -1,
            "pattern_mismatches": int(solver.Value(sum_mismatches)) if status in [cp_model.OPTIMAL, cp_model.FEASIBLE] else -1,
        }
    }
