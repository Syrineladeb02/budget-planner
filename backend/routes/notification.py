from flask import Blueprint, jsonify
from db import get_db_connection
from datetime import datetime

notifications_bp = Blueprint("notifications", __name__)

from flask import Blueprint, jsonify
from db import get_db_connection
from datetime import datetime

notifications_bp = Blueprint("notifications", __name__)

@notifications_bp.route("/<int:user_id>", methods=["GET"])
def get_notifications(user_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    alerts = []

    try:
        today = datetime.now()
        current_month = today.strftime("%Y-%m")
        current_year = today.year
        current_month_num = today.month

        # 1. Get all categories and budgets
        cursor.execute("""
            SELECT c.id AS category_id, c.name AS category_name, c.icon,
                   IFNULL(b.amount, 0) AS budget
            FROM categories c
            LEFT JOIN budgets b 
                ON b.category_id = c.id AND b.user_id = %s AND b.month = %s
        """, (user_id, current_month))
        categories = cursor.fetchall()

        # 2. Get actual spending per category with decomposition logic
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
        """, (user_id, current_year, current_month_num, user_id, current_year, current_month_num))
        spent_data = cursor.fetchall()
        spent_map = {row["category_id"]: float(row["spent"]) for row in spent_data}

        # 3. Build alerts
        for cat in categories:
            cat_id = cat["category_id"]
            budget = float(cat["budget"])
            spent = spent_map.get(cat_id, 0.0)

            if spent == 0:
                continue

            if budget == 0:
                alerts.append({
                    "category": f"{cat['icon']} {cat['category_name']}",
                    "percent_used": 0,
                    "message": f"⚠️ You spent {round(spent, 2)} DT in {cat['category_name']}, but no budget was set!"
                })
                continue

            percent_used = (spent / budget) * 100
            if percent_used >= 90:
                level = "⚠️" if percent_used > 100 else "🟡"
                message = f"{level} You've used {round(percent_used)}% of your {cat['category_name']} budget!"
                alerts.append({
                    "category": f"{cat['icon']} {cat['category_name']}",
                    "percent_used": round(percent_used, 1),
                    "message": message
                })

        return jsonify(alerts), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        conn.close()
