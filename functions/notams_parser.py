import re
import datetime
import tempfile
import urllib.request
import ssl
from curl_cffi import requests
from firebase_admin import firestore
import pypdf

FAA_SEARCH_URL = "https://notams.aim.faa.gov/notamSearch/search"
AEROCIVIL_CHARLIE1_URL = "https://www.aerocivil.gov.co/loader.php?lServicio=Tools2&lTipo=descargas&lFuncion=descargar&idFile=12065"

# Location designators groups
COLOMBIA_ICAOS = [
    'SKUC', 'SKAR', 'SKBS', 'SKEJ', 'SKBQ', 'SKBO', 'SKBG', 'SKBU',
    'SKCL', 'SKLC', 'SKCG', 'SKGO', 'SKGY', 'SKCZ', 'SKCC', 'SKYP',
    'SKFL', 'SKGI', 'SKGP', 'SKIB', 'SKPD', 'SKIP', 'SKLT', 'SKMZ',
    'SKQU', 'SKMD', 'SKMU', 'SKMR', 'SKNV', 'SKPS', 'SKPE', 'SKPP',
    'SKPV', 'SKAS', 'SKPC', 'SKUI', 'SKRH', 'SKRG', 'SKSP', 'SKSJ',
    'SKSM', 'SKSA', 'SKTM', 'SKCO', 'SKVP', 'SKVV', 'SKAG',
    'SKHA', 'SKNA', 'SKLM','SKNQ',
    'SKOC', 'SKPA', 'SKPI', 'SKPB', 'SKMO', 'SKLG', 'SKSG', 'SKSV',
    'SKTL', 'SKUL', 'SKVG', 'SKEC', 'SKED'
]

# FIRs adyacentes internacionales para consultar exclusivamente CTL FLOW en la FAA
NEIGHBOR_FIRS_FAA = ['SPIM', 'SEFG', 'SVZM', 'SBMN', 'SBCW', 'MKJK']


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


def parse_aerocivil_date(date_str):
    """
    Parses Aerocivil YYMMDDHHMM date format (e.g. '2608010500' -> ISO)
    """
    if not date_str:
        return ''
    date_str = date_str.strip()
    if 'PERM' in date_str.upper():
        return 'PERM'
    m = re.match(r'^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})', date_str)
    if m:
        yy, mm, dd, hh, min_ = m.groups()
        yyyy = int('20' + yy)
        try:
            dt = datetime.datetime(yyyy, int(mm), int(dd), int(hh), int(min_), tzinfo=datetime.timezone.utc)
            return dt.isoformat()
        except ValueError:
            pass
    return date_str


RE_AD_RWY_CLSD = re.compile(r'\b(AD|RWY|AERODROME|AEROPUERTO|PISTA)\b.*\b(CLSD|CLOSED|CERRAD[AO])\b', re.IGNORECASE)


def categorize_notam(desc, Q_code='', scope='SKBO'):
    d = desc.upper()
    if 'ASHTAM' in d or 'VOLCANO' in d or 'VOLCANIC' in d or 'CENIZA' in d or 'ERUPTION' in d or 'QWA' in Q_code or 'QWV' in Q_code:
        return 'ASHTAM'
    if RE_AD_RWY_CLSD.search(d):
        return 'AD_CLSD'
    if 'FLOW' in d or 'ATFM' in d or 'REGULATION' in d or 'SLOT' in d or 'CAPACITY' in d or 'RATE' in d or 'FLUJO' in d or 'CTL FLOW' in d:
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
    if 'WIP' in d or 'LIMIT' in d or 'LTD' in d or 'MAINT' in d or 'OBST' in d or 'AVBL' in d or 'CHG' in d or 'DUE TO' in d or 'CTL FLOW' in d or 'FLUJO' in d:
        return 'WARNING'
    return 'INFO'


