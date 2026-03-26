import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "support_portal.db")

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Check if tickets exist
cursor.execute("SELECT COUNT(*) FROM Tickets")
count = cursor.fetchone()[0]

if count == 0:
    tickets = [
        (1, 2, "Payment Failed Error", "Customer tried paying with credit card but failed.", "Open", "High"),
        (2, 2, "Login Issue", "Forgot password isn't sending recovery emails.", "Pending", "Medium"),
        (3, 3, "Account Deletion Request", "User wants to permanently delete their account.", "Open", "High"),
        (1, 3, "Mobile App Crashing", "The iOS app crashes on the settings page.", "Pending", "High"),
        (2, 2, "Refund Inquiry", "Wants to know the status of refund #99281.", "Resolved", "Low")
    ]
    for t in tickets:
        cursor.execute(
            "INSERT INTO Tickets (Customer_ID, Agent_ID, Subject, Description, Status, Priority) VALUES (?, ?, ?, ?, ?, ?)",
            t
        )
    conn.commit()
    print("Seeded 5 dummy tickets!")
else:
    print("Tickets already exist.")

conn.close()
