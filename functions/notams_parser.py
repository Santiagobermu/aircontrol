import requests
import re
import datetime
from bs4 import BeautifulSoup
from pypdf import PdfReader
from firebase_admin import firestore

URL_AEROCIVIL_NOTAMS = "https://www.aerocivil.gov.co/publicaciones/3708/listas-de-verificacion-y-listas-de-notam-validos/"

def fetch_charlie2_pdf_url():
    """
    Scrapes the Aerocivil webpage to find the current download link for Charlie2.pdf.
    """
    res = requests.get(URL_AEROCIVIL_NOTAMS, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
    if res.status_code != 200:
        raise Exception(f"Failed to fetch Aerocivil page. Status code: {res.status_code}")
    
    soup = BeautifulSoup(res.text, 'html.parser')
    for a in soup.find_all('a', href=True):
        strong = a.find('strong')
        text = strong.text if strong else a.text
        if "Charlie2.pdf" in text:
            link = a['href']
            # Convert to absolute URL if needed
            if not link.startswith("http"):
                link = "https://www.aerocivil.gov.co" + link
            return link
            
    raise Exception("Charlie2.pdf link not found on Aerocivil page.")

def parse_notams_from_pdf(pdf_url):
    """
    Downloads the PDF from the given URL and parses all active NOTAMs belonging to SKBO.
    """
    res = requests.get(pdf_url, headers={"User-Agent": "Mozilla/5.0"}, timeout=30)
    if res.status_code != 200:
        raise Exception(f"Failed to download PDF from {pdf_url}. Status code: {res.status_code}")
    
    # Save temporarily or read directly from bytes
    import io
    pdf_file = io.BytesIO(res.content)
    reader = PdfReader(pdf_file)
    
    notams = []
    current_notam = None
    
    # Regex to identify NOTAM header (e.g. "   C 5572/   25            BOGOTÁ, D.C./BOGOTA - EL DORADO LUIS CARLOS (SKBO)")
    header_re = re.compile(r'^\s*([A-Z])\s+(\d{4})\/\s+(\d{2})\s+(.+)$')
    
    # Regex to identify date line (e.g. "                           2601220000  PERM  ,")
    # Starts with spaces, then a 10-digit number (YYMMDDHHMM)
    date_re = re.compile(r'^\s*(\d{10})\s+(PERM|\d{10}|\/)\s*(.*)$')
    
    for page in reader.pages:
        text = page.extract_text(extraction_mode="layout")
        lines = text.split('\n')
        
        for line in lines:
            if not line.strip():
                continue
                
            header_match = header_re.match(line)
            if header_match:
                # Save previous NOTAM if it is for SKBO
                if current_notam and "SKBO" in current_notam["airport"]:
                    notams.append(current_notam)
                
                series = header_match.group(1)
                number = header_match.group(2)
                year = header_match.group(3)
                airport = header_match.group(4).strip()
                
                current_notam = {
                    "id": f"{series}{number}/{year}",
                    "airport": airport,
                    "dates_raw": "",
                    "start_date": "",
                    "end_date": "",
                    "schedule": "",
                    "description_lines": [],
                    "replace_info": ""
                }
                continue
                
            if current_notam:
                stripped_line = line.strip()
                
                # Check for replacements line
                if "RPLC" in line:
                    current_notam["replace_info"] = stripped_line
                    continue
                    
                # Check for date line (only if we haven't set start_date yet)
                date_match = date_re.match(line)
                if date_match and not current_notam["start_date"]:
                    current_notam["dates_raw"] = stripped_line
                    current_notam["start_date"] = date_match.group(1)
                    current_notam["end_date"] = date_match.group(2)
                    extra = date_match.group(3).strip()
                    if extra and extra != ",":
                        current_notam["schedule"] = extra.replace(",", "").strip()
                    continue
                
                # Skip header/footer noise
                if "pag. " in line or "DIRECCION DE INFORMATICA" in line:
                    continue
                    
                # Accumulate description text
                current_notam["description_lines"].append(stripped_line)
                
    # Save the last NOTAM if applicable
    if current_notam and "SKBO" in current_notam["airport"]:
        notams.append(current_notam)
        
    # Clean descriptions
    for n in notams:
        desc = " ".join(n["description_lines"])
        desc = re.sub(r'\s+', ' ', desc)
        desc = desc.strip(" ,")
        n["description"] = desc
        del n["description_lines"]
        
    return notams

def sync_skbo_notams():
    """
    Performs full scraping, downloading, parsing, and sets settings/notams_skbo in Firestore.
    """
    pdf_url = fetch_charlie2_pdf_url()
    notams = parse_notams_from_pdf(pdf_url)
    
    db = firestore.client()
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    
    db.collection('settings').document('notams_skbo').set({
        'notams': notams,
        'lastUpdated': now_iso,
        'pdfUrl': pdf_url
    })
    
    return {
        "success": True,
        "count": len(notams),
        "lastUpdated": now_iso,
        "pdfUrl": pdf_url
    }
