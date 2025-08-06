from flask import Blueprint, jsonify
from db import get_db_connection
from datetime import datetime

dashboard_bp = Blueprint("dashboard", __name__)

@dashboard_bp.route("/<int:user_id>", methods=["GET"])
def get_dashboard(user_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        today = datetime.now()
        current_year = today.year
        current_month = today.month

        # Get all categories with budgets
        cursor.execute("""
            SELECT c.id AS category_id, c.name AS category_name, c.icon, IFNULL(b.amount, 0) AS budget
            FROM categories c
            LEFT JOIN budgets b 
              ON b.category_id = c.id AND b.user_id = %s AND b.month = %s
        """, (user_id, today.strftime("%Y-%m")))
        categories = cursor.fetchall()

        # Get total spent per category, exclude decomposed transactions' main amounts
        cursor.execute("""
            SELECT category_id, SUM(spent) AS spent FROM (
                SELECT final_category_id AS category_id, amount AS spent
                FROM transactions
                WHERE user_id = %s
                  AND YEAR(date) = %s AND MONTH(date) = %s
                  AND final_category_id IS NOT NULL
                  AND is_cash_decomposed = FALSE

                UNION ALL

                SELECT d.category_id, d.amount
                FROM transactions t
                JOIN cash_expense_details d ON d.transaction_id = t.id
                WHERE t.user_id = %s
                  AND YEAR(t.date) = %s AND MONTH(t.date) = %s
                  AND t.is_cash_decomposed = TRUE
            ) AS all_data
            GROUP BY category_id
        """, (user_id, current_year, current_month, user_id, current_year, current_month))
        spent_data = cursor.fetchall()

        spent_map = {row["category_id"]: float(row["spent"]) for row in spent_data}

        result = []
        for cat in categories:
            spent = spent_map.get(cat["category_id"], 0.0)
            result.append({
                "category": cat["category_name"],
                "icon": cat["icon"],
                "budget": round(float(cat["budget"]), 2),
                "spent": round(spent, 2),
            })

        return jsonify(result), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
