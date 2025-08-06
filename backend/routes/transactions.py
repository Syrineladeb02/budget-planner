from flask import Blueprint, request, jsonify 
from db import get_db_connection
import joblib
import re
import pandas as pd
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sentence_transformers import SentenceTransformer
from rapidfuzz import process, fuzz
from datetime import datetime
import tempfile
from flask import send_file
from werkzeug.utils import secure_filename
import io
import re


transactions_bp = Blueprint('transactions', __name__)

def clean_merchant_name(name):
    name = str(name)

    # Keep only the part before the first '>'
    if '>' in name:
        name = name.split('>')[0]

    name = name.lower()
    name = re.sub(r'[^\w\s&]', ' ', name)
    name = re.sub(r'\b(ste|sas|societe|ets|ltd|llc|inc)\b', '', name)
    name = re.sub(r'\b(tunis|sfax|sousse|nabeul|monastir|gabes|kairouan|ben arous|bizerte|gafsa|medenine|beja|jendouba|kasserine|kebili|mahdia|siliana|tozeur|zaghouan|manouba|tatouine|ariana)\b', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name
# Governorate helper functions (extract these outside route for reuse)
def clean_location_name(loc):
    loc = str(loc).upper().strip()
    loc = re.sub(r"[^\w\s]", " ", loc)
    loc = re.sub(r"\s+", " ", loc)
    loc = re.sub(
        r"\b(LE|MEDINA|DE|DES|CITE|CARREFOUR|LA|AV|RTE|ROUTE|AVENUE|AGENCE|AG|BOX|BT|DAB|HL|STE|SOCIETE|COMPTOIR|KIOSQUE|GARE|G|SARL|SPA|EURL|SNACK|CAFE|ET|HOTEL|MALL|PHARMACIE|STATION|BANQUE|MOVENPICK|INTERNET|SMART|SOLUTIONS|FERCHICHI)\b",
        "", loc)
    return loc.strip()
# Load once globally if possible for performance
known_df = pd.read_excel('models/municipality_governorate.xlsx')
known_df.columns = ['Municipality', 'Governorate']
known_df['Municipality'] = known_df['Municipality'].astype(str).str.upper().str.strip()
known_df['Governorate'] = known_df['Governorate'].astype(str).str.upper().str.strip()
known_map = dict(zip(known_df['Municipality'], known_df['Governorate']))
known_keys = list(known_map.keys())

def predict_governorate(affiliation):
    parts = affiliation.split('>')
    is_tunisia = parts[-1].strip().upper() in ["TUN", "TN"]
    if not is_tunisia:
        return "NOT TUNISIA", None

    loc = clean_location_name(parts[-2] if len(parts) >= 2 else parts[-1])
    match = process.extractOne(loc, known_keys, scorer=fuzz.token_set_ratio)
    if match:
        best_match, score, _ = match
        if score >= 90:
            return known_map[best_match], round(score / 100, 2)
        elif score >= 70:
            return known_map[best_match], round(score / 100, 2)
        else:
            return "TUNIS", 0.6
    else:
        return "TUNIS", 0.5

def get_alerts_for_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    alerts = []

    try:
        today = datetime.now()
        current_month = today.strftime("%Y-%m")

        cursor.execute("""
            SELECT c.id AS category_id, c.name AS category_name, c.icon,
                   IFNULL(b.amount, 0) AS budget
            FROM categories c
            LEFT JOIN budgets b 
                ON b.category_id = c.id AND b.user_id = %s AND b.month = %s
        """, (user_id, current_month))
        categories = cursor.fetchall()

        cursor.execute("""
            SELECT final_category_id AS category_id, SUM(amount) AS spent
            FROM transactions
            WHERE user_id = %s
              AND YEAR(date) = %s AND MONTH(date) = %s
              AND final_category_id IS NOT NULL
            GROUP BY final_category_id
        """, (user_id, today.year, today.month))
        spent_data = cursor.fetchall()
        spent_map = {row["category_id"]: float(row["spent"]) for row in spent_data}

        for cat in categories:
            spent = spent_map.get(cat["category_id"], 0.0)
            budget = float(cat["budget"])

            if budget == 0:
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

        return alerts

    except:
        return []

    finally:
        conn.close()

cat_model = joblib.load("models/cat_model.pkl")
category_encoder = joblib.load("models/category_encoder.pkl")
embedder = joblib.load("models/embedder.pkl")
known_merchants = joblib.load("models/known_merchants.pkl")

# === Reload models after update ===
def refresh_models():
    global cat_model, category_encoder, known_merchants
    cat_model = joblib.load("models/cat_model.pkl")
    category_encoder = joblib.load("models/category_encoder.pkl")
    known_merchants = joblib.load("models/known_merchants.pkl")


# === Fuzzy matching ===
def match_known_brand(input_text, known_list, threshold=85):
    cleaned_input = clean_merchant_name(input_text)
    
    # 1. Try full merchant cleaned name fuzzy match first
    match_result = process.extractOne(
        cleaned_input, known_list, scorer=fuzz.token_set_ratio
    )
    if match_result:
        best_match, score, _ = match_result
        if score >= threshold:
            return best_match, False  # good match found
    
    # 2. Try each token fuzzy matching individually with partial_ratio to catch messy tokens inside noisy text
    tokens = cleaned_input.split()
    token_matches = []
    for token in tokens:
        match_token = process.extractOne(token, known_list, scorer=fuzz.partial_ratio)
        if match_token and match_token[1] >= 75:  # lower threshold for tokens (75)
            token_matches.append(match_token)
    
    if token_matches:
        # Return best token match overall
        best_token_match = max(token_matches, key=lambda x: x[1])
        return best_token_match[0], False
    
    # 3. No match found, fallback to ML with cleaned input
    return cleaned_input, True


# === Predict category ===
def predict_category(merchant_name, brand_map, threshold=85):
    cleaned_name = clean_merchant_name(merchant_name)
    known_merchants = list(brand_map.keys())

    matched_name, needs_ml = match_known_brand(merchant_name, known_merchants, threshold)

    if not needs_ml:
        # If fuzzy matched, get similarity score
        score = fuzz.token_set_ratio(cleaned_name, matched_name)
        confidence = round(score / 100, 2)  # Normalize score to 0.0 - 1.0
        return brand_map[matched_name], confidence

    # Fallback to ML prediction
    embedding = embedder.encode([cleaned_name])
    pred_index = cat_model.predict(embedding)[0]
    pred_label = category_encoder.inverse_transform([pred_index])[0]
    proba = cat_model.predict_proba(embedding)[0][pred_index]

    # Scale down ML confidence slightly to reflect it's less certain than a fuzzy match
    confidence = round(float(proba) * 0.75, 2)

    return pred_label, confidence

# === Get all available categories ===
@transactions_bp.route('/categories', methods=['GET'])
def get_categories():
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT id, name, icon FROM categories ORDER BY name ASC")
    categories = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(categories)

# === Get all transactions for user ===
@transactions_bp.route('/user/<int:user_id>', methods=['GET'])
def get_user_transactions(user_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM transactions WHERE user_id = %s ORDER BY date DESC", (user_id,))
    transactions = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(transactions)

# === Bank exception ===

@transactions_bp.route('/<int:transaction_id>/cash-details', methods=['POST'])
def add_cash_details(transaction_id):
    data = request.json  # Expecting list of dicts with category_id and amount

    if not isinstance(data, list) or len(data) == 0:
        return jsonify({'error': 'Invalid or empty data'}), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Get original transaction amount
        cursor.execute("SELECT amount FROM transactions WHERE id = %s", (transaction_id,))
        row = cursor.fetchone()
        if not row:
            cursor.close()
            conn.close()
            return jsonify({'error': 'Transaction not found'}), 404
        original_amount = float(row[0])

        # 2. Sum existing cash expense details amount for this transaction
        cursor.execute("SELECT IFNULL(SUM(amount), 0) FROM cash_expense_details WHERE transaction_id = %s", (transaction_id,))
        existing_sum = cursor.fetchone()[0] or 0

        # 3. Sum new amounts from the request
        new_sum = 0
        for item in data:
            try:
                amount = float(item.get('amount'))
                if amount < 0:
                    return jsonify({'error': 'Amounts must be positive'}), 400
                new_sum += amount
            except (TypeError, ValueError):
                return jsonify({'error': 'Invalid amount in data'}), 400

        total_sum = existing_sum + new_sum

        # 4. Check if total exceeds original transaction amount
        if total_sum > original_amount:
            cursor.close()
            conn.close()
            return jsonify({'error': f'Total decomposed amount ({total_sum}) exceeds original transaction amount ({original_amount}).'}), 400

        # If valid, proceed to insert the new cash expense details
        for item in data:
            category_id = int(item.get('category_id'))
            amount = float(item.get('amount'))
            if amount <= 0:
                continue
            cursor.execute("""
                INSERT INTO cash_expense_details (transaction_id, category_id, amount)
                VALUES (%s, %s, %s)
            """, (transaction_id, category_id, amount))

        # Mark transaction as decomposed
        cursor.execute("UPDATE transactions SET is_cash_decomposed = TRUE, needs_cash_detail = FALSE WHERE id = %s", (transaction_id,))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({'message': 'Cash expense details saved successfully'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# === Update category and retrain model ===
@transactions_bp.route('/<int:transaction_id>', methods=['PUT'])
def update_transaction_category(transaction_id):
    data = request.json
    final_category_id = data.get('final_category_id')

    if final_category_id is None:
        return jsonify({'error': 'final_category_id is required'}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE transactions SET final_category_id = %s WHERE id = %s", (final_category_id, transaction_id))
    conn.commit()
    cursor.close()

    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT t.merchant_name, c.name as category_name
        FROM transactions t
        JOIN categories c ON t.final_category_id = c.id
        WHERE t.id = %s
    """, (transaction_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        return jsonify({'error': 'Transaction not found'}), 404

    merchant = clean_merchant_name(row['merchant_name'])
    category = row['category_name'].lower().strip()

    df = pd.read_excel('models/final_cleaned_and_updated.xlsx')

    if len(df.columns) == 3:
        df.columns = ['Merchant Name', 'Category', 'Category_encoded']
        df = df.drop(columns=['Category_encoded'])
    elif len(df.columns) == 2:
        df.columns = ['Merchant Name', 'Category']
    else:
        return jsonify({'error': 'Unexpected dataframe columns'}), 500

    df['Merchant Name'] = df['Merchant Name'].astype(str).str.strip().str.lower()
    df['Category'] = df['Category'].astype(str).str.strip().str.lower()

    df = df[df['Merchant Name'] != merchant]
    df = pd.concat([df, pd.DataFrame([{'Merchant Name': merchant, 'Category': category}])], ignore_index=True)

    le = LabelEncoder()
    df['Category_encoded'] = le.fit_transform(df['Category'])

    X_all = df['Merchant Name'].fillna('').astype(str).str.strip()
    y_all = df['Category_encoded']
    mask = X_all != ''
    X = X_all[mask].tolist()
    y = y_all[mask].tolist()

    X_train, _, y_train, _ = train_test_split(X, y, test_size=0.2, random_state=42)
    X_train_emb = embedder.encode(X_train)

    model = RandomForestClassifier(n_estimators=300, max_depth=50, random_state=42)
    model.fit(X_train_emb, y_train)

    df.to_excel('models/final_cleaned_and_updated.xlsx', index=False)
    joblib.dump(model, 'models/cat_model.pkl')
    joblib.dump(le, 'models/category_encoder.pkl')
    joblib.dump(list(set(df['Merchant Name'])), 'models/known_merchants.pkl')

    refresh_models()

    return jsonify({'message': 'Transaction category updated and model retrained'}), 200


# === Predict and auto-insert transaction from external source ===
@transactions_bp.route('/incoming-transaction', methods=['POST'])
def incoming_transaction():
    data = request.json
    user_id = data.get('user_id')
    raw_merchant = data.get('merchant_name')
    amount = data.get('amount')
    date = data.get('date')

    if not all([user_id, raw_merchant, amount, date]):
        return jsonify({'error': 'Missing required fields'}), 400

    try:
        # ✅ Load known corrected merchant-category pairs from Excel
        df = pd.read_excel('models/final_cleaned_and_updated.xlsx')

        # Normalize column names if necessary
        if len(df.columns) == 3:
            df.columns = ['Merchant Name', 'Category', 'Category_encoded']
            df = df.drop(columns=['Category_encoded'])
        elif len(df.columns) == 2:
            df.columns = ['Merchant Name', 'Category']
        else:
            return jsonify({'error': 'Unexpected structure in known merchants file'}), 500

        # Clean and lower known brands
        df['Merchant Name'] = df['Merchant Name'].astype(str).str.strip().str.lower()
        df['Category'] = df['Category'].astype(str).str.strip().str.lower()
        brand_map = dict(zip(df['Merchant Name'], df['Category']))

        # ✅ Predict using known brand map
        predicted_label, confidence = predict_category(raw_merchant, brand_map=brand_map)

        # ✅ Cash withdrawal check
        is_cash_withdrawal = (predicted_label.lower() == 'banque')

        # ✅ Get category ID from DB
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id FROM categories WHERE LOWER(name) = %s LIMIT 1",
            (predicted_label.lower(),)
        )
        row = cursor.fetchone()
        predicted_cat_id = row['id'] if row else None

        # ✅ Insert transaction
        cursor.execute("""
            INSERT INTO transactions (
                user_id, merchant_name, date, amount, source,
                predicted_category_id, final_category_id, needs_cash_detail
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            user_id, raw_merchant, date, amount, 'system',
            predicted_cat_id, predicted_cat_id, is_cash_withdrawal
        ))
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()

        alerts = get_alerts_for_user(user_id)

        return jsonify({
            'message': 'Transaction received and categorized',
            'transaction_id': new_id,
            'predicted_category': predicted_label,
            'predicted_category_id': predicted_cat_id,
            'needs_cash_detail': is_cash_withdrawal,
            'alerts': alerts
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

    
@transactions_bp.route('/bulk-predict-merchants', methods=['POST']) 
def bulk_predict_merchants():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        df = pd.read_excel(file, usecols=[0])
        df.dropna(inplace=True)
        merchant_col = df.columns[0]
        original_names = df[merchant_col].astype(str).tolist()

        known_df = pd.read_excel('models/final_cleaned_and_updated.xlsx')
        if len(known_df.columns) == 3:
            known_df.columns = ['Merchant Name', 'Category', 'Category_encoded']
            known_df = known_df.drop(columns=['Category_encoded'])
        elif len(known_df.columns) == 2:
            known_df.columns = ['Merchant Name', 'Category']
        else:
            return jsonify({"error": "Unexpected structure in known merchants file"}), 500

        known_df['Merchant Name'] = known_df['Merchant Name'].astype(str).str.strip().str.lower()
        known_df['Category'] = known_df['Category'].astype(str).str.strip().str.lower()
        brand_map = dict(zip(known_df['Merchant Name'], known_df['Category']))

        predictions = []
        for original_name in original_names:
            predicted_label, confidence = predict_category(original_name, brand_map=brand_map)
            predicted_gov, gov_conf = predict_governorate(original_name)

            predictions.append((
                original_name,
                predicted_label,
                confidence,
                predicted_gov,
                gov_conf
            ))

        result_df = pd.DataFrame(predictions, columns=[
            'Affil Name',
            'Category',
            'Cat Confidence',
            'Localization',
            'Loc Confidence'
        ])

        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='xlsxwriter') as writer:
            result_df.to_excel(writer, index=False, sheet_name='Predictions')
        output.seek(0)

        filename = f'merchant_predictions_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'

        return send_file(
            output,
            download_name=filename,
            as_attachment=True,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Failed to process file: {str(e)}"}), 500
