import re
import datetime
from curl_cffi import requests
from firebase_admin import firestore

FAA_SEARCH_URL = "https://notams.aim.faa.gov/notamSearch/search"

# Location designators groups
COLOMBIA_ICAOS = [
    'SKUC', 'SKAR', 'SKBS', 'SKEJ', 'SKBQ', 'SKBO', 'SKBG', 'SKBU',
    'SKCL', 'SKLC', 'SKCG', 'SKGO', 'SKGY', 'SKCZ', 'SKCC', 'SKYP',
    'SKFL', 'SKGI', 'SKGP', 'SKIB', 'SKPD', 'SKIP', 'SKLT', 'SKMZ',
    'SKQU', 'SKMD', 'SKMU', 'SKMR', 'SKNV', 'SKPS', 'SKPE', 'SKPP',
    'SKPV', 'SKAS', 'SKPC', 'SKUI', 'SKRH', 'SKRG', 'SKSP', 'SKSJ',
    'SKSM', 'SKSA', 'SKTM', 'SKCO', 'SKVP', 'SKVV', 'SKAG', 'SQHK',
    'SKHA', 'SKEB', 'SKNA', 'SKMG', 'SKLM', 'SKMP', 'SKML', 'SKNQ',
    'SKOC', 'SKPA', 'SKPI', 'SKPB', 'SKMO', 'SKLG', 'SKSG', 'SKSV',
    'SQUJ', 'SKTL', 'SKUL', 'SKVG'
]

NEIGHBOR_FIRS = ['SKEC', 'SPIM', 'SEFG', 'SVZM', 'SBMN', 'SBCW', 'MKJK']


def parse_faa_date(date_str):
    if not date_str:
        return ''
    date_str = date_str.strip()
    if 'PERM' in date_str.upper():
        return 'PERM'
    # Try MM/DD/YYYY HHMM format from FAA (e.g. "08/11/2016 0000")
    m = re.match(r'^(\d{2})/(\d{2})/(\d{4})\s+(\d{2})(\d{2})', date_str)
    if m:
        mm, dd, yyyy, hh, min_ = m.groups()
        try:
            dt = datetime.datetime(int(yyyy), int(mm), int(dd), int(hh), int(min_), tzinfo=datetime.timezone.utc)
            return dt.isoformat()
        except ValueError:
            pass
    return date_str


def categorize_notam(desc, Q_code='', scope='SKBO'):
    d = desc.upper()
    if 'ASHTAM' in d or 'VOLCANO' in d or 'VOLCANIC' in d or 'CENIZA' in d or 'ERUPTION' in d or 'QWA' in Q_code or 'QWV' in Q_code:
        return 'ASHTAM'
    if 'AD CLSD' in d or 'AERODROME CLOSED' in d or 'AD CLOSED' in d or 'PISTA CERRADA' in d:
        return 'AD_CLSD'
    if 'FLOW' in d or 'ATFM' in d or 'REGULATION' in d or 'SLOT' in d or 'CAPACITY' in d or 'RATE' in d:
        return 'FLOW'
    if 'RWY' in d or 'RUNWAY' in d or 'PISTA' in d or 'QMR' in Q_code:
        return 'RWY'
    if 'TWY' in d or 'TXY' in d or 'TAXIWAY' in d or 'RODAJE' in d or 'QMX' in Q_code:
        return 'TXY'
    if 'SID' in d or 'STAR' in d or 'APP' in d or 'APPROACH' in d or 'PROC' in d or 'QPI' in Q_code or 'QPA' in Q_code:
        return 'SID_STAR_APP'
    if 'ILS' in d or 'ALS' in d or 'VOR' in d or 'DME' in d or 'GP' in d or 'LLZ' in d or 'ATIS' in d or 'NDB' in d or 'FREQ' in d or 'FRECUENCIA' in d or 'QIC' in Q_code or 'QNV' in Q_code:
        return 'NAV_AIDS'
    if 'LVP' in d or 'LOW VISIBILITY' in d or 'VISIBILIDAD' in d:
        return 'LVP'
    return 'MISC'