def fetch_aerocivil_charlie1_notams():
    """
    Downloads and parses Charlie1.pdf from Aerocivil (Serie C/D national NOTAMs).
    Extracts SKBO, SKEC (FIR Bogota), and national airports (CLD, CTL FLOW, RWY, NAV, etc.).
    """
    print("Fetching Aerocivil Charlie1.pdf...")
    pdf_bytes = None
    
    # Try fetching with retries
    for attempt in range(1, 4):
        try:
            r = requests.get(
                AEROCIVIL_CHARLIE1_URL,
                headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'},
                impersonate='chrome',
                timeout=25
            )
            if r.status_code == 200 and len(r.content) > 1000:
                pdf_bytes = r.content
                break
        except Exception as e:
            print(f"curl_cffi attempt {attempt} failed: {e}")
        
        try:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            req = urllib.request.Request(
                AEROCIVIL_CHARLIE1_URL,
                headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
            )
            with urllib.request.urlopen(req, context=ctx, timeout=25) as resp:
                data = resp.read()
                if len(data) > 1000:
                    pdf_bytes = data
                    break
        except Exception as e:
            print(f"urllib attempt {attempt} failed: {e}")
            
        import time
        time.sleep(2)

    if not pdf_bytes or len(pdf_bytes) < 1000:
        print("Aerocivil PDF content empty or too small.")
        return []

    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=True) as tmp_file:
        tmp_file.write(pdf_bytes)
        tmp_file.flush()
        
        try:
            reader = pypdf.PdfReader(tmp_file.name)
            notams = []
            current = None

            for page in reader.pages:
                layout_text = page.extract_text(extraction_mode='layout')
                for line in layout_text.split('\n'):
                    # Check for NOTAM header: 'C  1204  /  25' or 'D  0609  /  26'
                    m = re.match(r'^([CD])\s*(\d{4})\s*/\s*(\d{2})\s*(.*)', line)
                    if m:
                        if current and current['id']:
                            notams.append(current)
                        series, num, yr, rest = m.groups()
                        notam_id = f'{series}{num}/{yr}'
                        rest_clean = rest.strip()
                        
                        icao_m = re.search(r'\(([A-Z]{4})\)', rest_clean)
                        if icao_m:
                            icao = icao_m.group(1)
                            airport_name = rest_clean
                        elif 'FIR' in rest_clean.upper() and 'BOGOTA' in rest_clean.upper():
                            icao = 'SKED'
                            airport_name = 'FIR/UIR BOGOTA (SKED)'
                        elif 'FIR' in rest_clean.upper() and 'BARRANQUILLA' in rest_clean.upper():
                            icao = 'SKEC'
                            airport_name = 'FIR/UIR BARRANQUILLA (SKEC)'
                        else:
                            icao = 'SKBO'
                            airport_name = rest_clean if rest_clean else 'SKBO'
                        
                        current = {
                            'id': notam_id,
                            'airport': icao,
                            'airportName': airport_name,
                            'dates_raw': '',
                            'start_date': '',
                            'end_date': '',
                            'schedule': '',
                            'description': [],
                            'replaces': '',
                            'source': 'AEROCIVIL_CHARLIE1'
                        }
                        continue

                    if current:
                        # Ignore common header/footer strings in Aerocivil PDF
                        if any(k in line for k in ['TODAS LAS HORAS SON UTC', 'RESUMEN MENSUAL', 'REPUBLICA DE COLOMBIA', 'Unidad Administrativa', 'AERONAUTICA CIVIL', 'SERIE CHARLIE']):
                            continue

                        # Check for dates line e.g. '2606022300 /  2608311100  2300-2359'
                        date_m = re.search(r'(\d{10}|\d{6})\s*/\s*(\d{10}|PERM|EST)', line)
                        if date_m and not current['dates_raw']:
                            current['dates_raw'] = line.strip()
                            parts = line.strip().split('/')
                            if len(parts) >= 2:
                                start_raw = parts[0].strip()
                                rest_parts = parts[1].strip().split()
                                end_raw = rest_parts[0] if rest_parts else ''
                                sched_raw = ' '.join(rest_parts[1:]) if len(rest_parts) > 1 else ''
                                
                                current['start_date'] = parse_aerocivil_date(start_raw)
                                current['end_date'] = parse_aerocivil_date(end_raw)
                                current['schedule'] = sched_raw.replace(',', '').strip()
                            continue

                        # Check for RPLC line
                        if 'RPLC' in line and 'NOTAM' in line:
                            r_m = re.search(r'RPLC\s+NOTAM\s+([CD]\s*\d{4}\s*/\s*\d{2})', line)
                            if r_m:
                                current['replaces'] = r_m.group(1).replace(' ', '')
                            continue

                        clean = line.strip()
                        if clean:
                            current['description'].append(clean)

            if current and current['id']:
                notams.append(current)

            # Post-process descriptions and categories
            for n in notams:
                n['description'] = ' '.join(n['description']).strip()
                n['category'] = categorize_notam(n['description'], scope=n['airport'])
                n['severity'] = determine_severity(n['description'])

            print(f"Aerocivil Charlie1 parsed successfully: {len(notams)} NOTAMs extracted.")
            return notams

        except Exception as e:
            print(f"Error parsing Aerocivil Charlie1 PDF: {e}")
            return []


