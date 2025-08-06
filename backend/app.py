from flask import Flask
from flask_cors import CORS
from routes.transactions import transactions_bp
from routes.budgets import budgets_bp
from routes.dashboard import dashboard_bp
from routes.report import report_bp
from routes.notification import notifications_bp



app = Flask(__name__)
CORS(app)

app.register_blueprint(transactions_bp, url_prefix="/api/transactions")
app.register_blueprint(notifications_bp, url_prefix="/api/notifications")
app.register_blueprint(budgets_bp, url_prefix="/api/budgets")
app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")
app.register_blueprint(report_bp, url_prefix="/api/report")

@app.route("/")
def home():
    return {"message": "API is running"}

if __name__ == "__main__":
    app.run(debug=True)
    
