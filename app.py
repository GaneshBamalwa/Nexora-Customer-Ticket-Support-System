from flask import Flask, flash, render_template, request, redirect, url_for, session, jsonify
import mysql.connector
from datetime import datetime
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import hashlib
import urllib.request
import json as _json

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'change_this_in_production')

# ─── CONFIG ───────────────────────────────────────────────────────────────────
DB_CONFIG = {
    "host":     "localhost",
    "user":     "root",
    "password": "Rudra@7711",
    "database": "CustomerSupportDB",
}

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

SMTP_HOST  = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT  = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER  = os.environ.get("SMTP_USER", "")
SMTP_PASS  = os.environ.get("SMTP_PASS", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "support@yourcompany.com")

# ─── DB HELPER ────────────────────────────────────────────────────────────────
def get_db():
    conn = mysql.connector.connect(**DB_CONFIG)
    return conn, conn.cursor(dictionary=True)

# ─── EMAIL HELPER ─────────────────────────────────────────────────────────────
def send_email(to_addr: str, subject: str, body_html: str):
    """Send an email notification. Silently skips if SMTP is not configured."""
    if not SMTP_USER:
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = EMAIL_FROM
        msg["To"]      = to_addr
        msg.attach(MIMEText(body_html, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(EMAIL_FROM, to_addr, msg.as_string())
    except Exception:
        pass  # Never crash the app due to email failure

# ─── PASSWORD HELPERS ─────────────────────────────────────────────────────────
def hash_password(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()

def check_password(raw: str, hashed: str) -> bool:
    return hash_password(raw) == hashed

# ─── CUSTOMER ACTIONS ─────────────────────────────────────────────────────────
@app.route('/follow_up/<int:ticket_id>')
def follow_up(ticket_id):
    conn = None
    try:
        conn, cursor = get_db()
        cursor.execute("""
            UPDATE Tickets
            SET FollowUpCount = FollowUpCount + 1, Status = 'Open'
            WHERE Ticket_ID = %s
        """, (ticket_id,))
        conn.commit()
        cursor.execute("""
            SELECT t.Subject, c.Email_ID AS customer_email, a.Email_ID AS agent_email
            FROM Tickets t
            LEFT JOIN Customers c ON t.Customer_ID = c.Customer_ID
            LEFT JOIN Support_Agents a ON t.Agent_ID = a.Agent_ID
            WHERE t.Ticket_ID = %s
        """, (ticket_id,))
        row = cursor.fetchone()
    finally:
        if conn: conn.close()

    if row and row.get('agent_email'):
        send_email(
            row['agent_email'],
            f"[Follow-Up] Ticket #{ticket_id}: {row['Subject']}",
            f"<p>The customer has sent a follow-up on ticket <strong>#{ticket_id} - {row['Subject']}</strong>. "
            f"Please review and respond promptly.</p>"
        )
    flash("Follow-up sent! Support has been notified.", "info")
    return redirect(url_for('home'))


@app.route('/search_history', methods=['POST'])
def search_history():
    email    = request.form.get('search_email')
    f_status = request.form.get('filter_status')
    f_prio   = request.form.get('filter_priority')

    conn = None
    try:
        conn, cursor = get_db()
        cursor.execute("SELECT Customer_ID, Name FROM Customers WHERE Email_ID = %s", (email,))
        customer = cursor.fetchone()

        history = []
        if customer:
            query  = "SELECT * FROM Tickets WHERE Customer_ID = %s"
            params = [customer['Customer_ID']]
            if f_status: query += " AND Status = %s";   params.append(f_status)
            if f_prio:   query += " AND Priority = %s"; params.append(f_prio)
            query += " ORDER BY Ticket_ID DESC"
            cursor.execute(query, params)
            history = cursor.fetchall()
    finally:
        if conn: conn.close()

    if 'user' in session:
        conn = None
        try:
            conn, cursor = get_db()
            cursor.execute("SELECT Agent_ID, Name FROM Support_Agents WHERE Role='Agent'")
            agents = cursor.fetchall()
        finally:
            if conn: conn.close()
        return render_template('dashboard.html', tickets=history, user=session['user'],
                               agents=agents, is_search=True, last_email=email, pw_requests=[],
                               now=datetime.now())

    return render_template('raise_ticket.html', history=history,
                           customer_name=customer['Name'] if customer else "",
                           last_email=email)

# ─── CORE TICKETING ───────────────────────────────────────────────────────────
@app.route('/')
def home():
    return render_template('raise_ticket.html', history=[], customer_name="")


@app.route('/raise_ticket', methods=['POST'])
def raise_ticket():
    email   = request.form.get('email')
    subject = request.form.get('subject')
    desc    = request.form.get('description')
    prio    = request.form.get('priority')

    conn = None
    try:
        conn, cursor = get_db()
        cursor.execute("SELECT Customer_ID FROM Customers WHERE Email_ID = %s", (email,))
        customer = cursor.fetchone()
        if not customer:
            cursor.execute("INSERT INTO Customers (Name, Email_ID) VALUES (%s, %s)",
                           (email.split('@')[0], email))
            customer_id = cursor.lastrowid
        else:
            customer_id = customer['Customer_ID']

        cursor.execute(
            "INSERT INTO Tickets (Customer_ID, Subject, Description, Priority, Status, FollowUpCount) "
            "VALUES (%s, %s, %s, %s, 'Open', 0)",
            (customer_id, subject, desc, prio)
        )
        ticket_id = cursor.lastrowid
        conn.commit()
    finally:
        if conn: conn.close()

    send_email(
        email,
        f"[Ticket #{ticket_id}] We've received your request",
        f"<p>Hi,</p><p>Your support ticket <strong>#{ticket_id} - {subject}</strong> has been received "
        f"with <strong>{prio}</strong> priority. We'll get back to you shortly.</p>"
    )
    flash("Ticket raised successfully! A confirmation email has been sent.", "success")
    return redirect(url_for('home'))


@app.route('/ticket/<int:ticket_id>/conversation', methods=['GET', 'POST'])
def ticket_conversation(ticket_id):
    conn = None
    try:
        conn, cursor = get_db()
        cursor.execute("SELECT * FROM Tickets WHERE Ticket_ID = %s", (ticket_id,))
        ticket = cursor.fetchone()

        if request.method == 'POST' and ticket['Status'] == 'Open':
            msg_text = request.form.get('message')
            user     = session.get('user')
            role     = user['Role'] if user else 'Customer'
            cursor.execute(
                "INSERT INTO Ticket_Conversations (Ticket_ID, Sender_Role, Message_Text) VALUES (%s, %s, %s)",
                (ticket_id, role, msg_text)
            )
            conn.commit()

            cursor.execute("""
                SELECT c.Email_ID AS customer_email, a.Email_ID AS agent_email
                FROM Tickets t
                JOIN Customers c ON t.Customer_ID = c.Customer_ID
                LEFT JOIN Support_Agents a ON t.Agent_ID = a.Agent_ID
                WHERE t.Ticket_ID = %s
            """, (ticket_id,))
            parties = cursor.fetchone()
            if parties:
                if role == 'Customer' and parties.get('agent_email'):
                    send_email(parties['agent_email'],
                               f"[Reply] Ticket #{ticket_id}: {ticket['Subject']}",
                               f"<p>Customer replied on ticket #{ticket_id}. Log in to respond.</p>")
                elif role != 'Customer' and parties.get('customer_email'):
                    send_email(parties['customer_email'],
                               f"[Update] Your ticket #{ticket_id} has a new reply",
                               f"<p>A support agent replied to your ticket <strong>#{ticket_id} - {ticket['Subject']}</strong>. "
                               f"Visit the portal to view and respond.</p>")

            conn.close()
            return redirect(url_for('ticket_conversation', ticket_id=ticket_id))

        cursor.execute(
            "SELECT * FROM Ticket_Conversations WHERE Ticket_ID = %s ORDER BY Timestamp ASC",
            (ticket_id,)
        )
        messages = cursor.fetchall()
    finally:
        if conn: conn.close()

    return render_template('conversation.html', ticket=ticket, messages=messages)

# ─── STAFF DASHBOARD ──────────────────────────────────────────────────────────
@app.route('/dashboard')
def dashboard():
    if 'user' not in session:
        return redirect(url_for('login_page'))
    user     = session['user']
    f_status = request.args.get('status')
    f_prio   = request.args.get('priority')
    f_date   = request.args.get('date')

    conn = None
    try:
        conn, cursor = get_db()
        query = (
            "SELECT t.*, "
            "(SELECT Message_Text FROM Ticket_Conversations "
            " WHERE Ticket_ID = t.Ticket_ID ORDER BY Timestamp DESC LIMIT 1) as last_message "
            "FROM Tickets t WHERE 1=1"
        )
        params = []
        if user['Role'] != 'Administrator':
            query += " AND (Agent_ID = %s OR Agent_ID IS NULL)"
            params.append(user['Agent_ID'])
        if f_status: query += " AND Status = %s";          params.append(f_status)
        if f_prio:   query += " AND Priority = %s";        params.append(f_prio)
        if f_date:   query += " AND DATE(Created_Date) = %s"; params.append(f_date)
        query += " ORDER BY FollowUpCount DESC, Ticket_ID DESC"
        cursor.execute(query, params)
        tickets = cursor.fetchall()

        cursor.execute("SELECT Agent_ID, Name FROM Support_Agents WHERE Role='Agent'")
        agents = cursor.fetchall()

        # Pending password change requests (admin sees these)
        pw_requests = []
        if user['Role'] == 'Administrator':
            cursor.execute("""
                SELECT r.Request_ID, r.Status, r.Requested_At, a.Name, a.Email_ID
                FROM Password_Change_Requests r
                JOIN Support_Agents a ON r.Agent_ID = a.Agent_ID
                WHERE r.Status = 'Pending'
                ORDER BY r.Requested_At DESC
            """)
            pw_requests = cursor.fetchall()
    finally:
        if conn: conn.close()

    return render_template('dashboard.html', tickets=tickets, user=user,
                           agents=agents, is_search=False, pw_requests=pw_requests,
                           now=datetime.now())


@app.route('/admin_report')
def admin_report():
    if 'user' not in session or session['user']['Role'] != 'Administrator':
        return redirect(url_for('dashboard'))
    conn = None
    try:
        conn, cursor = get_db()
        cursor.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN Status='Resolved' THEN 1 ELSE 0 END) as resolved,
                   SUM(CASE WHEN Status='Open'     THEN 1 ELSE 0 END) as pending,
                   ROUND(AVG(CASE WHEN Rating IS NOT NULL THEN Rating END), 1) as avg_rating
            FROM Tickets
        """)
        stats = cursor.fetchone()
        cursor.execute("""
            SELECT a.Name,
                   COUNT(t.Ticket_ID) as assigned,
                   SUM(CASE WHEN t.Status = 'Resolved' THEN 1 ELSE 0 END) as solved,
                   ROUND(AVG(CASE WHEN t.Rating IS NOT NULL THEN t.Rating END), 1) as avg_rating,
                   ROUND(AVG(CASE WHEN t.Resolved_At IS NOT NULL AND t.Assigned_At IS NOT NULL
                        THEN TIMESTAMPDIFF(MINUTE, t.Assigned_At, t.Resolved_At) END) / 60, 1) as avg_hours
            FROM Support_Agents a
            LEFT JOIN Tickets t ON a.Agent_ID = t.Agent_ID
            WHERE a.Role = 'Agent'
            GROUP BY a.Agent_ID, a.Name
        """)
        performance = cursor.fetchall()
        cursor.execute("SELECT Priority, COUNT(*) as count FROM Tickets GROUP BY Priority")
        priority_data = cursor.fetchall()
        cursor.execute("""
            SELECT DATE(Created_Date) as day, COUNT(*) as count
            FROM Tickets
            WHERE Created_Date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
            GROUP BY DATE(Created_Date) ORDER BY day ASC
        """)
        daily_data = cursor.fetchall()
    finally:
        if conn: conn.close()

    return render_template('admin_report.html', stats=stats, performance=performance,
                           priority_data=priority_data, daily_data=daily_data)

# ─── AUTH ─────────────────────────────────────────────────────────────────────
@app.route('/login_page')
def login_page():
    return render_template('login.html')


@app.route('/auth', methods=['POST'])
def auth():
    email    = request.form.get('email', '').strip()
    password = request.form.get('password', '')

    conn = None
    try:
        conn, cursor = get_db()
        cursor.execute("SELECT * FROM Support_Agents WHERE Email_ID = %s", (email,))
        user = cursor.fetchone()
    finally:
        if conn: conn.close()

    if user:
        stored = user.get('Password', '')
        if not stored:
            # No password set yet — let them in to set one
            session['user'] = {k: v for k, v in user.items() if k != 'Password'}
            flash("Welcome! Please set a password for your account.", "warning")
            return redirect(url_for('set_password'))
        if check_password(password, stored):
            session['user'] = {k: v for k, v in user.items() if k != 'Password'}
            return redirect(url_for('dashboard'))

    flash("Invalid email or password.", "danger")
    return redirect(url_for('login_page'))


@app.route('/set_password', methods=['GET', 'POST'])
def set_password():
    """
    - First-time setup: anyone in session with no password yet can set it freely.
    - Admin: can always change their own password freely.
    - Agent: can only change password if admin has approved a pending request.
    """
    if 'user' not in session:
        return redirect(url_for('login_page'))

    user = session['user']
    conn = None

    # Check if agent has an approved request
    change_approved = False
    if user['Role'] == 'Agent':
        try:
            conn, cursor = get_db()
            # Check if this agent has a password set already
            cursor.execute("SELECT Password FROM Support_Agents WHERE Agent_ID = %s", (user['Agent_ID'],))
            row = cursor.fetchone()
            has_password = bool(row and row.get('Password'))

            if has_password:
                # Must have admin approval to change
                cursor.execute("""
                    SELECT * FROM Password_Change_Requests
                    WHERE Agent_ID = %s AND Status = 'Approved'
                    ORDER BY Requested_At DESC LIMIT 1
                """, (user['Agent_ID'],))
                approved = cursor.fetchone()
                change_approved = bool(approved)
            else:
                change_approved = True  # First time setup — always allowed
        finally:
            if conn: conn.close()
    else:
        # Admin can always change password
        change_approved = True

    if request.method == 'POST':
        if not change_approved:
            flash("You need admin approval to change your password.", "danger")
            return redirect(url_for('set_password'))

        new_pw  = request.form.get('password', '')
        confirm = request.form.get('confirm', '')
        if len(new_pw) < 8:
            flash("Password must be at least 8 characters.", "danger")
            return redirect(url_for('set_password'))
        if new_pw != confirm:
            flash("Passwords do not match.", "danger")
            return redirect(url_for('set_password'))

        conn = None
        try:
            conn, cursor = get_db()
            cursor.execute("UPDATE Support_Agents SET Password = %s WHERE Agent_ID = %s",
                           (hash_password(new_pw), user['Agent_ID']))
            # Clear any approved requests after successful change
            if user['Role'] == 'Agent':
                cursor.execute("""
                    UPDATE Password_Change_Requests SET Status = 'Done'
                    WHERE Agent_ID = %s AND Status = 'Approved'
                """, (user['Agent_ID'],))
            conn.commit()
        finally:
            if conn: conn.close()

        flash("Password updated successfully!", "success")
        return redirect(url_for('dashboard'))

    return render_template('set_password.html', change_approved=change_approved, user=user)


@app.route('/request_password_change', methods=['POST'])
def request_password_change():
    """Agent submits a request to change their password — admin must approve it."""
    if 'user' not in session or session['user']['Role'] != 'Agent':
        return redirect(url_for('dashboard'))

    agent_id = session['user']['Agent_ID']
    conn = None
    try:
        conn, cursor = get_db()
        # Check no pending request already exists
        cursor.execute("""
            SELECT * FROM Password_Change_Requests
            WHERE Agent_ID = %s AND Status = 'Pending'
        """, (agent_id,))
        existing = cursor.fetchone()
        if existing:
            flash("You already have a pending password change request.", "warning")
            return redirect(url_for('set_password'))

        cursor.execute("""
            INSERT INTO Password_Change_Requests (Agent_ID, Status)
            VALUES (%s, 'Pending')
        """, (agent_id,))
        conn.commit()

        # Notify all admins
        cursor.execute("SELECT Email_ID FROM Support_Agents WHERE Role = 'Administrator'")
        admins = cursor.fetchall()
    finally:
        if conn: conn.close()

    for admin in admins:
        send_email(
            admin['Email_ID'],
            f"[Request] {session['user']['Name']} wants to change their password",
            f"<p>Agent <strong>{session['user']['Name']}</strong> has requested a password change. "
            f"Please log in to the admin dashboard to approve or deny.</p>"
        )

    flash("Request sent! You'll be notified once an admin approves it.", "success")
    return redirect(url_for('dashboard'))


@app.route('/handle_pw_request/<int:request_id>/<action>')
def handle_pw_request(request_id, action):
    """Admin approves or denies a password change request."""
    if 'user' not in session or session['user']['Role'] != 'Administrator':
        return redirect(url_for('dashboard'))

    if action not in ('approve', 'deny'):
        return redirect(url_for('dashboard'))

    new_status = 'Approved' if action == 'approve' else 'Denied'
    conn = None
    try:
        conn, cursor = get_db()
        cursor.execute("""
            UPDATE Password_Change_Requests SET Status = %s WHERE Request_ID = %s
        """, (new_status, request_id))
        conn.commit()

        # Notify the agent
        cursor.execute("""
            SELECT a.Email_ID, a.Name FROM Password_Change_Requests r
            JOIN Support_Agents a ON r.Agent_ID = a.Agent_ID
            WHERE r.Request_ID = %s
        """, (request_id,))
        agent = cursor.fetchone()
    finally:
        if conn: conn.close()

    if agent:
        if new_status == 'Approved':
            send_email(agent['Email_ID'],
                       "Your password change request has been approved",
                       "<p>Your request to change your password has been approved. "
                       "Please log in and go to <strong>Change Password</strong> in your dashboard.</p>")
        else:
            send_email(agent['Email_ID'],
                       "Your password change request was denied",
                       "<p>Your request to change your password has been denied by the administrator.</p>")

    flash(f"Request {new_status.lower()} successfully.", "success")
    return redirect(url_for('dashboard'))

# ─── ADMIN: MANAGE AGENTS ─────────────────────────────────────────────────────
@app.route('/add_agent', methods=['POST'])
def add_agent():
    if 'user' not in session or session['user']['Role'] != 'Administrator':
        flash("Unauthorized.", "danger")
        return redirect(url_for('dashboard'))

    name  = request.form.get('name', '').strip()
    email = request.form.get('email', '').strip()
    role  = request.form.get('role', 'Agent')

    if not name or not email:
        flash("Name and email are required.", "danger")
        return redirect(url_for('admin_report'))

    conn = None
    try:
        conn, cursor = get_db()
        cursor.execute("SELECT Agent_ID FROM Support_Agents WHERE Email_ID = %s", (email,))
        if cursor.fetchone():
            flash("An agent with that email already exists.", "warning")
            return redirect(url_for('admin_report'))
        cursor.execute("INSERT INTO Support_Agents (Name, Email_ID, Role) VALUES (%s, %s, %s)",
                       (name, email, role))
        conn.commit()
    finally:
        if conn: conn.close()

    flash(f"Agent '{name}' added. They can set their password on first login.", "success")
    return redirect(url_for('admin_report'))

# ─── TICKET MANAGEMENT ────────────────────────────────────────────────────────
@app.route('/assign_ticket/<int:ticket_id>', methods=['POST'])
def assign_ticket(ticket_id):
    if 'user' not in session or session['user']['Role'] != 'Administrator':
        return redirect(url_for('dashboard'))

    agent_id = request.form.get('agent_id') or None
    conn = None
    try:
        conn, cursor = get_db()
        if agent_id:
            # Set assignment time and due date based on priority
            cursor.execute("SELECT Subject, Priority FROM Tickets WHERE Ticket_ID = %s", (ticket_id,))
            ticket = cursor.fetchone()
            due_hours = {'High': 24, 'Medium': 48, 'Low': 72}.get(ticket['Priority'], 48)
            cursor.execute("""
                UPDATE Tickets SET Agent_ID = %s, Assigned_At = NOW(),
                Due_Date = DATE_ADD(NOW(), INTERVAL %s HOUR)
                WHERE Ticket_ID = %s
            """, (agent_id, due_hours, ticket_id))
            cursor.execute("SELECT Email_ID, Name FROM Support_Agents WHERE Agent_ID = %s", (agent_id,))
            agent = cursor.fetchone()
            if agent:
                send_email(agent['Email_ID'],
                           f"[Assigned] Ticket #{ticket_id}: {ticket['Subject']}",
                           f"<p>Hi {agent['Name']},</p><p>Ticket <strong>#{ticket_id} - {ticket['Subject']}</strong> "
                           f"has been assigned to you. Due in {due_hours} hours.</p>")
        else:
            cursor.execute("""
                UPDATE Tickets SET Agent_ID = NULL, Assigned_At = NULL, Due_Date = NULL
                WHERE Ticket_ID = %s
            """, (ticket_id,))
        conn.commit()
    finally:
        if conn: conn.close()

    return redirect(url_for('dashboard'))


@app.route('/resolve_ticket/<int:ticket_id>')
def resolve_ticket(ticket_id):
    if 'user' not in session:
        return redirect(url_for('login_page'))
    conn = None
    try:
        conn, cursor = get_db()
        cursor.execute("""
            UPDATE Tickets SET Status = 'Resolved', Resolved_At = NOW()
            WHERE Ticket_ID = %s
        """, (ticket_id,))
        conn.commit()
        cursor.execute("""
            SELECT t.Subject, t.Ticket_ID, c.Email_ID as customer_email
            FROM Tickets t JOIN Customers c ON t.Customer_ID = c.Customer_ID
            WHERE t.Ticket_ID = %s
        """, (ticket_id,))
        row = cursor.fetchone()
    finally:
        if conn: conn.close()

    if row and row.get('customer_email'):
        rating_url = f"http://localhost:5000/rate_ticket/{ticket_id}"
        send_email(row['customer_email'],
                   f"[Resolved] Your ticket #{ticket_id} has been closed",
                   f"<p>Your ticket <strong>#{ticket_id} - {row['Subject']}</strong> has been resolved.</p>"
                   f"<p>Please take a moment to rate your experience:</p>"
                   f"<p>"
                   f"<a href='{rating_url}/1'>⭐ 1</a> &nbsp;"
                   f"<a href='{rating_url}/2'>⭐⭐ 2</a> &nbsp;"
                   f"<a href='{rating_url}/3'>⭐⭐⭐ 3</a> &nbsp;"
                   f"<a href='{rating_url}/4'>⭐⭐⭐⭐ 4</a> &nbsp;"
                   f"<a href='{rating_url}/5'>⭐⭐⭐⭐⭐ 5</a>"
                   f"</p>")
    flash("Ticket resolved successfully!", "success")
    return redirect(url_for('dashboard'))


# ─── TICKET RATING ───────────────────────────────────────────────────────────
@app.route('/rate_ticket/<int:ticket_id>/<int:rating>')
def rate_ticket(ticket_id, rating):
    if rating < 1 or rating > 5:
        return "Invalid rating.", 400
    conn = None
    try:
        conn, cursor = get_db()
        cursor.execute("""
            UPDATE Tickets SET Rating = %s WHERE Ticket_ID = %s AND Status = 'Resolved'
        """, (rating, ticket_id))
        conn.commit()
    finally:
        if conn: conn.close()
    flash("Thank you for your feedback! ⭐", "success")
    return redirect(url_for('home'))


# ─── AI SUGGEST PROXY ────────────────────────────────────────────────────────
@app.route('/ai_suggest', methods=['POST'])
def ai_suggest():
    """Server-side proxy so the Anthropic API key is never exposed to the browser."""
    if 'user' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json(force=True)
    subject     = data.get('subject', '')
    description = data.get('description', '')
    messages    = data.get('messages', [])

    history = '\n'.join(f"{m['role']}: {m['text']}" for m in messages) or '(no messages yet)'
    prompt = (
        "You are a professional customer support agent. Write a helpful, empathetic, and concise reply.\n\n"
        f"Ticket Subject: {subject}\n"
        f"Customer Issue: {description}\n\n"
        f"Conversation so far:\n{history}\n\n"
        "Write only the reply text — no greeting prefix, no sign-off. Keep it 2-4 sentences."
    )

    if not ANTHROPIC_API_KEY:
        return jsonify({'error': 'ANTHROPIC_API_KEY not configured on the server.'}), 500

    payload = _json.dumps({
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1000,
        "messages": [{"role": "user", "content": prompt}]
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = _json.loads(resp.read())
        text = result['content'][0]['text']
        return jsonify({'suggestion': text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('home'))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)