from flask import Blueprint, request, jsonify
from db import get_db_connection

budgets_bp = Blueprint('budgets', __name__)


@budgets_bp.route('/<int:user_id>/<month>', methods=['GET'])
def get_user_budgets(user_id, month):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT c.name AS category_name, b.amount, c.icon
            FROM budgets b
            JOIN categories c ON b.category_id = c.id
            WHERE b.user_id = %s AND b.month = %s
        """, (user_id, month))
        data = cursor.fetchall()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
        
@budgets_bp.route('/categories', methods=['GET'])
def get_categories():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT name, icon FROM categories ORDER BY name ASC")
        data = cursor.fetchall()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


# Route to submit budgets (for the current month)
@budgets_bp.route('/', methods=['POST'])  # POST /api/budgets
def save_budgets():
    data = request.get_json()
    user_id = data.get("user_id")
    month = data.get("month")
    budgets = data.get("budgets")  # dict of {category_name: amount}

    if not user_id or not month or not budgets:
        return jsonify({"error": "Missing data"}), 400

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        for category_name, amount in budgets.items():
            cursor.execute("SELECT id FROM categories WHERE name = %s", (category_name,))
            category = cursor.fetchone()
            if category:
                category_id = category['id']
                # Use INSERT ... ON DUPLICATE KEY UPDATE to insert or update amount
                cursor.execute("""
                    INSERT INTO budgets (user_id, category_id, month, amount)
                    VALUES (%s, %s, %s, %s)
                    ON DUPLICATE KEY UPDATE amount = VALUES(amount)
                """, (user_id, category_id, month, amount))
        conn.commit()
        return jsonify({"message": "Budgets saved or updated successfully"}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()
