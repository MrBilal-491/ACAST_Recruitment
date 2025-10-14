import os
import sqlite3
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs
import pandas as pd
import math

# Hardcoded login credentials
ALLOWED_USERNAME = "admin@ACAST"
ALLOWED_PASSWORD = "Air491*"

DB_FILE = "candidates.db"
EXCEL_DIR = "domain_excels"
os.makedirs(EXCEL_DIR, exist_ok=True)

DOMAINS = [
    "EMBEDDED",
    "FPGA",
    "RTOS",
    "RF",
    "WIRELESS",
    "SYSTEM ENGG",
    "COMM AND DSP",
    "CORRELATION AND FUSION"
]

# ---------- Database Setup ----------
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()

    # Create table if not exists
    c.execute("""
    CREATE TABLE IF NOT EXISTS candidates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        university TEXT,
        cgpa REAL,
        domain TEXT,
        experience TEXT,
        test_score REAL,
        weighted_test REAL,
        avg_interview_raw REAL,
        avg_interview_weighted REAL,
        final_score REAL,
        remarks TEXT
    )
    """)
    conn.commit()

    # Ensure "remarks" column exists
    columns = {row[1] for row in c.execute("PRAGMA table_info(candidates)")}
    if "remarks" not in columns:
        c.execute("ALTER TABLE candidates ADD COLUMN remarks TEXT")

    conn.commit()
    conn.close()

