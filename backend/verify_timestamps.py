import urllib.request, json, sys

# First login to get a token
login_data = json.dumps({"username": "sharan_underwriter", "password": "CanaraWriter123"}).encode()
login_req = urllib.request.Request(
    "http://127.0.0.1:8000/api/auth/login",
    data=login_data,
    headers={"Content-Type": "application/json"}
)
try:
    login_resp = urllib.request.urlopen(login_req)
    token_data = json.loads(login_resp.read())
    token = token_data["access_token"]
except Exception as e:
    print(f"Login failed: {e}")
    sys.exit(1)

# Fetch document 7
doc_req = urllib.request.Request(
    "http://127.0.0.1:8000/api/documents/7",
    headers={"Authorization": f"Bearer {token}"}
)
try:
    doc_resp = urllib.request.urlopen(doc_req)
    doc = json.loads(doc_resp.read())
    print(f"Document 7 uploaded_at: {doc['uploaded_at']}")
    print(f"Document 7 upload_time: {doc['upload_time']}")
    
    has_tz = "+00:00" in str(doc["uploaded_at"]) or "Z" in str(doc["uploaded_at"])
    print(f"Has timezone info: {has_tz}")
except Exception as e:
    print(f"Fetch failed: {e}")
    sys.exit(1)

# Fetch document list
list_req = urllib.request.Request(
    "http://127.0.0.1:8000/api/documents/",
    headers={"Authorization": f"Bearer {token}"}
)
try:
    list_resp = urllib.request.urlopen(list_req)
    docs = json.loads(list_resp.read())
    print(f"\nDocument list ({len(docs)} docs):")
    for d in docs[:3]:
        print(f"  id={d['id']} uploaded_at={d['uploaded_at']}")
except Exception as e:
    print(f"List fetch failed: {e}")

import datetime
print(f"\nCurrent server time (UTC): {datetime.datetime.now(datetime.timezone.utc).isoformat()}")
print(f"Current local time (IST): {datetime.datetime.now().isoformat()}")
