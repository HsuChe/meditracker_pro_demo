import os
import csv
import pandas as pd
import numpy as np
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_schema_info():
    """Get schema information from PostgreSQL database."""
    try:
        conn = psycopg2.connect(
            dbname=os.getenv('POSTGRES_DB'),
            user=os.getenv('POSTGRES_USER'),
            password=os.getenv('POSTGRES_PASSWORD'),
            host=os.getenv('POSTGRES_HOST'),
            port=os.getenv('POSTGRES_PORT')
        )
        
        cursor = conn.cursor()
        
        # Query to get column information
        query = """
            SELECT 
                column_name, 
                data_type,
                is_nullable,
                column_default,
                col_description((table_schema || '.' || table_name)::regclass, ordinal_position) as description
            FROM 
                information_schema.columns 
            WHERE 
                table_name = 'claims_dummy'
            ORDER BY ordinal_position;
        """
        
        cursor.execute(query)
        schema_info = cursor.fetchall()
        
        # Convert to dictionary for easier access
        schema_dict = {
            row[0]: {
                'data_type': row[1],
                'is_nullable': row[2] == 'YES',
                'default_value': row[3],
                'description': row[4]
            }
            for row in schema_info
        }
        
        cursor.close()
        conn.close()
        
        return schema_dict
    except Exception as e:
        print(f"Error getting schema info: {e}")
        return None

def get_char_length(data_type):
    """Extract the length from a character type definition."""
    try:
        if '(' in data_type and ')' in data_type:
            length_str = data_type.split('(')[1].split(')')[0]
            return int(length_str)
    except (IndexError, ValueError):
        pass
    return None

def create_clean_csv(input_file, output_file='clean_claims_data.csv'):
    """Process CSV data with column-based approach using pandas."""
    try:
        # Get schema information
        schema_info = get_schema_info()
        if not schema_info:
            raise Exception("Failed to get schema information from database")

        # Read the CSV file into a pandas DataFrame
        df = pd.read_csv(input_file)
        print(f"Total rows to process: {len(df)}")

        # Process each column based on its data type from the schema
        for column in df.columns:
            if column in schema_info:
                data_type = schema_info[column]['data_type']
                print(f"\nProcessing column: {column} (Type: {data_type})")
                print(f"Null values: {df[column].isna().sum()}")
                print(f"Unique values: {df[column].nunique()}")
                print(f"Sample unique values: {df[column].unique()[:5]}")  # Show sample values for debugging

                # Handle different data types
                if data_type == 'boolean':
                    # First convert any numeric values to appropriate booleans
                    df[column] = df[column].apply(lambda x: 
                        True if isinstance(x, (int, float)) and x == 1 
                        else False if isinstance(x, (int, float)) and x == 0 
                        else None if isinstance(x, (int, float)) 
                        else x)
                    
                    # Then handle string representations
                    df[column] = df[column].apply(lambda x: 
                        True if isinstance(x, str) and x.lower() in ('true', 't', '1', 'yes', 'y') 
                        else False if isinstance(x, str) and x.lower() in ('false', 'f', '0', 'no', 'n') 
                        else x)
                    
                    # Finally, ensure only boolean or null values remain
                    df[column] = df[column].apply(lambda x: 
                        x if isinstance(x, bool) or x is None 
                        else None)
                    
                    # Verify the cleanup
                    remaining_values = df[column].unique()
                    print(f"After cleanup, unique values: {remaining_values}")
                    if not all(v is None or isinstance(v, bool) for v in remaining_values):
                        problematic = [v for v in remaining_values if v is not None and not isinstance(v, bool)]
                        raise ValueError(f"Column {column} still has non-boolean values: {problematic}")
                        
                elif data_type in ('integer', 'bigint', 'smallint'):
                    # Convert to integer, handling NaN values
                    df[column] = pd.to_numeric(df[column], errors='coerce').astype('Int64')
                elif data_type in ('numeric', 'decimal', 'real', 'double precision'):
                    # Convert to float, handling NaN values
                    df[column] = pd.to_numeric(df[column], errors='coerce')
                elif data_type == 'date':
                    # Convert to date format
                    df[column] = pd.to_datetime(df[column], errors='coerce').dt.date
                elif data_type == 'timestamp':
                    # Convert to timestamp format
                    df[column] = pd.to_datetime(df[column], errors='coerce')
                elif data_type.startswith(('character varying', 'varchar', 'char')):
                    # Clean string values and handle nulls
                    df[column] = df[column].astype(str)
                    df[column] = df[column].replace(r'^\s*$', np.nan, regex=True)
                    df[column] = df[column].replace('nan', np.nan)
                    
                    # Get length constraint if any
                    length = get_char_length(data_type)
                    if length is not None:
                        print(f"Truncating strings to length: {length}")
                        df[column] = df[column].apply(lambda x: x[:length] if isinstance(x, str) else x)

        # Export the cleaned data to CSV
        df.to_csv(output_file, index=False, na_rep='')
        print(f"\nProcessed data saved to {output_file}")
        
    except Exception as e:
        print(f"Error processing CSV: {e}")
        raise

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python etl_claims.py <input_csv_file> [output_csv_file]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else 'clean_claims_data.csv'
    create_clean_csv(input_file, output_file) 