# ---------- Save Candidate ----------
def save_candidate(candidate):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("""
    INSERT INTO candidates
    (name, university, cgpa, domain, experience,
     test_score, weighted_test, avg_interview_raw,
     avg_interview_weighted, final_score, remarks)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        candidate.get("name"),
        candidate.get("university"),
        candidate.get("cgpa"),
        candidate.get("domain"),
        candidate.get("experience"),
        candidate.get("testScore"),
        candidate.get("weightedTest"),
        candidate.get("avgInterviewRaw"),
        candidate.get("avgInterviewWeighted"),
        candidate.get("finalScore"),
        candidate.get("remarks")
    ))
    conn.commit()
    row_id = c.lastrowid
    conn.close()
    return row_id


# ---------- Delete Candidate ----------
def delete_candidates(ids):
    if not ids:
        return 0
    ids_int = [int(i) for i in ids]
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    placeholders = ",".join("?" * len(ids_int))
    c.execute(f"DELETE FROM candidates WHERE id IN ({placeholders})", ids_int)
    deleted = c.rowcount
    conn.commit()
    conn.close()
    return deleted
 
# ---------- Export Domain Sheets ----------
def export_excel_by_domain():
    os.makedirs(EXCEL_DIR, exist_ok=True)

    conn = sqlite3.connect(DB_FILE)
    try:
        df = pd.read_sql_query("SELECT * FROM candidates", conn)
    except Exception:
        df = pd.DataFrame()
    finally:
        conn.close()

        

    for f in os.listdir(EXCEL_DIR):
        if f.endswith(".xlsx"):
            try:
                os.remove(os.path.join(EXCEL_DIR, f))
            except Exception:
                pass

    if df.empty:
        return
    
    

    drop_cols = [c for c in ["image", "panels"] if c in df.columns]
    if drop_cols:
        try:
            df = df.drop(columns=drop_cols)
        except Exception:
            pass

    if "final_score" not in df.columns:
        df["final_score"] = 0.0
    else:
        df["final_score"] = pd.to_numeric(df["final_score"], errors="coerce").fillna(0.0)

    if "domain" not in df.columns:
        df["domain"] = ""

    def assign_remarks(group):
        group = group.sort_values(by="final_score", ascending=False).reset_index(drop=True)
        n = len(group)
        if n == 0:
            group["Remarks"] = []
            return group
        topN = math.ceil(n / 3)
        secondN = math.ceil(n / 3)
        remarks = []
        for i in range(n):
            if i < topN:
                remarks.append("Recommended")
            elif i < topN + secondN:
                remarks.append("Stand By")
            else:
                remarks.append("Not Recommended")
        group["Remarks"] = remarks
        return group

    df = df.groupby("domain", group_keys=False).apply(assign_remarks)

    if "recommended" in df.columns:
        try:
            df = df.drop(columns=["recommended"])
        except Exception:
            pass

    rename_map = {
        "id": "ID",
        "name": "Name",
        "university": "University",
        "cgpa": "CGPA",
        "domain": "Domain",
        "experience": "Experience",
        "test_score": "Test Score",
        "weighted_test": "Weighted Test",
        "avg_interview_raw": "Avg Interview Raw",
        "avg_interview_weighted": "Weighted Interview Score",
        "final_score": "Final Score"
    }
    existing_rename = {k: v for k, v in rename_map.items() if k in df.columns}
    if existing_rename:
        df = df.rename(columns=existing_rename)

    desired_order = [
        "ID",
        "Name",
        "University",
        "CGPA",
        "Domain",
        "Experience",
        "Test Score",
        "Weighted Test",
        "Avg Interview Raw",
        "Weighted Interview Score",
        "Final Score",
        "Remarks"
    ]
    final_columns = [c for c in desired_order if c in df.columns]
    df = df[final_columns]

    for domain in DOMAINS:
        df_domain = df[df["Domain"] == domain] if "Domain" in df.columns else df.iloc[0:0]
        filename = os.path.join(EXCEL_DIR, f"{domain.replace(' ', '_')}.xlsx")
        if df_domain.empty:
            if os.path.exists(filename):
                try:
                    os.remove(filename)
                except Exception:
                    pass
            continue
        try:
            df_domain.to_excel(filename, index=False)
        except Exception as e:
            print("Could not write excel for domain", domain, "error:", e)

# ---------- HTTP Server ----------
class MyHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-type", content_type)
        # ✅ FIXED: allow all headers
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_POST(self):
        if self.path == "/login":
            length = int(self.headers.get("Content-Length", 0))
            data = self.rfile.read(length) if length else b"{}"
            try:
                creds = json.loads(data.decode("utf-8"))
            except Exception:
                creds = {}
            username = creds.get("username", "")
            password = creds.get("password", "")
            if username == ALLOWED_USERNAME and password == ALLOWED_PASSWORD:
                self._set_headers(200)
                self.wfile.write(json.dumps({"status": "ok", "message": "Login successful"}).encode())
            else:
                self._set_headers(401)
                self.wfile.write(json.dumps({"status": "error", "message": "Invalid credentials"}).encode())
            return

        if self.path == "/save":
            length = int(self.headers.get("Content-Length", 0))
            data = self.rfile.read(length) if length else b"{}"
            try:
                candidate = json.loads(data.decode("utf-8"))
            except Exception:
                candidate = {}
            try:
                inserted_id = save_candidate(candidate)
                export_excel_by_domain()
                self._set_headers(200)
                self.wfile.write(json.dumps({"status": "ok", "id": inserted_id}).encode())
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return

        if self.path == "/delete":
            length = int(self.headers.get("Content-Length", 0))
            data = self.rfile.read(length) if length else b"{}"
            try:
                body = json.loads(data.decode("utf-8"))
                ids = body.get("ids", [])
            except Exception:
                ids = []
            try:
                deleted = delete_candidates(ids)
                export_excel_by_domain()
                self._set_headers(200)
                self.wfile.write(json.dumps({"status": "deleted", "count": deleted}).encode())
            except Exception as e:
                self._set_headers(500)
                self.wfile.write(json.dumps({"error": str(e)}).encode())
            return

        self._set_headers(404)
        self.wfile.write(json.dumps({"error": "Not Found"}).encode())

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/download":
            params = parse_qs(parsed.query)
            domain = params.get("domain", [None])[0]
            if not domain or domain not in DOMAINS:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "Invalid domain"}).encode())
                return
            filename = os.path.join(EXCEL_DIR, f"{domain.replace(' ', '_')}.xlsx")
            if not os.path.exists(filename):
                self._set_headers(404)
                self.wfile.write(json.dumps({"error": "File not found"}).encode())
                return
            self.send_response(200)
            self.send_header("Content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            self.send_header("Content-Disposition", f'attachment; filename="{os.path.basename(filename)}"')
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "*")
            self.end_headers()
            with open(filename, "rb") as f:
                self.wfile.write(f.read())
            return

        self._set_headers(404)
        self.wfile.write(json.dumps({"error": "Not Found"}).encode())

# ---------- Main ----------
if __name__ == "__main__":
    init_db()
    server = HTTPServer(("localhost", 8000), MyHandler)
    print("✅ Backend running at http://localhost:8000")
    server.serve_forever()
