import pandas as pd
from routes.transactions import clean_merchant_name

def load_brand_map():
    df = pd.read_excel("models/final_cleaned_and_updated.xlsx", engine='openpyxl')

    if len(df.columns) == 3:
        df.columns = ['Merchant Name', 'Category', 'Encoded']
        df.drop(columns=['Encoded'], inplace=True)
    elif len(df.columns) == 2:
        df.columns = ['Merchant Name', 'Category']

    df['Merchant Name'] = df['Merchant Name'].astype(str).apply(clean_merchant_name)
    df['Category'] = df['Category'].astype(str).str.strip().str.lower()

    return dict(zip(df['Merchant Name'], df['Category']))