def fetch_faa_notams_by_designator(designator):
    """
    Fetches active NOTAMs for a single FIR/location designator using curl_cffi with Chrome TLS impersonation.
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
            print(f"Error fetching NOTAMs from FAA for {designator}: {e}")
            break
    return all_notams


def normalize_faa_notam(item, default_scope='FLOW_NEIGHBOR_FIRS'):
    """
    Normalizes raw FAA NOTAM JSON object into AirControl structured NOTAM schema.
    """
    notam_id = item.get('notamNumber') or item.get('id') or 'UNKNOWN'
    location = item.get('facilityDesignator') or item.get('icaoId') or default_scope
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
    Fetches NOTAMs strictly according to source allocation:
    1. Aerocivil Colombia (Charlie1.pdf):
       - SKBO (El Dorado)
       - SKEC (FIR Bogota)
       - Cierres de pista/aeródromo (CLD / AD_CLSD) en aeropuertos nacionales.
       - Control de flujo (CTL FLOW / ATFM) en aeropuertos nacionales.
    2. FAA Search API:
       - FIRs adyacentes internacionales (SPIM, SEFG, SVZM, SBMN, SBCW, MKJK) exclusivamente referentes a CTL FLOW.
    Stores the unified dataset in settings/notams_skbo.
    """
    # 1. Fetch Aerocivil Charlie1 NOTAMs
    aerocivil_notams = fetch_aerocivil_charlie1_notams()
    
    skbo_notams = []
    colombia_ad_clsd = []
    flow_notams = []
    ashtam_notams = []
    
    seen_ids = set()

    for n in aerocivil_notams:
        nid = n['id']
        seen_ids.add(nid)
        desc_upper = n['description'].upper()
        
        # Check for ASHTAM / Volcanic activity
        if n['category'] == 'ASHTAM' or 'ASHTAM' in desc_upper or 'VOLCANO' in desc_upper or 'VOLCANIC' in desc_upper or 'CENIZA' in desc_upper:
            norm_ash = dict(n)
            norm_ash['scope'] = 'ASHTAM'
            norm_ash['category'] = 'ASHTAM'
            ashtam_notams.append(norm_ash)

        # Check for CTL FLOW / Control de Flujo across national airports & FIRs (SKBO, SKEC, etc.)
        if n['category'] == 'FLOW' or 'FLOW' in desc_upper or 'FLUJO' in desc_upper or 'CTL FLOW' in desc_upper or 'ATFM' in desc_upper or 'REGULATION' in desc_upper:
            norm_flow = dict(n)
            norm_flow['scope'] = 'FLOW'
            norm_flow['category'] = 'FLOW'
            flow_notams.append(norm_flow)

        if n['airport'] == 'SKBO':
            n['scope'] = 'SKBO'
            skbo_notams.append(n)
        else:
            # Check strictly for AD CLSD or RWY CLSD in national airports (e.g. RWY 04/22 CLSD)
            if RE_AD_RWY_CLSD.search(desc_upper):
                norm_clsd = dict(n)
                norm_clsd['scope'] = 'AD_CLSD_COLOMBIA'
                norm_clsd['category'] = 'AD_CLSD'
                colombia_ad_clsd.append(norm_clsd)

    # 2. Fetch FAA NOTAMs strictly for CTL FLOW in Neighbor FIRs (SPIM, SEFG, SVZM, SBMN, SBCW, MKJK)
    print(f"Fetching CTL FLOW NOTAMs from FAA for neighbor FIRs: {NEIGHBOR_FIRS_FAA}...")
    for fir in NEIGHBOR_FIRS_FAA:
        raw_items = fetch_faa_notams_by_designator(fir)
        for item in raw_items:
            nid = item.get('notamNumber') or item.get('id')
            if not nid or nid in seen_ids:
                continue
            norm = normalize_faa_notam(item, default_scope='FLOW_NEIGHBOR_FIRS')
            desc_upper = norm['description'].upper()
            
            if 'ASHTAM' in desc_upper or 'VOLCANO' in desc_upper or 'VOLCANIC' in desc_upper:
                norm_ash = dict(norm)
                norm_ash['scope'] = 'ASHTAM'
                ashtam_notams.append(norm_ash)
                seen_ids.add(nid)

            # Strictly filter for CTL FLOW / ATFM / REGULATION / SLOT / FLOW
            if 'FLOW' in desc_upper or 'CTL FLOW' in desc_upper or 'ATFM' in desc_upper or 'REGULATION' in desc_upper or 'SLOT' in desc_upper or 'RATE' in desc_upper:
                norm['category'] = 'FLOW'
                flow_notams.append(norm)
                seen_ids.add(nid)

    # If SKBO is empty from Aerocivil, fallback to FAA search for SKBO
    if not skbo_notams:
        print("Fallback: SKBO not found in Aerocivil, querying FAA Search API...")
        skbo_faa_raw = fetch_faa_notams_by_designator('SKBO')
        skbo_notams = [normalize_faa_notam(item, default_scope='SKBO') for item in skbo_faa_raw]

    # Persist in Firestore settings/notams_skbo
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        from firebase_admin import _apps, initialize_app
        if not _apps:
            initialize_app()
        db = firestore.client()
        
        doc_data = {
            'notams': skbo_notams,
            'adClosedNotams': colombia_ad_clsd,
            'flowNotams': flow_notams,
            'ashtamNotams': ashtam_notams,
            'lastUpdated': now_iso,
            'pdfUrl': AEROCIVIL_CHARLIE1_URL,
            'source': 'AEROCIVIL_CHARLIE1 + FAA_SEARCH'
        }
        
        db.collection('settings').document('notams_skbo').set(doc_data)
        print(f"Firestore updated successfully. SKBO: {len(skbo_notams)}, AD Closed: {len(colombia_ad_clsd)}, Flow: {len(flow_notams)}, Ashtams: {len(ashtam_notams)}")
    except Exception as e:
        print(f"Firestore update skipped (local environment without GCP credentials): {e}")

    return {
        "success": True,
        "count": len(skbo_notams),
        "countAdClosed": len(colombia_ad_clsd),
        "countFlow": len(flow_notams),
        "countAshtam": len(ashtam_notams),
        "lastUpdated": now_iso,
        "source": "AEROCIVIL_CHARLIE1 + FAA_SEARCH"
    }


if __name__ == "__main__":
    print("Testing sync_skbo_notams()...")
    res = sync_skbo_notams()
    print("Sync result:", res)