def determine_severity(desc):
    d = desc.upper()
    if 'ASHTAM' in d or 'VOLCANO' in d or 'VOLCANIC' in d or 'ERUPTION' in d:
        return 'CRITICAL'
    if 'CLSD' in d or 'CLOSED' in d or 'CIERRE' in d or 'UNSERVICEABLE' in d or 'U/S' in d or 'PROHIBITED' in d or 'CANCEL' in d:
        return 'CRITICAL'
    if 'WIP' in d or 'LIMIT' in d or 'LTD' in d or 'MAINT' in d or 'OBST' in d or 'AVBL' in d or 'CHG' in d or 'DUE TO' in d:
        return 'WARNING'
    return 'INFO'


def fetch_faa_notams_by_designator(designator):
    """
    Fetches all active NOTAMs for a single location designator using curl_cffi with Chrome TLS impersonation.
    """
    headers = {
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Origin': 'https://notams.aim.faa.gov',
        'Referer': 'https://notams.aim.faa.gov/notamSearch/nsapp.html',
        'X-Requested-With': 'XMLHttpRequest'
    }
    all_notams = []
    offset = 0
    while True:
        data = {
            'searchType': 0,
            'designatorsForLocation': designator,
            'offset': offset
        }
        try:
            r = requests.post(FAA_SEARCH_URL, data=data, headers=headers, impersonate='chrome', timeout=15)
            if r.status_code != 200:
                break
            res = r.json()
            items = res.get('notamList', [])
            if not items:
                break
            all_notams.extend(items)
            total = res.get('totalNotamCount', 0)
            offset += len(items)
            if offset >= total or len(items) == 0:
                break
        except Exception as e:
            print(f"Error fetching NOTAMs for {designator}: {e}")
            break
    return all_notams


def normalize_faa_notam(item, default_scope='SKBO'):
    """
    Normalizes raw FAA NOTAM JSON object into AirControl structured NOTAM schema.
    """
    notam_id = item.get('notamNumber') or item.get('id') or 'UNKNOWN'
    location = item.get('facilityDesignator') or item.get('icaoId') or 'SKBO'
    airport_name = item.get('airportName') or location
    
    icao_msg = item.get('icaoMessage') or ''
    trad_msg = item.get('traditionalMessageFrom4thWord') or item.get('traditionalMessage') or item.get('plainLanguageMessage') or ''
    
    full_text = (icao_msg + "\n" + trad_msg).strip() if icao_msg else trad_msg.strip()
    if not full_text:
        full_text = item.get('text') or item.get('description') or 'No description text'
        
    start_date_raw = item.get('startDate') or ''
    end_date_raw = item.get('endDate') or ''
    issue_date_raw = item.get('issueDate') or ''
    
    start_iso = parse_faa_date(start_date_raw)
    end_iso = parse_faa_date(end_date_raw)
    issue_iso = parse_faa_date(issue_date_raw)
    
    dates_raw = f"{start_date_raw} - {end_date_raw}".strip(" -")
    
    schedule = ''
    # Check for D) field schedule in ICAO message
    sched_match = re.search(r'\bD\)\s*([^\n]+)', icao_msg)
    if sched_match:
        schedule = sched_match.group(1).strip()
        
    category = categorize_notam(full_text, scope=default_scope)
    severity = determine_severity(full_text)
    
    return {
        "id": notam_id,
        "airport": location,
        "airportName": airport_name,
        "dates_raw": dates_raw,
        "start_date": start_iso,
        "end_date": end_iso,
        "issue_date": issue_iso,
        "schedule": schedule,
        "description": full_text,
        "category": category,
        "severity": severity,
        "scope": default_scope,
        "source": "FAA_NOTAM_SEARCH"
    }


def sync_skbo_notams():
    """
    Fetches NOTAMs for:
    1. SKBO (Eldorado)
    2. Colombia AD CLSD (Airport closures in Colombia)
    3. FLOW in Neighbor FIRs (SKEC, SPIM, SEFG, SVZM, SBMN/SBCW, MKJK)
    Stores the unified dataset in settings/notams_skbo.
    """
    # 1. SKBO NOTAMs
    skbo_raw = fetch_faa_notams_by_designator('SKBO')
    skbo_notams = [normalize_faa_notam(item, default_scope='SKBO') for item in skbo_raw]
    
    # 2. Colombia AD CLSD & ASHTAM NOTAMs
    colombia_ad_clsd = []
    colombia_ashtams = []
    seen_ids = set(n['id'] for n in skbo_notams)
    
    for icao in COLOMBIA_ICAOS:
        raw_items = fetch_faa_notams_by_designator(icao)
        for item in raw_items:
            nid = item.get('notamNumber') or item.get('id')
            if not nid:
                continue
            norm = normalize_faa_notam(item, default_scope='AD_CLSD_COLOMBIA')
            desc_upper = norm['description'].upper()
            
            # Check for ASHTAM / Volcanic Activity
            if 'ASHTAM' in desc_upper or 'VOLCANO' in desc_upper or 'VOLCANIC' in desc_upper or 'ERUPTION' in desc_upper or 'VA CLD' in desc_upper or 'CENIZA' in desc_upper:
                norm_ash = dict(norm)
                norm_ash['scope'] = 'ASHTAM_COLOMBIA'
                norm_ash['category'] = 'ASHTAM'
                norm_ash['severity'] = 'CRITICAL'
                colombia_ashtams.append(norm_ash)
                
            if icao != 'SKBO' and nid not in seen_ids:
                if 'AD CLSD' in desc_upper or 'AERODROME CLOSED' in desc_upper or 'AD CLOSED' in desc_upper or 'PISTA CERRADA' in desc_upper or 'RWY CLSD' in desc_upper:
                    norm['category'] = 'AD_CLSD'
                    norm['severity'] = 'CRITICAL'
                    colombia_ad_clsd.append(norm)
                    seen_ids.add(nid)
                
    # 3. FLOW NOTAMs in Neighbor FIRs
    neighbor_flow_notams = []
    for fir in NEIGHBOR_FIRS:
        raw_items = fetch_faa_notams_by_designator(fir)
        for item in raw_items:
            nid = item.get('notamNumber') or item.get('id')
            if not nid or nid in seen_ids:
                continue
            norm = normalize_faa_notam(item, default_scope='FLOW_NEIGHBOR_FIRS')
            desc_upper = norm['description'].upper()
            if 'FLOW' in desc_upper:
                norm['category'] = 'FLOW'
                neighbor_flow_notams.append(norm)
                seen_ids.add(nid)
                
    # Persist in Firestore settings/notams_skbo
    try:
        from firebase_admin import _apps, initialize_app
        if not _apps:
            initialize_app()
        db = firestore.client()
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        doc_data = {
            'notams': skbo_notams,
            'adClosedNotams': colombia_ad_clsd,
            'flowNotams': neighbor_flow_notams,
            'ashtamNotams': colombia_ashtams,
            'lastUpdated': now_iso,
            'pdfUrl': 'https://notams.aim.faa.gov/notamSearch/nsapp.html#/',
            'source': 'FAA_NOTAM_SEARCH'
        }
        
        db.collection('settings').document('notams_skbo').set(doc_data)
    except Exception as e:
        print(f"Firestore update skipped (local environment without GCP credentials): {e}")
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    return {
        "success": True,
        "count": len(skbo_notams),
        "countAdClosed": len(colombia_ad_clsd),
        "countFlow": len(neighbor_flow_notams),
        "countAshtam": len(colombia_ashtams),
        "lastUpdated": now_iso,
        "source": "FAA_NOTAM_SEARCH"
    }

if __name__ == "__main__":
    print("Testing sync_skbo_notams()...")
    res = sync_skbo_notams()
    print("Sync result:", res)
